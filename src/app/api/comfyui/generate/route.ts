import { NextResponse } from 'next/server';
import { queueComfyGeneration } from '@/lib/comfyui/client';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';
import { comfyuiGenerateSchema } from '@/lib/validation/schemas';
import { checkUserGenerationCap, recordUserGeneration } from '@/lib/security/rate-limit';

export const POST = withApi(
  async (request, context) => {
    const userId = context.user.userId;

    const rateCheck = checkUserGenerationCap(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Generation cap exceeded. Limit is ${rateCheck.limit} per day. Try again in ${rateCheck.retryAfterSeconds}s.`,
          retryAfter: rateCheck.retryAfterSeconds,
          success: false,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { prompt, negativePrompt, aspectRatio } = comfyuiGenerateSchema.parse(body);

    // Safety guardrail: Disallow forbidden terms in the positive prompt
    const lowerPrompt = prompt.toLowerCase();
    const forbiddenKeywords = ['minor', 'child', 'underage', 'teen', 'kid', 'schoolgirl', 'celebrity'];
    if (forbiddenKeywords.some((kw) => lowerPrompt.includes(kw))) {
      return NextResponse.json(
        { error: 'Guardrail violation: Prompt contains prohibited minor or real-person keywords.', success: false },
        { status: 400 }
      );
    }

    recordUserGeneration(userId);

    const job = await queueComfyGeneration({
      prompt,
      negativePrompt,
      aspectRatio: aspectRatio || '1:1',
    });

    await logAuditEvent({
      userId,
      action: 'publish',
      entity: 'Asset',
      entityId: job.promptId,
      meta: { type: 'comfyui_generation_queued', prompt, aspectRatio },
    });

    return NextResponse.json({
      success: true,
      promptId: job.promptId,
      message: 'ComfyUI generation job queued',
    });
  },
  { permission: 'manage_persona' }
);
