import { NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/persona/service';
import { markAsPersonaVisualModel } from '@/lib/persona/visual';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request, context) => {
    const body = await request.json();

    if (!body.personaId) {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    const persona = await getPersonaById(body.personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
    }

    const { imageUrl, config, prompt, modelUsed } = body;

    if (!imageUrl || !config) {
      return NextResponse.json(
        { error: 'Missing imageUrl or config parameters', success: false },
        { status: 400 },
      );
    }

    const result = await markAsPersonaVisualModel({
      personaId: persona.id,
      imageUrl,
      config,
      prompt: prompt || '',
      modelUsed,
      userId: context.user?.userId,
    });

    return NextResponse.json({
      success: true,
      persona: result.persona,
      asset: result.asset,
    });
  },
  { permission: 'manage_persona' },
);
