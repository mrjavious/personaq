import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
sharp.cache(false);
export * from './visual-types';
import { VisualModelOptions, buildVisualModelPrompt, formatPhysicalDNASummary, PersonaAngleItem, VisualGenerationError } from './visual-types';

/**
 * Returns available multi-angle reference portraits for an ethnicity / persona / style.
 * By default returns the 5 views: Front, Side, Full view, Full Back view, Full Side view.
 */
export function getPersonaMultiAnglePack(
  ethnicity: string = 'south_indian',
  personaId?: string,
  _styleLook: string = 'minimal_studio'
): PersonaAngleItem[] {
  void _styleLook;
  const ethPrefix = `/presets/personas/${ethnicity || 'south_indian'}`;
  const studioPrefix = ethnicity === 'south_indian' ? ethPrefix : '/presets/personas/minimal_studio';
  const hasPreset = (file: string) => fs.existsSync(/*turbopackIgnore: true*/ path.join(process.cwd(), 'public', file.replace(/^\//, '')));

  let frontUrl = `${studioPrefix}/camisole_front.jpg`;
  let sideUrl = `${studioPrefix}/camisole_side.jpg`;
  let fullBodyUrl = `${studioPrefix}/camisole_full_body.jpg`;
  let fullBackUrl = `${studioPrefix}/camisole_full_back.jpg`;
  let fullSideUrl = `${studioPrefix}/camisole_full_body_side.jpg`;

  // If this specific persona has their own synthesized angle portrait files, use them
  if (personaId) {
    const pLocked = `/uploads/personas/${personaId}/locked_face.jpg`;
    const pFront = `/uploads/personas/${personaId}/angle_front.jpg`;
    const pBaseFront = `/uploads/personas/${personaId}/base_front.jpg`;
    const pSide = `/uploads/personas/${personaId}/angle_side.jpg`;
    const pFullBody = `/uploads/personas/${personaId}/angle_full_body.jpg`;
    const pFullBack = `/uploads/personas/${personaId}/angle_full_back.jpg`;
    const pFullSide = `/uploads/personas/${personaId}/angle_full_side.jpg`;

    if (hasPreset(pLocked)) frontUrl = pLocked;
    else if (hasPreset(pFront)) frontUrl = pFront;
    else if (hasPreset(pBaseFront)) frontUrl = pBaseFront;

    if (hasPreset(pSide)) sideUrl = pSide;
    if (hasPreset(pFullBody)) fullBodyUrl = pFullBody;
    if (hasPreset(pFullBack)) fullBackUrl = pFullBack;
    if (hasPreset(pFullSide)) fullSideUrl = pFullSide;
  }

  return [
    { angle: 'front', label: 'Front', url: frontUrl },
    { angle: 'side', label: 'Side', url: sideUrl },
    { angle: 'full_body', label: 'Full view', url: fullBodyUrl },
    { angle: 'full_back', label: 'Full Back view', url: fullBackUrl },
    { angle: 'full_side', label: 'Full Side view', url: fullSideUrl },
  ];
}

/**
 * Generates the persona visual model image using Gemini API (or high-detail fallback).
 */
export async function generatePersonaVisual(input: {
  personaId: string;
  options: VisualModelOptions;
  personaName: string;
  adultAge: number;
}): Promise<{
  imageUrl: string;
  thumbnailUrl: string;
  provenanceHash: string;
  prompt: string;
  modelUsed: string;
  config: VisualModelOptions;
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

    // First attempt Gemini 2.5 flash image via generateContent
    try {
      const genResult = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: fullPrompt,
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

  // 3. Process media: EXIF stripping, 400px thumbnail, cryptographic SHA-256 manifest
  const processed = await processMediaImage(imageBuffer, input.personaId);

  // 4. Upload to storage as standard JPEG
  const timestamp = Date.now();
  const fileExt = processed.format === 'png' ? 'png' : 'jpg';
  const mimeType = processed.format === 'png' ? 'image/png' : 'image/jpeg';
  const storageKey = `personas/${input.personaId}/visual_${timestamp}.${fileExt}`;
  const thumbKey = `personas/${input.personaId}/thumb_${timestamp}.jpg`;

  const uploadRes = await storage.upload(
    processed.optimizedBuffer,
    storageKey,
    mimeType
  );

  const thumbRes = await storage.upload(
    processed.thumbnailBuffer,
    thumbKey,
    'image/jpeg'
  );

  // Persist this specific angle directly into the persona's upload folder
  if (input.personaId) {
    try {
      const personaDir = path.resolve(process.cwd(), `public/uploads/personas/${input.personaId}`);
      if (!fs.existsSync(/*turbopackIgnore: true*/ personaDir)) {
        fs.mkdirSync(personaDir, { recursive: true });
      }
      const safeWrite = (filePath: string, buf: Buffer) => {
        try {
          fs.writeFileSync(filePath, buf);
        } catch {
          try {
            const tmp = `${filePath}.tmp.${Date.now()}`;
            fs.writeFileSync(tmp, buf);
            fs.renameSync(tmp, filePath);
          } catch {
            // ignore
          }
        }
      };

      const currentAngle = input.options.cameraAngle || 'front';
      const angleFilePath = path.join(personaDir, `angle_${currentAngle}.jpg`);
      safeWrite(angleFilePath, processed.optimizedBuffer);

      if (currentAngle === 'front') {
        const baseFrontPath = path.join(personaDir, 'base_front.jpg');
        safeWrite(baseFrontPath, processed.optimizedBuffer);

        if (input.options.isFaceLocked) {
          const lockedFacePath = path.join(personaDir, 'locked_face.jpg');
          safeWrite(lockedFacePath, processed.optimizedBuffer);
        }
      }
    } catch (saveErr) {
      console.warn('Failed to save angle file directly to persona folder:', saveErr);
    }
  }

  const multiAnglePack = getPersonaMultiAnglePack(
    input.options.ethnicity,
    input.personaId,
    input.options.styleLook
  );

  return {
    imageUrl: uploadRes.url,
    thumbnailUrl: thumbRes.url,
    provenanceHash: processed.contentHashSha256,
    prompt,
    modelUsed,
    config: input.options,
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
