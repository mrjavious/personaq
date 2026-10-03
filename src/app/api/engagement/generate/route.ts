import { NextResponse } from 'next/server';
import { generateDraftSuggestions } from '@/lib/engagement/service';
import { generateEngagementSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (req: Request) => {
    const body = await req.json();
    const { platformAccountId, commentText } = generateEngagementSchema.parse(body);

    const suggestions = await generateDraftSuggestions({
      platformAccountId,
      contextText: commentText.trim(),
    });

    return NextResponse.json({ suggestions });
  },
  { permission: 'compose_posts' },
);
