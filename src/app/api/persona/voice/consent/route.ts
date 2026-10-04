import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/error';
import {
  recordVoiceConsent,
  revokeVoiceConsent,
  listVoiceConsents,
  getVoiceConsent,
} from '@/lib/persona/voice-consent';
import { isVoiceFeatureEnabled } from '@/lib/ai/voice-provider';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';

const createConsentSchema = z.object({
  voiceId: z.string().min(1).max(100),
  who: z.string().min(2).max(200),
  scope: z.string().min(5).max(500),
  notes: z.string().max(1000).optional(),
});

const revokeConsentSchema = z.object({
  voiceId: z.string().min(1),
});

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('voiceId');
    const includeRevoked = searchParams.get('includeRevoked') === 'true';

    if (voiceId) {
      const consent = await getVoiceConsent(voiceId);
      if (!consent) {
        throw new ApiError('CONSENT_NOT_FOUND', 'Consent record not found', 404);
      }
      return NextResponse.json({ consent });
    }

    const consents = await listVoiceConsents(includeRevoked);
    return NextResponse.json({ consents });
  },
  { permission: 'manage_persona' }
);

export const POST = withApi(
  async (request: Request) => {
    if (!isVoiceFeatureEnabled()) {
      throw new ApiError(
        'FEATURE_DISABLED',
        'Voice feature is disabled. Set FEATURE_VOICE=1 to manage voice consent.',
        403
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = createConsentSchema.parse(body);

    const consent = await recordVoiceConsent({
      voiceId: validated.voiceId,
      who: validated.who,
      scope: validated.scope,
      notes: validated.notes,
    });

    await logAuditEvent({
      action: 'create',
      entity: 'VoiceConsent',
      entityId: consent.id,
      meta: {
        voiceId: validated.voiceId,
        who: validated.who,
        scope: validated.scope,
      },
    });

    return NextResponse.json({ success: true, consent }, { status: 201 });
  },
  { permission: 'manage_persona' }
);

export const DELETE = withApi(
  async (request: Request) => {
    if (!isVoiceFeatureEnabled()) {
      throw new ApiError(
        'FEATURE_DISABLED',
        'Voice feature is disabled. Set FEATURE_VOICE=1 to manage voice consent.',
        403
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = revokeConsentSchema.parse(body);

    const existing = await getVoiceConsent(validated.voiceId);
    if (!existing) {
      throw new ApiError('CONSENT_NOT_FOUND', 'Consent record not found', 404);
    }

    const updated = await revokeVoiceConsent(validated.voiceId);

    await logAuditEvent({
      action: 'delete',
      entity: 'VoiceConsent',
      entityId: updated.id,
      meta: {
        event: 'consent_revoked',
        voiceId: validated.voiceId,
        revokedAt: updated.revokedAt,
      },
    });

    return NextResponse.json({ success: true, consent: updated });
  },
  { permission: 'manage_persona' }
);
