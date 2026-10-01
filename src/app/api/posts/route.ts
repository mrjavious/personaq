import { NextResponse } from 'next/server';
import { getAllPosts, createPostWithVariants } from '@/lib/composer/service';
import { requireAuth } from '@/lib/auth/guards';
import { createPostSchema } from '@/lib/validation/schemas';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { posts, total } = await getAllPosts(personaId, limit, offset);
    return NextResponse.json({ posts, total, limit, offset });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const validation = createPostSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const post = await createPostWithVariants(validation.data, user.userId);
    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create post' },
      { status: 400 },
    );
  }
}
