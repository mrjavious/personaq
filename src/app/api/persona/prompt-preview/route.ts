import { NextResponse } from 'next/server';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const prompt = buildPersonaSystemPrompt(body);
    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate prompt' },
      { status: 400 }
    );
  }
}
