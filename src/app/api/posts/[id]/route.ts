import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { updatePostWithVariants, deletePost } from '@/lib/composer/service';
import { updatePostSchema } from '@/lib/validation/schemas';
import { withApi } from '@/lib/api/handler';

export const GET = withApi<{ id: string }>(async (_request, context) => {
  const params = await context.params;
  const id = params?.id || '';
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      variants: {
        include: {
          asset: true,
          platformAccount: true,
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: 'Post not found', success: false }, { status: 404 });
  }

  return NextResponse.json({ post });
});

export const PUT = withApi<{ id: string }>(
  async (request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    const body = await request.json();
    const data = updatePostSchema.parse(body);

    const post = await updatePostWithVariants(id, data, context.user.userId);
    return NextResponse.json({ success: true, post });
  },
  { permission: 'compose_posts' },
);

export const DELETE = withApi<{ id: string }>(
  async (_request, context) => {
    const params = await context.params;
    const id = params?.id || '';
    await deletePost(id, context.user.userId);
    return NextResponse.json({ success: true, message: 'Post deleted' });
  },
  { permission: 'compose_posts' },
);
