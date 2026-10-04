import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { withApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/error';
import { storage } from '@/lib/storage';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  getVoiceProvider,
  isVoiceFeatureEnabled,
  PRESET_VOICES,
  VoiceProviderError,
} from '@/lib/ai/voice-provider';
import { z } from 'zod';

const voiceSynthesisSchema = z.object({
  personaId: z.string().min(1),
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1),
  speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  attemptCloning: z.boolean().optional(),
});

export const GET = withApi(
  async (request: Request) => {
    const enabled = isVoiceFeatureEnabled();
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    const provider = getVoiceProvider();
    const voices = await provider.listVoices();

    let assets: unknown[] = [];
    if (personaId) {
      assets = await prisma.asset.findMany({
        where: {
          personaId,
          type: 'audio',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    return NextResponse.json({
      enabled,
      presetVoices: PRESET_VOICES,
      voices,
      assets,
    });
  },
  { permission: 'manage_persona' }
);

export const POST = withApi(
  async (request: Request) => {
    // 1. Feature Flag Guard
    if (!isVoiceFeatureEnabled()) {
      throw new ApiError(
        'FEATURE_DISABLED',
        'Voice synthesis is disabled. Set FEATURE_VOICE=1 to enable voice generation.',
        403
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = voiceSynthesisSchema.parse(body);

    // 2. Load Persona
    const persona = await prisma.persona.findUnique({
      where: { id: validated.personaId },
    });

    if (!persona) {
      throw new ApiError('PERSONA_NOT_FOUND', 'Persona not found', 404);
    }

    // 3. Locked-face check (consistency with identity pipeline)
    if (persona.faceStatus !== 'locked' || !persona.faceAssetId) {
      throw new ApiError(
        'FACE_NOT_LOCKED',
        'Persona face must be locked before synthesizing persona voice assets.',
        409
      );
    }

    // 4. Synthesize voice with strict consent and cloning guardrails
    const provider = getVoiceProvider();
    let synthesisResult;
    try {
      synthesisResult = await provider.synthesize({
        text: validated.text,
        voiceId: validated.voiceId,
        speed: validated.speed,
        personaId: persona.id,
        attemptCloning: validated.attemptCloning,
      });
    } catch (err: unknown) {
      if (err instanceof VoiceProviderError) {
        if (err.code === 'consent_required') {
          throw new ApiError('CONSENT_REQUIRED', err.message, 403);
        }
        if (err.code === 'voice_not_allowed') {
          throw new ApiError('VOICE_NOT_ALLOWED', err.message, 403);
        }
        if (err.code === 'feature_disabled') {
          throw new ApiError('FEATURE_DISABLED', err.message, 403);
        }
        if (err.code === 'not_configured') {
          throw new ApiError('PROVIDER_NOT_CONFIGURED', err.message, 503);
        }
        if (err.code === 'synthesis_failed') {
          throw new ApiError('SYNTHESIS_FAILED', err.message, 502);
        }
        throw new ApiError('UNSUPPORTED_VOICE_OPERATION', err.message, 400);
      }
      throw err;
    }

    // 5. Store audio asset with mandatory AI disclosure tagging
    const timestamp = Date.now();
    const ext = synthesisResult.mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const storageKey = `personas/${persona.id}/audio_${timestamp}.${ext}`;

    const uploadRes = await storage.upload(
      synthesisResult.buffer,
      storageKey,
      synthesisResult.mimeType
    );

    const asset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey,
        url: uploadRes.url,
        type: 'audio',
        kind: 'content',
        parentAssetId: persona.faceAssetId,
        suitability: 'sfw_safe',
        aiGenerated: true, // Mandatory AI-generated disclosure tag
        safetyStatus: 'passed',
        safetyReasons: JSON.stringify(['Automated voice synthesis safety check passed']),
        tags: JSON.stringify([
          'voice_synthesis',
          validated.voiceId,
          synthesisResult.isPreset ? 'preset_voice' : 'consented_custom_voice',
        ]),
        provenanceMeta: JSON.stringify({
          voiceId: validated.voiceId,
          isPreset: synthesisResult.isPreset,
          consentId: synthesisResult.consentId,
          speed: validated.speed,
          textLength: validated.text.length,
          aiGenerated: true,
          disclosureText: persona.aiDisclosureText,
          createdAt: new Date().toISOString(),
        }),
      },
    });

    await logAuditEvent({
      action: 'publish',
      entity: 'Asset',
      entityId: asset.id,
      meta: {
        event: 'voice_synthesized',
        voiceId: validated.voiceId,
        isPreset: synthesisResult.isPreset,
        consentId: synthesisResult.consentId,
      },
    });

    return NextResponse.json({
      success: true,
      asset,
      isPreset: synthesisResult.isPreset,
      consentId: synthesisResult.consentId,
    });
  },
  { permission: 'manage_persona' }
);
