import { NextResponse } from 'next/server';
import { queueComfyGeneration } from '@/lib/comfyui/client';
import { requireAuth } from '@/lib/auth/guards';
import { logAuditEvent } from '@/lib/audit/logger';

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { prompt, negativePrompt, aspectRatio } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Safety guardrail: Disallow forbidden terms in the positive prompt
    const lowerPrompt = prompt.toLowerCase();
    const forbiddenKeywords = ['minor', 'child', 'underage', 'teen', 'kid', 'schoolgirl', 'celebrity'];
    if (forbiddenKeywords.some((kw) => lowerPrompt.includes(kw))) {
      return NextResponse.json(
        { error: 'Guardrail violation: Prompt contains prohibited minor or real-person keywords.' },
        { status: 400 }
      );
    }

    const job = await queueComfyGeneration({
      prompt,
      negativePrompt,
      aspectRatio: aspectRatio || '1:1',
    });

    await logAuditEvent({
      userId: user.userId,
      action: 'publish', // generation request
      entity: 'Asset',
      entityId: job.promptId,
      meta: { type: 'comfyui_generation_queued', prompt, aspectRatio },
    });

    return NextResponse.json({
      success: true,
      promptId: job.promptId,
      message: 'ComfyUI generation job queued',
    });
  } catch (error) {
    console.error('ComfyUI generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue generation' },
      { status: 500 }
    );
  }
}
