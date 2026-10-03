import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { generateFaceCardCandidate } from '@/lib/persona/face-card';
import { VisualGenerationError } from '@/lib/persona/visual-types';
import { z } from 'zod';

const GenerateFaceCardSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  traits: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withApi(
  async (request: Request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body', success: false }, { status: 400 });
    }

    const parseResult = GenerateFaceCardSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten(), success: false },
        { status: 400 }
      );
    }

    const { personaId, traits } = parseResult.data;

    try {
      const result = await generateFaceCardCandidate({ personaId, traits });
      return NextResponse.json({
        success: true,
        asset: result.asset,
        prompt: result.prompt,
        modelUsed: result.modelUsed,
      });
    } catch (error) {
      if (error instanceof VisualGenerationError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            details: error.details,
            success: false,
          },
          { status: error.statusCode }
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal Server Error', success: false },
        { status: 500 }
      );
    }
  },
  { permission: 'manage_persona' }
);
