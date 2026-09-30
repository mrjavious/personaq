import { NextRequest, NextResponse } from 'next/server';
import { listDraftReplies, createDraftReply } from '@/lib/engagement/service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platformAccountId = searchParams.get('platformAccountId') || undefined;
    const status = searchParams.get('status') || undefined;

    const drafts = await listDraftReplies({ platformAccountId, status });
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Error listing draft replies:', error);
    return NextResponse.json({ error: 'Failed to list drafts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platformAccountId, contextText, suggestedText } = body;

    if (!platformAccountId || !contextText || !suggestedText) {
      return NextResponse.json(
        { error: 'platformAccountId, contextText, and suggestedText are required' },
        { status: 400 }
      );
    }

    const draft = await createDraftReply({
      platformAccountId,
      contextText,
      suggestedText,
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error('Error creating draft reply:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create draft' },
      { status: 400 }
    );
  }
}
