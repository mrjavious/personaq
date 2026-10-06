import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import sharp from 'sharp';
import { getImageProvider, ImageProviderError } from '@/lib/ai/image-provider';
import { assertWithinBudget, recordUsage } from '@/lib/ai/budget';
import { evaluateConsistency } from './consistency';
sharp.cache(false);
export * from './visual-types';
import { VisualModelOptions, buildVisualModelPrompt, formatPhysicalDNASummary, PersonaAngleItem, VisualGenerationError } from './visual-types';

/**
 * Returns available multi-angle reference portraits for an ethnicity / persona / style.
 * By default returns the 5 views: Front, Side, Full view, Full Back view, Full Side view.
 */
export function getPersonaMultiAnglePack(
  _ethnicity: string = 'south_indian',
  _personaId?: string,
  _styleLook: string = 'minimal_studio',
  activeAvatarUrl?: string | null
): PersonaAngleItem[] {
  void _ethnicity;
  void _personaId;
  void _styleLook;
  const frontUrl = activeAvatarUrl || '';
  return [
    { angle: 'front', label: 'Front', url: frontUrl },
    { angle: 'side', label: 'Side', url: '' },
    { angle: 'full_body', label: 'Full view', url: '' },
    { angle: 'full_back', label: 'Full Back view', url: '' },
    { angle: 'full_side', label: 'Full Side view', url: '' },
  ];
}

/**
 * Loads multi-angle reference views for a persona strictly from the database.
 */
export async function getPersonaViewsFromDb(personaId: string): Promise<PersonaAngleItem[]> {
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
  });

  const views = await prisma.asset.findMany({
    where: {
      personaId,
      kind: 'view',
    },
    orderBy: { createdAt: 'desc' },
  });

  const angleMap: Record<string, string> = {};
  for (const v of views) {
    try {
      const meta = v.provenanceMeta ? JSON.parse(v.provenanceMeta) : {};
      const angle = meta.angle;
      if (angle && !angleMap[angle]) {
        angleMap[angle] = v.url || '';
      }
    } catch {
      // ignore JSON parse error
    }
  }

  const frontUrl = angleMap['front'] || persona?.avatarUrl || '';

  return [
    { angle: 'front', label: 'Front', url: frontUrl },
    { angle: 'side', label: 'Side', url: angleMap['side'] || '' },
    { angle: 'full_body', label: 'Full view', url: angleMap['full_body'] || '' },
    { angle: 'full_back', label: 'Full Back view', url: angleMap['full_back'] || '' },
    { angle: 'full_side', label: 'Full Side view', url: angleMap['full_side'] || '' },
  ];
}

/**
 * Generates the persona visual model image using the active ImageProvider.
 */
