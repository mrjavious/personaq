import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import aiTextProvider from '@/lib/ai';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const { concept, platform, personaId, assetDescription } = body;

    if (!concept || typeof concept !== 'string') {
      return NextResponse.json({ error: 'Concept text is required' }, { status: 400 });
    }

    // Resolve Persona
    let persona = null;
    if (personaId) {
      persona = await prisma.persona.findUnique({ where: { id: personaId } });
    }
    if (!persona) {
      persona = await prisma.persona.findFirst();
    }

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found' }, { status: 404 });
    }

    const parsedCatchphrases =
      typeof persona.catchphrases === 'string' ? JSON.parse(persona.catchphrases) : persona.catchphrases || [];
    const parsedBoundaries =
      typeof persona.boundaries === 'string' ? JSON.parse(persona.boundaries) : persona.boundaries || [];
    const parsedPillars =
      typeof persona.contentPillars === 'string' ? JSON.parse(persona.contentPillars) : persona.contentPillars || [];

    const result = await aiTextProvider.generateCaption({
      concept,
      platform: platform || 'instagram',
      persona: {
        name: persona.name,
        adultAge: persona.adultAge,
        backstory: persona.backstory,
        voiceTone: persona.voiceTone,
        catchphrases: parsedCatchphrases,
        boundaries: parsedBoundaries,
        contentPillars: parsedPillars,
        aiDisclosureText: persona.aiDisclosureText,
      },
      assetDescription,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Caption generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Caption generation failed' },
      { status: 500 }
    );
  }
}
