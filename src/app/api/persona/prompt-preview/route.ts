import { NextResponse } from 'next/server';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json();
    const prompt = buildPersonaSystemPrompt(body);
    return NextResponse.json({ success: true, prompt });
  },
  { permission: 'manage_persona' },
);
