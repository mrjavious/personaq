import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';
import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { VisualGenerationError } from '@/lib/persona/visual-types';
import { processMediaImage } from '@/lib/media/processor';
import { storage, getAssetBuffer } from '@/lib/storage';

export const POST = withApi(
  async (request: Request) => {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const {
      personaId,
      mediaType = 'image',
      prompt,
      aspectRatio = '1:1',
      cameraAngle = 'front',
      sceneSetting = 'studio',
      referenceContentUrl,
      reimagineMode = false,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Generation prompt is required' }, { status: 400 });
    }

    // Safety guardrails: block prohibited minor keywords with word-boundary matching
    const forbiddenKeywords = ['minor', 'child', 'underage', 'teen', 'kid', 'schoolgirl'];
    if (forbiddenKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt))) {
      return NextResponse.json(
        { error: 'Guardrail violation: Prompt contains prohibited minor keywords.' },
        { status: 400 }
      );
    }

    // Fetch persona strictly by personaId (no active-persona fallback)
    if (!personaId || typeof personaId !== 'string') {
      return NextResponse.json({ error: 'personaId is required' }, { status: 400 });
    }
    const targetPersona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!targetPersona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // 409 Gate: Persona must have locked face status
    if (targetPersona.faceStatus !== 'locked') {
      return NextResponse.json(
        {
          error: 'Face must be locked before generating content. Please generate and lock a face card first.',
          code: 'FACE_NOT_LOCKED',
          success: false,
        },
        { status: 409 }
      );
    }

    const timestamp = Date.now();

    let parsedConfig: Record<string, unknown> = {};
    try {
      if (targetPersona.visualModelConfig) {
        parsedConfig = JSON.parse(targetPersona.visualModelConfig);
      }
    } catch {
      // Ignore JSON parse error
    }

    const ethnicity = (parsedConfig.ethnicity as string) || 'south_indian';

    if (mediaType === 'video') {
      throw new VisualGenerationError(
        'PROVIDER_UNAVAILABLE',
        'Video generation provider is not configured. Set a supported video provider in your environment.',
        503
      );
    }

    // IMAGE GENERATION
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length <= 5) {
      throw new VisualGenerationError(
        'PROVIDER_UNAVAILABLE',
        'No cloud visual generation provider configured. Set GEMINI_API_KEY in your environment to generate content.',
        503
      );
    }

    const anchorDirective = `\n\nIdentity Anchor: Maintain strict facial similarity, bone structure, and distinctive identity markers to the persona's approved reference (${targetPersona.name}, age ${targetPersona.adultAge}).`;
    const fullPrompt = `${prompt}\nStyle & Setting: ${sceneSetting}, camera angle: ${cameraAngle}.${anchorDirective}`;

    // Load reference bytes from persona's locked face and body assets (max 3 references)
    const referenceAssets = [];
    if (targetPersona.faceAssetId) {
      const faceAsset = await prisma.asset.findUnique({ where: { id: targetPersona.faceAssetId } });
      if (faceAsset) referenceAssets.push(faceAsset);
    }
    if (targetPersona.bodyAssetId) {
      const bodyAsset = await prisma.asset.findUnique({ where: { id: targetPersona.bodyAssetId } });
      if (bodyAsset) referenceAssets.push(bodyAsset);
    }

    const referenceParts: { inlineData: { mimeType: string; data: string } }[] = [];
    for (const refAsset of referenceAssets.slice(0, 3)) {
      try {
        const buf = await getAssetBuffer(refAsset);
        referenceParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: buf.toString('base64'),
          },
        });
      } catch (err) {
        console.warn(`Could not load reference asset ${refAsset.id}:`, err);
      }
    }

    let imageBuffer: Buffer | null = null;
    let lastError: Error | null = null;
    const client = new GoogleGenAI({ apiKey });

    const contents = [
      fullPrompt,
      ...referenceParts,
    ];

    try {
      const genResult = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents,
      });

      const parts = genResult.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const p of parts) {
          if (p.inlineData?.data) {
            imageBuffer = Buffer.from(p.inlineData.data, 'base64');
            break;
          }
        }
      }
    } catch (err) {
      lastError = err as Error;
    }

    if (!imageBuffer) {
      try {
        const imageResult = await client.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: fullPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio:
              aspectRatio === '9:16' ||
              aspectRatio === '16:9' ||
              aspectRatio === '4:3' ||
              aspectRatio === '3:4'
                ? aspectRatio
                : '1:1',
            personGeneration: PersonGeneration.ALLOW_ADULT,
          },
        });

        const base64Data = imageResult.generatedImages?.[0]?.image?.imageBytes;
        if (base64Data) {
          imageBuffer = Buffer.from(base64Data, 'base64');
        }
      } catch (err) {
        lastError = err as Error;
      }
    }

    if (!imageBuffer) {
      throw new VisualGenerationError(
        'GEN_UPSTREAM_ERROR',
        `Cloud visual generation failed: ${lastError?.message || 'Upstream provider returned no image data'}`,
        502
      );
    }

    // Safety Gate Pipeline
    const imageSafetyResult = await runSafetyGatePipeline({
      buffer: imageBuffer,
      metadata: {
        prompt,
        tags: ['persona_content', 'image', targetPersona.name, String(cameraAngle), String(sceneSetting)],
        suitability: 'sfw_safe',
      },
    });

    if (imageSafetyResult.status === 'blocked') {
      throw new VisualGenerationError(
        'SAFETY_BLOCKED',
        `Content generation blocked by safety gate: ${imageSafetyResult.reasons.join(', ')}`,
        422,
        imageSafetyResult.reasons
      );
    }

    // Process media: EXIF stripping, 400px thumbnail, cryptographic SHA-256 manifest
    const processed = await processMediaImage(imageBuffer, targetPersona.id);
    const storageKey = `personas/${targetPersona.id}/content_${timestamp}.jpg`;
    const thumbKey = `personas/${targetPersona.id}/thumb_content_${timestamp}.jpg`;
    const sha256 = processed.contentHashSha256;

    // Upload directly to storage (no manual public/uploads disk writes)
    const [uploadRes, thumbRes] = await Promise.all([
      storage.upload(processed.optimizedBuffer, storageKey, 'image/jpeg'),
      storage.upload(processed.thumbnailBuffer, thumbKey, 'image/jpeg'),
    ]);

    const imageUrl = uploadRes.url;
    const thumbUrl = thumbRes.url;

    // Record in Asset Library
    const asset = await prisma.asset.create({
      data: {
        personaId: targetPersona.id,
        storageKey,
        url: imageUrl,
        type: 'image',
        kind: 'content',
        parentAssetId: targetPersona.faceAssetId || undefined,
        suitability: 'sfw_safe',
        aiGenerated: true,
        tags: JSON.stringify([
          'persona_content',
          'image',
          targetPersona.name,
          cameraAngle,
          aspectRatio,
          sceneSetting,
        ]),
        provenanceMeta: JSON.stringify({
          ai_generated: true,
          media_type: 'image',
          camera_angle: cameraAngle,
          aspect_ratio: aspectRatio,
          prompt,
          ethnicity,
          reimagine_mode: reimagineMode,
          reference_content_url: referenceContentUrl || null,
          persona_name: targetPersona.name,
          sha256,
          created_at: new Date().toISOString(),
        }),
        safetyStatus: imageSafetyResult.status,
        safetyReasons: JSON.stringify(imageSafetyResult.reasons),
      },
    });

    await logAuditEvent({
      action: 'publish',
      entity: 'Asset',
      entityId: asset.id,
      meta: { type: 'persona_image_generated', prompt, cameraAngle, aspectRatio },
    });

    return NextResponse.json({
      success: true,
      asset,
      mediaUrl: imageUrl,
      thumbnailUrl: thumbUrl,
      type: 'image',
      prompt,
      metadata: {
        aspectRatio,
        cameraAngle,
        sceneSetting,
        sha256,
      },
    });
  },
  { permission: 'manage_persona' },
);

export const GET = withApi(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const personaIdParam = searchParams.get('personaId');

  if (!personaIdParam) {
    return NextResponse.json({ error: 'personaId is required', success: false }, { status: 400 });
  }

  const persona = await prisma.persona.findUnique({ where: { id: personaIdParam } });
  if (!persona) {
    return NextResponse.json({ error: 'Persona not found', success: false }, { status: 404 });
  }

  if (persona.faceStatus !== 'locked') {
    return NextResponse.json(
      {
        error: 'Face must be locked before accessing content. Please generate and lock a face card first.',
        code: 'FACE_NOT_LOCKED',
        success: false,
      },
      { status: 409 }
    );
  }

  const assets = await prisma.asset.findMany({
    where: {
      personaId: persona.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({
    success: true,
    personaId: persona.id,
    personaName: persona.name,
    avatarUrl: persona.avatarUrl,
    assets,
  });
});
