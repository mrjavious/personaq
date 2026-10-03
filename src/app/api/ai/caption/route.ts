import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import aiTextProvider from '@/lib/ai';
import { withApi } from '@/lib/api/handler';
import { aiCaptionSchema } from '@/lib/validation/schemas';
import { checkUserGenerationCap, recordUserGeneration } from '@/lib/security/rate-limit';

export const POST = withApi(
  async (request, context) => {
    const userId = context.user.userId;

    const rateCheck = checkUserGenerationCap(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Generation cap exceeded. Limit is ${rateCheck.limit} per day. Try again in ${rateCheck.retryAfterSeconds}s.`,
          retryAfter: rateCheck.retryAfterSeconds,
          success: false,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { concept, topic, platform, personaId, assetDescription } = aiCaptionSchema.parse(body);
    const targetConcept = concept || topic || '';

    // Resolve Persona
    let persona = null;
    if (personaId) {
      persona = await prisma.persona.findUnique({ where: { id: personaId } });
    }
    if (!persona) {
      persona = await prisma.persona.findFirst();
    }

    if (!persona) {
      return NextResponse.json({ error: 'No active persona found', success: false }, { status: 404 });
    }

    recordUserGeneration(userId);

    const parsedCatchphrases =
      typeof persona.catchphrases === 'string' ? JSON.parse(persona.catchphrases) : persona.catchphrases || [];
    const parsedBoundaries =
      typeof persona.boundaries === 'string' ? JSON.parse(persona.boundaries) : persona.boundaries || [];
    const parsedPillars =
      typeof persona.contentPillars === 'string' ? JSON.parse(persona.contentPillars) : persona.contentPillars || [];

    const result = await aiTextProvider.generateCaption({
      concept: targetConcept,
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
  },
  { permission: 'compose_posts' }
);
