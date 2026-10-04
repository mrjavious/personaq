import prisma from '@/lib/db/prisma';

export type VoiceProviderErrorCode =
  | 'feature_disabled'
  | 'not_configured'
  | 'consent_required'
  | 'voice_not_allowed'
  | 'synthesis_failed'
  | 'unsupported';

export class VoiceProviderError extends Error {
  readonly code: VoiceProviderErrorCode;
  readonly provider: string;

  constructor(
    code: VoiceProviderErrorCode,
    message: string,
    provider = 'voicebox',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'VoiceProviderError';
    this.code = code;
    this.provider = provider;
  }
}

export interface VoicePreset {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  description: string;
  locale: string;
}

export const PRESET_VOICES: readonly VoicePreset[] = [
  {
    id: 'preset_natural_warm',
    name: 'Warm Natural Narrator',
    gender: 'female',
    description: 'Clear, warm, organic conversational narrator',
    locale: 'en-US',
  },
  {
    id: 'preset_conversational_calm',
    name: 'Calm Conversationalist',
    gender: 'male',
    description: 'Mellow, grounded, authentic conversational tone',
    locale: 'en-US',
  },
  {
    id: 'preset_confident_host',
    name: 'Confident Studio Host',
    gender: 'neutral',
    description: 'Articulate, energetic, engaging presenter',
    locale: 'en-US',
  },
  {
    id: 'preset_gentle_storyteller',
    name: 'Gentle Storyteller',
    gender: 'female',
    description: 'Soft, nuanced, intimate expressive reading',
    locale: 'en-US',
  },
] as const;

export function isVoiceFeatureEnabled(): boolean {
  return process.env.FEATURE_VOICE === '1';
}

export function isPresetVoice(voiceId: string): boolean {
  return PRESET_VOICES.some((p) => p.id === voiceId);
}

export interface VoiceConsentValidation {
  allowed: boolean;
  reason: string;
  isPreset: boolean;
  consent?: {
    id: string;
    voiceId: string;
    who: string;
    when: Date;
    scope: string;
    revokedAt: Date | null;
  };
}

/**
 * Validates whether a voice is permitted for synthesis.
 * Hard rule: Allow ONLY preset voices or voices with a valid, unrevoked consent record.
 * Third-party voice cloning is strictly prohibited.
 */
export async function validateVoiceConsent(voiceId: string): Promise<VoiceConsentValidation> {
  if (!voiceId || typeof voiceId !== 'string') {
    return {
      allowed: false,
      reason: 'voiceId must be a non-empty string',
      isPreset: false,
    };
  }

  // 1. Preset voices are always allowed
  if (isPresetVoice(voiceId)) {
    return {
      allowed: true,
      reason: 'Preset voice authorized by system',
      isPreset: true,
    };
  }

  // 2. Custom voices require a valid, non-revoked consent record
  const consentRecord = await prisma.voiceConsent.findUnique({
    where: { voiceId },
  });

  if (!consentRecord) {
    return {
      allowed: false,
      reason: `No recorded consent found for custom voice "${voiceId}". Cloning of third-party voices is strictly prohibited without recorded consent.`,
      isPreset: false,
    };
  }

  if (consentRecord.revokedAt) {
    return {
      allowed: false,
      reason: `Consent for voice "${voiceId}" was revoked on ${consentRecord.revokedAt.toISOString()}.`,
      isPreset: false,
      consent: consentRecord,
    };
  }

  return {
    allowed: true,
    reason: `Consent verified for ${consentRecord.who} (scope: ${consentRecord.scope})`,
    isPreset: false,
    consent: consentRecord,
  };
}

export interface VoiceSynthesisOptions {
  text: string;
  voiceId: string;
  speed?: number; // 0.5 to 2.0, default 1.0
  personaId?: string;
  attemptCloning?: boolean; // If true, strictly rejected
}

