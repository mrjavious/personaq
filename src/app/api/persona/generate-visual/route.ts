import { NextResponse } from 'next/server';
import { getPersonaById } from '@/lib/persona/service';
import { generatePersonaVisual, VisualModelOptions } from '@/lib/persona/visual';
import { withApi } from '@/lib/api/handler';
import prisma from '@/lib/db/prisma';
import { getAssetBuffer } from '@/lib/storage';

export const POST = withApi(
  async (request: Request) => {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body', success: false }, { status: 400 });
    }

    const personaId = body.personaId as string | undefined;
    if (!personaId || typeof personaId !== 'string') {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    const persona = await getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
    }

    // 409 Gate: Persona must have locked face status
    if (persona.faceStatus !== 'locked') {
      return NextResponse.json(
        {
          error: 'Face must be locked before generating visual views. Please generate and lock a face card first.',
          code: 'FACE_NOT_LOCKED',
          success: false,
        },
        { status: 409 }
      );
    }

    // Parse options with persona-specific defaults
    let personaConfig: Partial<VisualModelOptions> = {};
    try {
      if (persona.visualModelConfig) {
        personaConfig = JSON.parse(persona.visualModelConfig);
      }
    } catch {
      // ignore
    }

    const ethnicity =
      (body.ethnicity as VisualModelOptions['ethnicity']) ||
      personaConfig.ethnicity ||
      'south_indian';

    const options: VisualModelOptions = {
      ethnicity,
      ethnicityCustom: (body.ethnicityCustom as string) || personaConfig.ethnicityCustom,
      styleLook: (body.styleLook as VisualModelOptions['styleLook']) || personaConfig.styleLook || 'minimal_studio',
      bodyStructure: (body.bodyStructure as VisualModelOptions['bodyStructure']) || personaConfig.bodyStructure || 'hourglass',
      facialFeatures: (body.facialFeatures as string) || personaConfig.facialFeatures,
      hairStyle: (body.hairStyle as string) || personaConfig.hairStyle,
      lighting: (body.lighting as string) || personaConfig.lighting,
      shotType: (body.shotType as VisualModelOptions['shotType']) || personaConfig.shotType || 'portrait',
      additionalPrompt: (body.additionalPrompt as string) || personaConfig.additionalPrompt,
      referenceImageUrl: undefined, // Never inherit stale reference image
      cameraAngle: (body.cameraAngle as VisualModelOptions['cameraAngle']) || 'front',
      faceCard: (body.faceCard as VisualModelOptions['faceCard']) || personaConfig.faceCard,
      dimple: (body.dimple as VisualModelOptions['dimple']) || personaConfig.dimple,
      skinTone: (body.skinTone as VisualModelOptions['skinTone']) || personaConfig.skinTone,
      distinctiveMarks: (body.distinctiveMarks as VisualModelOptions['distinctiveMarks']) || personaConfig.distinctiveMarks,
      bodyProportions: (body.bodyProportions as VisualModelOptions['bodyProportions']) || personaConfig.bodyProportions,
      tattoos: (body.tattoos as VisualModelOptions['tattoos']) || personaConfig.tattoos,
      hairStyling: (body.hairStyling as VisualModelOptions['hairStyling']) || personaConfig.hairStyling,
      isFaceLocked: true,
      lockedFaceUrl: persona.avatarUrl || personaConfig.lockedFaceUrl,
    };

    // Load reference bytes from persona's locked face and body assets (max 3 references)
    const referenceAssets = [];
    if (persona.faceAssetId) {
      const faceAsset = await prisma.asset.findUnique({ where: { id: persona.faceAssetId } });
      if (faceAsset) referenceAssets.push(faceAsset);
    }
    if (persona.bodyAssetId) {
      const bodyAsset = await prisma.asset.findUnique({ where: { id: persona.bodyAssetId } });
      if (bodyAsset) referenceAssets.push(bodyAsset);
    }

    const referenceBuffers: { mimeType: string; buffer: Buffer }[] = [];
    for (const refAsset of referenceAssets.slice(0, 3)) {
      try {
        const buf = await getAssetBuffer(refAsset);
        referenceBuffers.push({ mimeType: 'image/jpeg', buffer: buf });
      } catch (err) {
        console.warn(`Could not load reference asset ${refAsset.id}:`, err);
      }
    }

    const result = await generatePersonaVisual({
      personaId: persona.id,
      options,
      personaName: (body.personaName as string) || persona.name,
      adultAge: (body.adultAge as number) || persona.adultAge,
      referenceBuffers,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  },
  { permission: 'manage_persona' },
);

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
    }

    const persona = await getPersonaById(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
    }

    if (persona.faceStatus !== 'locked') {
      return NextResponse.json(
        {
          error: 'Face must be locked to access visual views. Please generate and lock a face card first.',
          code: 'FACE_NOT_LOCKED',
          success: false,
        },
        { status: 409 }
      );
    }

    const views = await prisma.asset.findMany({
      where: {
        personaId: persona.id,
        kind: 'view',
      },
      orderBy: { createdAt: 'desc' },
    });

    const lockedFace = persona.faceAssetId
      ? await prisma.asset.findUnique({ where: { id: persona.faceAssetId } })
      : null;

    const lockedBody = persona.bodyAssetId
      ? await prisma.asset.findUnique({ where: { id: persona.bodyAssetId } })
      : null;

    return NextResponse.json({
      success: true,
      personaId: persona.id,
      faceStatus: persona.faceStatus,
      faceAsset: lockedFace,
      bodyAsset: lockedBody,
      views,
    });
  },
  { permission: 'manage_persona' },
);
