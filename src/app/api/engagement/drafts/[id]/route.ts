import { NextResponse } from 'next/server';
import { approveDraftReply, discardDraftReply, deleteDraftReply } from '@/lib/engagement/service';
import { withApi } from '@/lib/api/handler';

export const PUT = withApi<{ id: string }>(
  async (req, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await req.json();
    const { action, editedText } = body;

    if (action === 'approve') {
      const updated = await approveDraftReply({
        id,
        editedText,
        userId: context.user.userId,
      });
      return NextResponse.json({ draft: updated });
    } else if (action === 'discard' || action === 'reject') {
      const updated = await discardDraftReply(id, context.user.userId);
      return NextResponse.json({ draft: updated });
    }

    return NextResponse.json(
      { error: "Invalid action. Expected 'approve' or 'discard'", success: false },
      { status: 400 },
    );
  },
  { permission: 'approve_replies' },
);

export const DELETE = withApi<{ id: string }>(
  async (_req, context) => {
    const params = await context.params;
    const id = params?.id || '';
    await deleteDraftReply(id);
    return NextResponse.json({ success: true });
  },
  { permission: 'approve_replies' },
);