export interface VoiceSynthesisResult {
  buffer: Buffer;
  mimeType: string;
  voiceId: string;
  isPreset: boolean;
  consentId?: string;
  durationSec?: number;
  provider: string;
  aiGenerated: true;
}

export interface VoiceProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  synthesize(options: VoiceSynthesisOptions): Promise<VoiceSynthesisResult>;
  listVoices(): Promise<Array<{ id: string; name: string; isPreset: boolean; description?: string }>>;
}

/**
 * VoiceboxProvider communicates with local Voicebox REST API (default http://127.0.0.1:17493).
 * Requires FEATURE_VOICE=1.
 * Strict consent enforcement: fails closed if consent record is missing or revoked.
 */
export class VoiceboxProvider implements VoiceProvider {
  readonly name = 'voicebox';
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.VOICEBOX_BASE_URL || 'http://127.0.0.1:17493';
  }

  async isAvailable(): Promise<boolean> {
    if (!isVoiceFeatureEnabled()) {
      return false;
    }

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      }).catch(() => null);

      return res !== null && (res.status === 200 || res.status === 204);
    } catch {
      return false;
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string; isPreset: boolean; description?: string }>> {
    const list: Array<{ id: string; name: string; isPreset: boolean; description?: string }> = PRESET_VOICES.map((p) => ({
      id: p.id,
      name: p.name,
      isPreset: true,
      description: p.description,
    }));

    // Append authorized custom voices with active consent
    const activeConsents = await prisma.voiceConsent.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    for (const c of activeConsents) {
      list.push({
        id: c.voiceId,
        name: `Custom (${c.who})`,
        isPreset: false,
        description: `Consented scope: ${c.scope}`,
      });
    }

    return list;
  }

  async synthesize(options: VoiceSynthesisOptions): Promise<VoiceSynthesisResult> {
    // 1. Feature Flag Guard
    if (!isVoiceFeatureEnabled()) {
      throw new VoiceProviderError(
        'feature_disabled',
        'Voice synthesis is disabled. Set FEATURE_VOICE=1 in environment to enable.',
        this.name
      );
    }

    // 2. Strict Prohibition: No cloning of third-party voices
    if (options.attemptCloning) {
      throw new VoiceProviderError(
        'voice_not_allowed',
        'Unauthorized third-party voice cloning is strictly prohibited.',
        this.name
      );
    }

    // 3. Text validation
    const trimmedText = options.text?.trim();
    if (!trimmedText) {
      throw new VoiceProviderError('unsupported', 'Text is required for voice synthesis', this.name);
    }

    // 4. Strict Consent Verification Guard
    const consentValidation = await validateVoiceConsent(options.voiceId);
    if (!consentValidation.allowed) {
      throw new VoiceProviderError('consent_required', consentValidation.reason, this.name);
    }

    // 5. Call Voicebox local REST API
    const payload = {
      text: trimmedText,
      voice_id: options.voiceId,
      speed: options.speed ?? 1.0,
      persona_id: options.personaId,
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/wav, audio/mpeg, application/octet-stream',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new VoiceProviderError(
        'not_configured',
        `Failed to reach Voicebox REST API at ${this.baseUrl}: ${msg}`,
        this.name
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new VoiceProviderError(
        'synthesis_failed',
        `Voicebox returned HTTP ${response.status}: ${errText || response.statusText}`,
        this.name
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'audio/wav';

    return {
      buffer,
      mimeType,
      voiceId: options.voiceId,
      isPreset: consentValidation.isPreset,
      consentId: consentValidation.consent?.id,
      durationSec: undefined,
      provider: this.name,
      aiGenerated: true,
    };
  }
}

let activeVoiceProvider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (!activeVoiceProvider) {
    activeVoiceProvider = new VoiceboxProvider();
  }
  return activeVoiceProvider;
}

export function setVoiceProvider(provider: VoiceProvider | null): void {
  activeVoiceProvider = provider;
}
