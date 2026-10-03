import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { lockFaceCard } from '@/lib/persona/face-card';
import { VisualGenerationError } from '@/lib/persona/visual-types';
import { z } from 'zod';

const LockFaceCardSchema = z.object({
  personaId: z.string().min(1, 'personaId is required'),
  assetId: z.string().min(1, 'assetId is required'),
});

export const POST = withApi(
  async (request: Request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body', success: false }, { status: 400 });
    }

    const parseResult = LockFaceCardSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten(), success: false },
        { status: 400 }
      );
    }

    const { personaId, assetId } = parseResult.data;

    try {
      const result = await lockFaceCard({ personaId, assetId });
      return NextResponse.json({
        success: true,
        faceAsset: result.faceAsset,
        bodyAsset: result.bodyAsset,
        persona: result.persona,
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
