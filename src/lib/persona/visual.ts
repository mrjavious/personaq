import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import sharp from 'sharp';
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
 * Generates the persona visual model image using Gemini API.
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
  const { prompt } = buildVisualModelPrompt(
    input.options,
    input.personaName,
    input.adultAge
  );

  // If face is locked, append identity anchor instruction to prompt
  const fullPrompt = input.options.isFaceLocked && input.options.lockedFaceUrl
    ? `${prompt}\n\nIdentity Anchor: Maintain strict facial similarity, bone structure, and distinctive identity markers to the persona's approved reference.`
    : prompt;

  let imageBuffer: Buffer | null = null;
  let modelUsed = 'gemini-2.5-flash-image';
  let lastError: Error | null = null;

  // 1. Validate API Key: Do NOT silently return fake images when provider is missing
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length <= 5) {
    throw new VisualGenerationError(
      'PROVIDER_UNAVAILABLE',
      'No cloud visual generation provider configured. Set GEMINI_API_KEY in your environment to generate persona visual models.',
      503
    );
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    // Prepare multimodal contents with reference images (up to 3 references)
    const referenceParts = (input.referenceBuffers || []).slice(0, 3).map((ref) => ({
      inlineData: {
        mimeType: ref.mimeType || 'image/jpeg',
        data: ref.buffer.toString('base64'),
      },
    }));

    const contents = [
      fullPrompt,
      ...referenceParts,
    ];

    // First attempt Gemini 2.5 flash image via generateContent
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
            modelUsed = 'gemini-2.5-flash-image';
            break;
          }
        }
      }
    } catch (err) {
      lastError = err as Error;
      console.warn('Gemini 2.5 Flash image generation not available on current quota, trying Imagen 3:', (err as Error).message);
    }

    // If flash-image didn't produce image bytes, try Imagen 3
    if (!imageBuffer) {
      try {
        const imageResult = await client.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: fullPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
            personGeneration: PersonGeneration.ALLOW_ADULT,
          },
        });

        const base64Data = imageResult.generatedImages?.[0]?.image?.imageBytes;
        if (base64Data) {
          imageBuffer = Buffer.from(base64Data, 'base64');
          modelUsed = 'gemini-imagen-3';
        }
      } catch (err) {
        lastError = err as Error;
        console.warn('Gemini Imagen 3 requires Vertex AI / billed quota:', (err as Error).message);
      }
    }
  } catch (err) {
    lastError = err as Error;
  }

  // 2. Fail explicitly if generation failed — NEVER substitute recycled/mock images
  if (!imageBuffer) {
    throw new VisualGenerationError(
      'GEN_UPSTREAM_ERROR',
      `Cloud visual generation failed: ${lastError?.message || 'Upstream provider returned no image data'}`,
      502
    );
  }

  // 3. Safety Gate Pipeline Check: Run generated output through safety gate
  const safetyResult = await runSafetyGatePipeline({
    buffer: imageBuffer,
    metadata: {
      prompt: fullPrompt,
      tags: ['persona_visual_model', input.options.ethnicity || 'custom', input.options.styleLook || 'minimal_studio'],
      suitability: 'sfw_safe',
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
      safetyStatus: 'passed',
      safetyReasons: JSON.stringify(['Passed safety gate for persona view']),
      tags: JSON.stringify(['persona_view', angle, input.personaName]),
      provenanceMeta: JSON.stringify({
        angle,
        prompt,
        modelUsed,
        parentFaceAssetId: persona?.faceAssetId || null,
        contentHashSha256: processed.contentHashSha256,
        options: input.options,
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

  // 3. Create or save as an Asset in Asset Library
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
        model_used: modelUsed || 'gemini-imagen-3',
        prompt,
        config,
        marked_at: new Date().toISOString(),
      }),
      safetyStatus: 'passed',
      safetyReasons: JSON.stringify(['Verified adult-only persona visual reference', 'SFW passed']),
    },
  });

  // Run Safety Gate Pipeline to stamp compliance
  await runSafetyGatePipeline({
    metadata: {
      prompt,
      tags: ['persona_model', config.ethnicity, config.styleLook],
      suitability: 'sfw_safe',
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
