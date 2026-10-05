import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { withApi } from '@/lib/api/handler';
import { getImageProvider, ImageProviderError } from '@/lib/ai/image-provider';
import { getVideoProvider } from '@/lib/ai/video-provider';
import { VisualGenerationError } from '@/lib/persona/visual-types';
import { processMediaImage } from '@/lib/media/processor';
import { storage, getAssetBuffer } from '@/lib/storage';
import { assertWithinBudget, recordUsage } from '@/lib/ai/budget';
import { evaluateConsistency } from '@/lib/persona/consistency';

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
      const videoProvider = getVideoProvider();
      if (!(await videoProvider.isAvailable())) {
        throw new VisualGenerationError(
          'PROVIDER_UNAVAILABLE',
          'Video generation provider is not configured. Set a supported video provider in your environment.',
          503
        );
      }

      await assertWithinBudget(0.08);
      const vidResult = await videoProvider.generateVideo({
        prompt,
        referenceImageUrl: targetPersona.avatarUrl || undefined,
        aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16',
        cameraMovement: String(cameraAngle),
        personaId: targetPersona.id,
      });

      if (!vidResult.buffer) {
        throw new VisualGenerationError(
          'GEN_UPSTREAM_ERROR',
          'Video generation provider returned no video output',
          502
        );
      }

      const videoKey = `personas/${targetPersona.id}/content/video_${timestamp}.mp4`;
      const uploadRes = await storage.upload(vidResult.buffer, videoKey, 'video/mp4');

      const videoAsset = await prisma.asset.create({
        data: {
          personaId: targetPersona.id,
          storageKey: videoKey,
          url: uploadRes.url,
          type: 'video',
          kind: 'content_video',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          safetyReasons: JSON.stringify([]),
          tags: JSON.stringify(['persona_content', 'video', targetPersona.name]),
          provenanceMeta: JSON.stringify({
            prompt,
            cameraAngle,
            sceneSetting,
            modelUsed: vidResult.model,
            provider: vidResult.provider,
            generatedAt: new Date().toISOString(),
          }),
        },
      });

      await recordUsage({
        provider: vidResult.provider,
        model: vidResult.model,
        kind: 'video',
        estimatedCost: vidResult.estimatedCost,
        personaId: targetPersona.id,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        asset: videoAsset,
        mediaType: 'video',
        contentUrl: uploadRes.url,
      });
    }

    // IMAGE GENERATION
    await assertWithinBudget(0.04);
    const provider = getImageProvider();
    if (!(await provider.isAvailable())) {
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

    const referenceImages: { mimeType: string; buffer: Buffer }[] = [];
    for (const refAsset of referenceAssets.slice(0, 3)) {
      try {
        const buf = await getAssetBuffer(refAsset);
        referenceImages.push({
          mimeType: 'image/jpeg',
          buffer: buf,
        });
      } catch (err) {
        console.warn(`Could not load reference asset ${refAsset.id}:`, err);
      }
    }

    let imageBuffer: Buffer;
    let modelUsed: string;

    try {
      const genResult = await provider.generateImage({
        prompt: fullPrompt,
        aspectRatio:
          aspectRatio === '9:16' ||
          aspectRatio === '16:9' ||
          aspectRatio === '4:3' ||
          aspectRatio === '3:4'
            ? (aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4')
            : '1:1',
        referenceImages,
        personaId: targetPersona.id,
      });
      imageBuffer = genResult.buffer;
      modelUsed = genResult.model;
    } catch (err) {
      if (err instanceof ImageProviderError) {
        if (err.code === 'quota') {
          throw new VisualGenerationError(
            'PROVIDER_UNAVAILABLE',
            err.message,
            429
          );
        }
        if (err.code === 'not_configured') {
          throw new VisualGenerationError(
            'PROVIDER_UNAVAILABLE',
            'No cloud visual generation provider configured. Set GEMINI_API_KEY in your environment to generate content.',
            503
          );
        }
        throw new VisualGenerationError(
          'GEN_UPSTREAM_ERROR',
          `Visual generation failed: ${err.message}`,
          502
        );
      }
      throw err;
    }

    await recordUsage({
      provider: provider.name,
      model: modelUsed,
      kind: 'image',
      estimatedCost: 0.04,
      personaId: targetPersona.id,
    }).catch(() => {});


    // Biometric identity consistency check against locked face
    let consistencyData: {
      score: number;
      reasons: string[];
      passed: boolean;
      status: string;
      minThreshold: number;
    } | null = null;
    if (referenceAssets[0]) {
      try {
        const faceBuffer = await getAssetBuffer(referenceAssets[0]);
        const evalRes = await evaluateConsistency(faceBuffer, imageBuffer, { personaId: targetPersona.id });
        consistencyData = {
          score: evalRes.score,
          reasons: evalRes.reasons,
          passed: evalRes.passed,
          status: evalRes.status,
          minThreshold: evalRes.minThreshold,
        };
      } catch (cErr) {
        console.warn('Failed evaluating content consistency:', cErr);
      }
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
          consistency: consistencyData,
          created_at: new Date().toISOString(),
        }),
        safetyStatus:
          consistencyData && !consistencyData.passed
            ? 'needs_manual_review'
            : imageSafetyResult.status,
        safetyReasons: JSON.stringify(
          consistencyData && !consistencyData.passed
            ? [
                ...imageSafetyResult.reasons,
                `Biometric consistency drifted (${consistencyData.score}/${consistencyData.minThreshold}): ${consistencyData.reasons.join('; ')}`,
              ]
            : imageSafetyResult.reasons
        ),
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
