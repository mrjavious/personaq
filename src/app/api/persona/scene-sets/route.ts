import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { withApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/error';
import { z } from 'zod';

const createSceneSetSchema = z.object({
  personaId: z.string().min(1),
  name: z.string().min(1).max(100),
  setText: z.string().min(5).max(1000),
  lightingJson: z.union([
    z.string(),
    z.object({
      keyDirection: z.string().optional(),
      timeOfDay: z.string().optional(),
      volumetric: z.string().optional(),
      rimLight: z.string().optional(),
      bokeh: z.string().optional(),
      colourGrade: z.string().optional(),
    }),
  ]),
});

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      throw new ApiError('VALIDATION_ERROR', 'personaId is required', 400);
    }

    const sceneSets = await prisma.sceneSet.findMany({
      where: { personaId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ sceneSets });
  },
  { permission: 'manage_persona' }
);

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json().catch(() => ({}));
    const validated = createSceneSetSchema.parse(body);

    const persona = await prisma.persona.findUnique({
      where: { id: validated.personaId },
    });

    if (!persona) {
      throw new ApiError('PERSONA_NOT_FOUND', 'Persona not found', 404);
    }

    const lightingString =
      typeof validated.lightingJson === 'string'
        ? validated.lightingJson
        : JSON.stringify(validated.lightingJson);

    const sceneSet = await prisma.sceneSet.create({
      data: {
        personaId: validated.personaId,
        name: validated.name,
        setText: validated.setText,
        lightingJson: lightingString,
      },
    });

    return NextResponse.json({ success: true, sceneSet }, { status: 201 });
  },
  { permission: 'manage_persona' }
);
