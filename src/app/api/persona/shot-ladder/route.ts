import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { withApi } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/error';
import { getImageProvider, ImageProviderError } from '@/lib/ai/image-provider';
import { assertWithinBudget, recordUsage } from '@/lib/ai/budget';
import { evaluateConsistency } from '@/lib/persona/consistency';
import { buildShotPrompt, buildVideoPromptForAsset } from '@/lib/persona/shot-prompt';
import { seedShotTemplates } from '@/lib/persona/shot-templates';
import { storage, getAssetBuffer } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { z } from 'zod';

const shotLadderSchema = z.object({
  personaId: z.string().min(1),
  sceneSetId: z.string().min(1),
  action: z.string().optional(),
  expression: z.string().optional(),
});

export const GET = withApi(
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    // Ensure templates exist
    let templates = await prisma.shotTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (templates.length === 0) {
      templates = await seedShotTemplates(prisma);
    }

    if (!personaId) {
      return NextResponse.json({ templates });
    }

    const ladderAssets = await prisma.asset.findMany({
      where: {
        personaId,
        tags: { contains: 'shot_ladder' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ templates, assets: ladderAssets });
  },
  { permission: 'manage_persona' }
);

export const POST = withApi(
  async (request: Request) => {
    const body = await request.json().catch(() => ({}));
    const { personaId, sceneSetId, action, expression } = shotLadderSchema.parse(body);

    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      throw new ApiError('PERSONA_NOT_FOUND', 'Persona not found', 404);
    }

    // 1. Mandatory 409 Lock Gate: Persona face must be locked
    if (persona.faceStatus !== 'locked' || !persona.faceAssetId) {
      throw new ApiError(
        'FACE_NOT_LOCKED',
        'Persona face must be locked before generating a shot ladder.',
        409
      );
    }

    // 2. Validate SceneSet belongs to this persona
    const sceneSet = await prisma.sceneSet.findFirst({
      where: { id: sceneSetId, personaId },
    });

    if (!sceneSet) {
      throw new ApiError('SCENE_SET_NOT_FOUND', 'Scene set not found for this persona', 404);
    }

    // 3. Ensure templates are seeded and select portrait -> action -> full_body
    let templates = await prisma.shotTemplate.findMany();
    if (templates.length === 0) {
      templates = await seedShotTemplates(prisma);
    }

    const portraitTemplate =
      templates.find((t) => t.kind === 'portrait') || templates[0];
    const actionTemplate =
      templates.find((t) => t.kind === 'action') || templates[1] || templates[0];
    const fullBodyTemplate =
      templates.find((t) => t.kind === 'full_body') || templates[2] || templates[0];

    const ladderSteps = [
      { step: 'portrait', template: portraitTemplate },
      { step: 'action', template: actionTemplate },
      { step: 'full_body', template: fullBodyTemplate },
    ];

    // 4. Load locked reference bytes (capped at 3 references)
    const referenceAssets = [];
    const faceAsset = await prisma.asset.findUnique({ where: { id: persona.faceAssetId } });
    if (faceAsset) referenceAssets.push(faceAsset);

    if (persona.bodyAssetId) {
      const bodyAsset = await prisma.asset.findUnique({ where: { id: persona.bodyAssetId } });
      if (bodyAsset) referenceAssets.push(bodyAsset);
    }

    const referenceBuffers: { buffer: Buffer; mimeType: string }[] = [];
    for (const ref of referenceAssets.slice(0, 3)) {
      try {
        const buf = await getAssetBuffer(ref);
        referenceBuffers.push({ buffer: buf, mimeType: 'image/jpeg' });
      } catch (err) {
        console.warn(`Could not load reference asset ${ref.id}:`, err);
      }
    }

    if (referenceBuffers.length === 0) {
      throw new ApiError('REFERENCE_NOT_FOUND', 'Could not load canonical locked face reference bytes', 500);
    }

    const lockedFaceBuffer = referenceBuffers[0].buffer;

    // 5. Budget verification for the 3 ladder jobs (0.04 * 3 = 0.12)
    await assertWithinBudget(0.12);

    const provider = getImageProvider();
    if (!(await provider.isAvailable())) {
      throw new ApiError('PROVIDER_UNAVAILABLE', 'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run local ComfyUI.', 503);
    }

    const results = [];

    // 6. Execute shot ladder rungs in sequence: portrait -> action -> full_body
    for (const { step, template } of ladderSteps) {
      const shotPrompt = buildShotPrompt({
        persona: {
          name: persona.name,
          identityText: persona.identityText,
          appearanceNotes: persona.appearanceNotes,
          adultAge: persona.adultAge,
        },
        sceneSet: {
          name: sceneSet.name,
          setText: sceneSet.setText,
          lightingJson: sceneSet.lightingJson,
        },
        template,
        expression,
        action,
      });

      const videoMeta = buildVideoPromptForAsset(template, action);

      let genResult;
      try {
        genResult = await provider.generateImage({
          prompt: shotPrompt.prompt,
          negativePrompt: shotPrompt.negativePrompt,
          aspectRatio: (template.aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4') || '1:1',
          referenceImages: referenceBuffers.slice(0, 3),
          personaId: persona.id,
        });
      } catch (err) {
        if (err instanceof ImageProviderError) {
          throw new ApiError('GENERATION_ERROR', `Generation failed for step ${step}: ${err.message}`, 502);
        }
        throw err;
      }

      await recordUsage({
        provider: genResult.provider,
        model: genResult.model,
        kind: 'image',
        estimatedCost: genResult.estimatedCost,
        personaId: persona.id,
      }).catch(() => {});

      // Biometric consistency evaluation
      const consistency = await evaluateConsistency(lockedFaceBuffer, genResult.buffer, {
        personaId: persona.id,
      });

      // Safety Gate Pipeline check
      const safetyResult = await runSafetyGatePipeline({
        buffer: genResult.buffer,
        metadata: {
          prompt: shotPrompt.prompt,
          tags: ['shot_ladder', step, template.name, sceneSet.name],
          suitability: 'sfw_safe',
        },
      });

      // Process media & storage upload
      const timestamp = Date.now();
      const processed = await processMediaImage(genResult.buffer, persona.id);
      const storageKey = `personas/${persona.id}/ladder_${step}_${timestamp}.jpg`;
      const thumbKey = `personas/${persona.id}/thumb_ladder_${step}_${timestamp}.jpg`;

      const [uploadRes] = await Promise.all([
        storage.upload(processed.optimizedBuffer, storageKey, 'image/jpeg'),
        storage.upload(processed.thumbnailBuffer, thumbKey, 'image/jpeg'),
      ]);

      const finalSafetyStatus = !consistency.passed ? 'needs_manual_review' : safetyResult.status;
      const finalSafetyReasons = !consistency.passed
        ? [
            ...safetyResult.reasons,
            `Biometric consistency drifted (${consistency.score}/${consistency.minThreshold}): ${consistency.reasons.join('; ')}`,
          ]
        : safetyResult.reasons;

      const asset = await prisma.asset.create({
        data: {
          personaId: persona.id,
          storageKey,
          url: uploadRes.url,
          type: 'image',
          kind: 'content',
          parentAssetId: persona.faceAssetId,
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: finalSafetyStatus,
          safetyReasons: JSON.stringify(finalSafetyReasons),
          tags: JSON.stringify(['shot_ladder', step, template.name, sceneSet.name]),
          videoPrompt: videoMeta.videoPrompt,
          beatsJson: JSON.stringify(videoMeta.beats),
          provenanceMeta: JSON.stringify({
            ladderStep: step,
            templateName: template.name,
            sceneSetName: sceneSet.name,
            consistency,
            videoPrompt: videoMeta.videoPrompt,
            beats: videoMeta.beats,
            contentHashSha256: processed.contentHashSha256,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      await logAuditEvent({
        action: 'publish',
        entity: 'Asset',
        entityId: asset.id,
        meta: {
          event: 'shot_ladder_generated',
          step,
          consistencyScore: consistency.score,
          template: template.name,
        },
      });

      results.push({
        step,
        templateName: template.name,
        asset,
        consistency,
        videoMeta,
      });
    }

    return NextResponse.json({
      success: true,
      sceneSet: sceneSet.name,
      results,
    });
  },
  { permission: 'manage_persona' }
);
