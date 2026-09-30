import { NextResponse } from 'next/server';
import { getActivePersona } from '@/lib/persona/service';
import { getCurrentUser } from '@/lib/auth/session';
import { markAsPersonaVisualModel } from '@/lib/persona/visual';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const persona = await getActivePersona();

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found' }, { status: 404 });
    }

    const body = await request.json();
    const { imageUrl, config, prompt, modelUsed } = body;

    if (!imageUrl || !config) {
      return NextResponse.json({ error: 'Missing imageUrl or config parameters' }, { status: 400 });
    }

    const result = await markAsPersonaVisualModel({
      personaId: persona.id,
      imageUrl,
      config,
      prompt: prompt || '',
      modelUsed,
      userId: user?.userId,
    });

    return NextResponse.json({
      success: true,
      persona: result.persona,
      asset: result.asset,
    });
  } catch (error) {
    console.error('Failed to mark visual model:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark visual model' },
      { status: 500 }
    );
  }
}
