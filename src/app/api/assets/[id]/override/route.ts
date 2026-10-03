import { NextResponse } from 'next/server';
import { overrideSafetyDecision } from '@/lib/safety/pipeline';
import { withApi } from '@/lib/api/handler';

export const POST = withApi<{ id: string }>(
  async (request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await request.json();
    const { reason, justification } = body;
    const finalReason = reason || justification;

    if (!finalReason || typeof finalReason !== 'string' || finalReason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Detailed justification reason is required for manual override', success: false },
        { status: 400 },
      );
    }

    const updatedAsset = await overrideSafetyDecision(id, context.user.userId, finalReason);
    return NextResponse.json({ success: true, asset: updatedAsset });
  },
  { permission: 'review_safety_overrides' },
);
