import { NextResponse } from 'next/server';
import { publishVariant } from '@/lib/publishing';
import { getCurrentUser } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { variantId } = body;

    if (!variantId) {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
    }

    const result = await publishVariant(variantId, user?.userId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Publish dispatch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish failed' },
      { status: 400 }
    );
  }
}
