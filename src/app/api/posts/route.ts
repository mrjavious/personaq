import { NextResponse } from 'next/server';
import { getAllPosts, createPostWithVariants } from '@/lib/composer/service';
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId') || undefined;

    const posts = await getAllPosts(personaId);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();

    const post = await createPostWithVariants(body, user?.userId);
    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create post' },
      { status: 400 }
    );
  }
}
