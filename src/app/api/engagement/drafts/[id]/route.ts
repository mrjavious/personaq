import { NextRequest, NextResponse } from 'next/server';
import { approveDraftReply, discardDraftReply, deleteDraftReply } from '@/lib/engagement/service';
import { requireAuth } from '@/lib/auth/guards';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const user = await requireAuth();
    const { action, editedText } = body;

    if (action === 'approve') {
      const updated = await approveDraftReply({
        id,
        editedText,
        userId: user.userId,
      });
      return NextResponse.json({ draft: updated });
    } else if (action === 'discard') {
      const updated = await discardDraftReply(id, user.userId);
      return NextResponse.json({ draft: updated });
    }

    return NextResponse.json(
      { error: "Invalid action. Expected 'approve' or 'discard'" },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating draft reply:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update draft' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuth();
    await deleteDraftReply(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft reply:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
