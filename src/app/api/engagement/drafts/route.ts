import { NextResponse } from 'next/server';
import { listDraftReplies, createDraftReply } from '@/lib/engagement/service';
import { createDraftReplySchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const platformAccountId = searchParams.get('platformAccountId') || undefined;
  const status = searchParams.get('status') || undefined;

  const drafts = await listDraftReplies({ platformAccountId, status });
  return NextResponse.json({ drafts });
});

export const POST = withApi(
  async (req: Request) => {
    const body = await req.json();
    const data = createDraftReplySchema.parse(body);

    const draft = await createDraftReply(data);
    return NextResponse.json({ draft }, { status: 201 });
  },
  { permission: 'compose_posts' },
);
