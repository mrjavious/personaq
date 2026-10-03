import { NextResponse } from 'next/server';
import { getActivePersona, getPersonaById } from '@/lib/persona/service';
import { markAsPersonaVisualModel } from '@/lib/persona/visual';
import { withApi } from '@/lib/api/handler';

export const POST = withApi(
  async (request: Request, context) => {
    const body = await request.json();

    let persona = null;
    if (body.personaId) {
      persona = await getPersonaById(body.personaId);
    }
    if (!persona) {
      persona = await getActivePersona();
    }

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found', success: false }, { status: 404 });
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