export async function generatePersonaVisual(input: {
  personaId: string;
  options: VisualModelOptions;
  personaName: string;
  adultAge: number;
  referenceBuffers?: { mimeType: string; buffer: Buffer }[];
}): Promise<{
  imageUrl: string;
  thumbnailUrl: string;
  provenanceHash: string;
  prompt: string;
  modelUsed: string;
  config: VisualModelOptions;
  asset?: { id: string; url: string | null; kind: string };
  multiAnglePack?: PersonaAngleItem[];
}> {
  // Requirement: Front is the locked card itself; do not regenerate it
  if (input.options.cameraAngle === 'front') {
    const persona = await prisma.persona.findUnique({
      where: { id: input.personaId },
    });
    if (persona?.faceAssetId) {
      const lockedFaceAsset = await prisma.asset.findUnique({
        where: { id: persona.faceAssetId },
      });
      if (lockedFaceAsset) {
        const multiAnglePack = await getPersonaViewsFromDb(input.personaId);
        return {
          imageUrl: lockedFaceAsset.url || '',
          thumbnailUrl: lockedFaceAsset.url || '',
          provenanceHash: '',
          prompt: 'Locked front face card master reference',
          modelUsed: 'locked-face-reference',
          config: input.options,
          asset: lockedFaceAsset,
          multiAnglePack,
        };
      }
    }
  }

  const { prompt } = buildVisualModelPrompt(
    input.options,
    input.personaName,
    input.adultAge
  );

  // If face is locked, append identity anchor instruction to prompt
  const fullPrompt = input.options.isFaceLocked && input.options.lockedFaceUrl
    ? `${prompt}\n\nIdentity Anchor: Maintain strict facial similarity, bone structure, and distinctive identity markers to the persona's approved reference.`
    : prompt;

  // 1. Budget gate check
  await assertWithinBudget(0.04);

  // 2. Validate ImageProvider availability
  const provider = getImageProvider();
  if (!(await provider.isAvailable())) {
    throw new VisualGenerationError(
      'PROVIDER_UNAVAILABLE',
      'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run a local ComfyUI worker.',
      503
    );
  }

  // 3. Enforce reference-capable provider when synthesizing views using reference images
  if (input.referenceBuffers && input.referenceBuffers.length > 0 && !provider.capabilities.referenceImage) {
    throw new VisualGenerationError(
      'PROVIDER_UNSUPPORTED',
      'The active image provider does not support reference-image editing required for multi-angle perspective synthesis. Configure POLLINATIONS_API_KEY or a reference-capable provider.',
      501
    );
  }

  let genResult;
  try {
    genResult = await provider.generateImage({
      prompt: fullPrompt,
      aspectRatio: '1:1',
      referenceImages: input.referenceBuffers?.slice(0, 3),
      personaId: input.personaId,
    });
  } catch (err: unknown) {
    if (err instanceof ImageProviderError) {
      if (err.code === 'not_configured') {
        throw new VisualGenerationError('PROVIDER_UNAVAILABLE', err.message, 503);
      }
      if (err.code === 'unsupported') {
        throw new VisualGenerationError('PROVIDER_UNSUPPORTED', err.message, 501);
      }
      if (err.code === 'blocked') {
        throw new VisualGenerationError('SAFETY_BLOCKED', err.message, 422);
      }
      throw new VisualGenerationError('GEN_UPSTREAM_ERROR', err.message, 502);
    }
    throw new VisualGenerationError(
      'GEN_UPSTREAM_ERROR',
      (err as Error)?.message || 'Generation failed',
      502
    );
  }

  let imageBuffer = genResult.buffer;
  let modelUsed = genResult.model;

  // Record initial generation usage
  await recordUsage({
    provider: genResult.provider,
    model: genResult.model,
    kind: 'image',
    estimatedCost: genResult.estimatedCost,
    personaId: input.personaId,
  }).catch(() => {});

  // 3. Biometric identity consistency check (when locked face reference is provided)
  let consistencyData: {
    score: number;
    reasons: string[];
    passed: boolean;
    status: 'consistent' | 'drifted — regenerate';
    minThreshold: number;
    attempts: Array<{
      attempt: number;
      score: number;
      reasons: string[];
      passed: boolean;
      status: 'consistent' | 'drifted — regenerate';
      timestamp: string;
    }>;
  } | null = null;

  if (input.referenceBuffers && input.referenceBuffers.length > 0) {
    const lockedFaceBuf = input.referenceBuffers[0].buffer;
    let evalRes = await evaluateConsistency(lockedFaceBuf, imageBuffer, { personaId: input.personaId });
    const attempts = [
      {
        attempt: 1,
        score: evalRes.score,
        reasons: evalRes.reasons,
        passed: evalRes.passed,
        status: evalRes.status,
        timestamp: new Date().toISOString(),
      },
    ];

    // At most one auto-retry if consistency is below threshold
    if (!evalRes.passed) {
      try {
        const retryGen = await provider.generateImage({
          prompt: fullPrompt,
          aspectRatio: '1:1',
          referenceImages: input.referenceBuffers.slice(0, 3),
          personaId: input.personaId,
        });

        await recordUsage({
          provider: retryGen.provider,
          model: retryGen.model,
          kind: 'image',
          estimatedCost: retryGen.estimatedCost,
          personaId: input.personaId,
        }).catch(() => {});

        const evalRetry = await evaluateConsistency(lockedFaceBuf, retryGen.buffer, { personaId: input.personaId });
        attempts.push({
          attempt: 2,
          score: evalRetry.score,
          reasons: evalRetry.reasons,
          passed: evalRetry.passed,
          status: evalRetry.status,
          timestamp: new Date().toISOString(),
        });

        if (evalRetry.score >= evalRes.score) {
          imageBuffer = retryGen.buffer;
          modelUsed = retryGen.model;
          evalRes = evalRetry;
        }
      } catch (retryErr) {
        console.warn('Consistency auto-retry generation failed; keeping attempt 1:', retryErr);
      }
    }

    consistencyData = {
      score: evalRes.score,
      reasons: evalRes.reasons,
      passed: evalRes.passed,
      status: evalRes.status,
      minThreshold: evalRes.minThreshold ?? 70,
      attempts,
    };
  }

  // 3. Safety Gate Pipeline Check: Run generated output through safety gate
  const safetyResult = await runSafetyGatePipeline({
    buffer: imageBuffer,
    metadata: {
      prompt: fullPrompt,
      tags: ['persona_visual_model', input.options.ethnicity || 'custom', input.options.styleLook || 'minimal_studio'],
      suitability: 'sfw_safe',
      adultAge: input.adultAge,
    },
  });

  if (safetyResult.status === 'blocked') {
    throw new VisualGenerationError(
      'SAFETY_BLOCKED',
      `Generated visual model blocked by safety gate: ${safetyResult.reasons.join(', ')}`,
      422,
      safetyResult.reasons
    );
  }

  // 4. Process media: EXIF stripping, 400px thumbnail, cryptographic SHA-256 manifest
  const processed = await processMediaImage(imageBuffer, input.personaId);

  // 5. Upload to storage as standard JPEG
  const timestamp = Date.now();
  const fileExt = processed.format === 'png' ? 'png' : 'jpg';
  const mimeType = processed.format === 'png' ? 'image/png' : 'image/jpeg';
  const storageKey = `personas/${input.personaId}/visual_${timestamp}.${fileExt}`;
  const thumbKey = `personas/${input.personaId}/thumb_${timestamp}.jpg`;

  const [uploadRes, thumbRes] = await Promise.all([
    storage.upload(
      processed.optimizedBuffer,
      storageKey,
      mimeType
    ),
    storage.upload(
      processed.thumbnailBuffer,
      thumbKey,
      'image/jpeg'
    ),
  ]);

  // 6. Record generated view in Asset table (never write to public/uploads disk)
  const persona = await prisma.persona.findUnique({
    where: { id: input.personaId },
  });

  const angle = input.options.cameraAngle || 'front';
  const finalSafetyStatus =
    consistencyData && !consistencyData.passed ? 'needs_manual_review' : safetyResult.status;

  const finalSafetyReasons =
    consistencyData && !consistencyData.passed
      ? [
          ...safetyResult.reasons,
          `Biometric consistency drifted (${consistencyData.score}/${consistencyData.minThreshold}): ${consistencyData.reasons.join('; ')}`,
        ]
      : safetyResult.reasons;

  const viewAsset = await prisma.asset.create({
    data: {
      personaId: input.personaId,
      storageKey,
      url: uploadRes.url,
      type: 'image',
      kind: 'view',
      parentAssetId: persona?.faceAssetId || undefined,
      suitability: 'sfw_safe',
      aiGenerated: true,
      safetyStatus: finalSafetyStatus,
      safetyReasons: JSON.stringify(finalSafetyReasons),
      tags: JSON.stringify(['persona_view', angle, input.personaName]),
      provenanceMeta: JSON.stringify({
        angle,
        provider: genResult.provider,
        model: genResult.model,
        modelUsed,
        seed: genResult.seed,
        prompt: genResult.prompt || prompt,
        parentFaceAssetId: persona?.faceAssetId || null,
        contentHashSha256: processed.contentHashSha256,
        options: input.options,
        consistency: consistencyData,
        createdAt: new Date().toISOString(),
      }),
    },
  });

  const multiAnglePack = await getPersonaViewsFromDb(input.personaId);

  return {
    imageUrl: uploadRes.url,
    thumbnailUrl: thumbRes.url,
    provenanceHash: processed.contentHashSha256,
    prompt,
    modelUsed,
    config: input.options,
    asset: viewAsset,
    multiAnglePack,
  };
}

