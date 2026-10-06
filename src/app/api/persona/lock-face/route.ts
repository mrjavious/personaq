import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/handler';
import { lockFaceCard } from '@/lib/persona/face-card';
import { VisualGenerationError } from '@/lib/persona/visual-types';

export const POST = withApi(
  async (request: Request) => {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body', success: false }, { status: 400 });
    }

    const personaId = body.personaId as string | undefined;
    const assetId = body.assetId as string | undefined;

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    if (!assetId) {
      return NextResponse.json(
        {
          error: 'assetId is required. Client-supplied file paths and URLs are not accepted. Use a verified face_candidate asset ID.',
          success: false,
        },
        { status: 400 }
      );
    }

    try {
      const result = await lockFaceCard({ personaId, assetId });
      return NextResponse.json({
        success: true,
        isFaceLocked: true,
        faceAssetId: result.faceAsset.id,
        bodyAssetId: result.bodyAsset?.id ?? null,
        lockedFaceUrl: result.faceAsset.url,
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
