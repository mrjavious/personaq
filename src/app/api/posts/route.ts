import { NextResponse } from 'next/server';
import { getAllPosts, createPostWithVariants } from '@/lib/composer/service';
import { createPostSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const personaId = searchParams.get('personaId') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const { posts, total } = await getAllPosts(personaId, limit, offset);
  return NextResponse.json({ posts, total, limit, offset });
});

export const POST = withApi(
  async (request: Request, context) => {
    const body = await request.json();
    const data = createPostSchema.parse(body);
    const post = await createPostWithVariants(data, context.user.userId);
    return NextResponse.json({ success: true, post });
  },
  { permission: 'compose_posts' },
);
