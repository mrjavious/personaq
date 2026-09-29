import { NextResponse } from 'next/server';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';

export async function POST(request: Request) {
  try {
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