/**
 * Marks the selected generated image as the authoritative Visual Model for the persona.
 */
export async function markAsPersonaVisualModel(input: {
  personaId: string;
  imageUrl: string;
  config: VisualModelOptions;
  prompt: string;
  modelUsed?: string;
  userId?: string;
}) {
  const { personaId, imageUrl, config, prompt, modelUsed, userId } = input;

  // 1. Fetch persona
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
  });

  if (!persona) {
    throw new Error('Persona not found');
  }

  // 2. Synthesize updated appearance notes that include the visual model specifics
  const ethnicityTitle =
    config.ethnicity === 'custom'
      ? config.ethnicityCustom || 'Custom'
      : (config.ethnicity || 'south_indian').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const bodyTitle = (config.bodyStructure || 'hourglass').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const dnaSummary = formatPhysicalDNASummary(config);
  const visualSummary = `[Visual Reference Model: ${ethnicityTitle} • ${bodyTitle} Build • Verified Adult AI Identity]\n${dnaSummary}`.trim();

  // Merge with existing appearance notes cleanly, stripping any clothing, attire, or outfit notes
  let baseNotes = persona.appearanceNotes.replace(/\[Visual Reference Model:[\s\S]*?(?=(\n\n|$))/g, '').trim();
  baseNotes = baseNotes
    .replace(/(often wears|wears|wearing|attire|outfit|clothing|fashion|kurtas|techwear|accessories)[\s\S]*?(?=(\.|$))/gi, '')
    .trim();
  const updatedAppearanceNotes = `${visualSummary}\n\n${baseNotes}`.trim();

  // 3. Run Safety Gate Pipeline to stamp compliance
  const safetyResult = await runSafetyGatePipeline({
    metadata: {
      prompt,
      tags: ['persona_model', config.ethnicity, config.styleLook],
      suitability: 'sfw_safe',
    },
  });

  // Create or save as an Asset in Asset Library
  const asset = await prisma.asset.create({
    data: {
      personaId,
      storageKey: imageUrl.replace(/^.*\/uploads\//, ''),
      url: imageUrl,
      type: 'image',
      suitability: 'sfw_safe',
      aiGenerated: true,
      tags: JSON.stringify([
        'persona_model',
        'reference_avatar',
        config.ethnicity,
        config.styleLook,
      ]),
      provenanceMeta: JSON.stringify({
        ai_generated: true,
        model_used: modelUsed || 'flux-1-schnell',
        prompt,
        config,
        marked_at: new Date().toISOString(),
      }),
      safetyStatus: safetyResult.status,
      safetyReasons: JSON.stringify(safetyResult.reasons),
    },
  });

  // 4. Update the Persona record
  const updatedPersona = await prisma.persona.update({
    where: { id: personaId },
    data: {
      avatarUrl: imageUrl,
      appearanceNotes: updatedAppearanceNotes,
      visualModelConfig: JSON.stringify({
        ...config,
        multiAnglePack: getPersonaMultiAnglePack(config.ethnicity, personaId, config.styleLook),
        referenceImageUrl: config.referenceImageUrl || imageUrl,
      }),
    },
    include: {
      platformAccounts: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
      },
    },
  });

  // 5. Version snapshot
  const versionCount = await prisma.personaVersion.count({
    where: { personaId },
  });

  await prisma.personaVersion.create({
    data: {
      personaId,
      versionNumber: versionCount + 1,
      snapshotJson: JSON.stringify({
        ...updatedPersona,
        visualModelAssetId: asset.id,
      }),
      changeSummary: `Updated Persona Visual Model (${ethnicityTitle} - ${bodyTitle})`,
      createdById: userId,
    },
  });

  // 6. Audit Log
  await logAuditEvent({
    userId,
    action: 'persona_update',
    entity: 'Persona',
    entityId: personaId,
    meta: {
      event: 'visual_model_marked',
      ethnicity: config.ethnicity,
      style: config.styleLook,
      assetId: asset.id,
      imageUrl,
    },
  });

  return {
    success: true,
    persona: updatedPersona,
    asset,
  };
}
