import { GoogleGenAI, PersonGeneration } from '@google/genai';
import prisma from '@/lib/db/prisma';
import storage, { getAssetBuffer } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { VisualGenerationError } from './visual-types';
import sharp from 'sharp';
import { assertWithinBudget, recordUsage } from '@/lib/ai/budget';

export function buildFaceCardPrompt(
  persona: {
    name: string;
    adultAge: number;
    appearanceNotes: string;
    backstory?: string;
    voiceTone?: string;
  },
  traits?: Record<string, unknown>
): string {
  const parts = [
    `Professional character design reference sheet of a fictional adult (${persona.adultAge} years old).`,
    `Format: Split two-panel character reference sheet on a seamless, pure solid white background (#FFFFFF).`,
    `Left Panel: Tight, high-definition macro close-up of the face, direct eye contact, sharp focus on facial features, neutral calm expression, natural skin texture with subtle pores and realism.`,
    `Right Panel: Full-body front standing view of the exact same character from head to toe, identical outfit, identical face, identical studio lighting.`,
    `Character visual identity: ${persona.appearanceNotes}`,
  ];

  if (persona.voiceTone) {
    parts.push(`Demeanor: ${persona.voiceTone}`);
  }

  if (traits && Object.keys(traits).length > 0) {
    const traitsText = Object.entries(traits)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(`Specific traits: ${traitsText}`);
  }

  parts.push(
    `Lighting: Crisp neutral studio key lighting, soft neutral fill, identical illumination across both panels.`,
    `Composition: Exact 50/50 vertical division between the two panels. Balanced horizontal layout.`,
    `Strict Guardrails: Adult only (21+). Purely fictional person with no celebrity likeness or public figure resemblance. Absolutely NO text, NO labels, NO typography, NO watermarks, NO brands or logos anywhere in the image.`
  );

  return parts.join('\n\n');
}

export async function generateFaceCardCandidate(input: {
  personaId: string;
  traits?: Record<string, unknown>;
}) {
  const persona = await prisma.persona.findUnique({
    where: { id: input.personaId },
  });

  if (!persona) {
    throw new VisualGenerationError('PERSONA_NOT_FOUND', 'Persona not found', 404);
  }

  const prompt = buildFaceCardPrompt(persona, input.traits);
  await assertWithinBudget(0.04);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length <= 5) {
    throw new VisualGenerationError(
      'PROVIDER_UNAVAILABLE',
      'No cloud visual generation provider configured. Set GEMINI_API_KEY to generate character face cards.',
      503
    );
  }

  let imageBuffer: Buffer | null = null;
  let modelUsed = 'gemini-2.5-flash-image';
  let lastError: Error | null = null;

  try {
    const client = new GoogleGenAI({ apiKey });

    // 1. Try Gemini 2.5 flash image via generateContent
    try {
      const genResult = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
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
    }

    // 2. Fall back to Imagen 3 only if not a quota exhaustion error
    if (!imageBuffer) {
      const isQuota = lastError?.message && (
        lastError.message.includes('429') ||
        lastError.message.toLowerCase().includes('quota') ||
        lastError.message.includes('RESOURCE_EXHAUSTED') ||
        lastError.message.includes('limit: 0')
      );

      if (!isQuota) {
        try {
          const imageResult = await client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '16:9',
              personGeneration: PersonGeneration.ALLOW_ADULT,
            },
          });

          const base64Data = imageResult.generatedImages?.[0]?.image?.imageBytes;
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
            modelUsed = 'imagen-3.0-generate-002';
          }
        } catch (err) {
          // Do not overwrite previous error if this was a Vertex AI unsupported error
          if (!lastError) {
            lastError = err as Error;
          }
        }
      }
    }
  } catch (err) {
    if (!lastError) {
      lastError = err as Error;
    }
  }

  if (!imageBuffer) {
    const rawMsg = lastError?.message || '';
    if (
      rawMsg.includes('429') ||
      rawMsg.toLowerCase().includes('quota') ||
      rawMsg.includes('RESOURCE_EXHAUSTED') ||
      rawMsg.includes('limit: 0')
    ) {
      throw new VisualGenerationError(
        'PROVIDER_UNAVAILABLE',
        'Gemini image generation quota exceeded. Free-tier Google AI Studio keys have a limit of 0 for image generation models. To generate AI images, attach billing to your Google AI Studio project, run a local ComfyUI worker, or upload a reference sheet directly.',
        429
      );
    }

    if (rawMsg.includes('Enterprise Agent Platform') || rawMsg.includes('Vertex AI')) {
      throw new VisualGenerationError(
        'PROVIDER_UNAVAILABLE',
        'Image generation requires a billing-enabled Google AI Studio project or Vertex AI credentials. You can also run a local ComfyUI worker or upload a reference sheet directly.',
        503
      );
    }

    throw new VisualGenerationError(
      'GEN_UPSTREAM_ERROR',
      `Cloud face card generation failed: ${rawMsg || 'Upstream provider returned no image data'}`,
      502
    );
  }

  await recordUsage({
    provider: 'gemini',
    model: modelUsed,
    kind: 'image',
    estimatedCost: 0.04,
    personaId: persona.id,
  }).catch(() => {});

  // 3. Safety Gate Pipeline Check
  const safetyResult = await runSafetyGatePipeline({
    buffer: imageBuffer,
    metadata: {
      prompt,
      tags: ['face_candidate', 'character_sheet', persona.name],
      suitability: 'sfw_safe',
    },
  });

  if (safetyResult.status === 'blocked') {
    throw new VisualGenerationError(
      'SAFETY_BLOCKED',
      `Generated character sheet blocked by safety gate: ${safetyResult.reasons.join(', ')}`,
      422,
      safetyResult.reasons
    );
  }

  // 4. Process media (strip EXIF, create thumbnail & content hash)
  const processed = await processMediaImage(imageBuffer, persona.id);

  // 5. Upload to storage
  const timestamp = Date.now();
  const storageKey = `personas/${persona.id}/candidates/face_sheet_${timestamp}.jpg`;
  const thumbKey = `personas/${persona.id}/candidates/thumb_face_sheet_${timestamp}.jpg`;

  const [uploadRes] = await Promise.all([
    storage.upload(processed.optimizedBuffer, storageKey, 'image/jpeg'),
    storage.upload(processed.thumbnailBuffer, thumbKey, 'image/jpeg'),
  ]);

  // 6. Store candidate asset
  const candidateAsset = await prisma.asset.create({
    data: {
      personaId: persona.id,
      storageKey,
      url: uploadRes.url,
      type: 'image',
      kind: 'face_candidate',
      suitability: 'sfw_safe',
      aiGenerated: true,
      safetyStatus: safetyResult.status,
      safetyReasons: JSON.stringify(safetyResult.reasons),
      provenanceMeta: JSON.stringify({
        prompt,
        modelUsed,
        evaluatedAt: new Date().toISOString(),
        contentHashSha256: processed.contentHashSha256,
        traits: input.traits || {},
      }),
    },
  });

  // 7. Update Persona faceStatus to draft if none
  if (persona.faceStatus === 'none') {
    await prisma.persona.update({
      where: { id: persona.id },
      data: { faceStatus: 'draft' },
    });
  }

  return {
    asset: candidateAsset,
    prompt,
    modelUsed,
  };
}

export async function lockFaceCard(input: {
  personaId: string;
  assetId: string;
}) {
  const persona = await prisma.persona.findUnique({
    where: { id: input.personaId },
  });

  if (!persona) {
    throw new VisualGenerationError('PERSONA_NOT_FOUND', 'Persona not found', 404);
  }

  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
  });

  if (!asset) {
    throw new VisualGenerationError('ASSET_NOT_FOUND', 'Asset not found', 404);
  }

  if (asset.personaId !== input.personaId) {
    throw new VisualGenerationError(
      'FORBIDDEN_ASSET',
      'The specified asset does not belong to this persona.',
      403
    );
  }

  if (asset.kind !== 'face_candidate') {
    throw new VisualGenerationError(
      'INVALID_ASSET_KIND',
      `Asset kind must be 'face_candidate', but received '${asset.kind}'.`,
      400
    );
  }

  if (asset.safetyStatus !== 'passed') {
    throw new VisualGenerationError(
      'SAFETY_STATUS_NOT_PASSED',
      `Cannot lock face card: asset safety status is '${asset.safetyStatus}'. Only assets with 'passed' status can be locked.`,
      400
    );
  }

  // 1. Load candidate image bytes
  const sheetBuffer = await getAssetBuffer(asset);

  // 2. Crop server-side with sharp into face and body panels
  const image = sharp(sheetBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  const halfWidth = Math.floor(width / 2);

  const faceCropBuffer = await sharp(sheetBuffer)
    .extract({ left: 0, top: 0, width: halfWidth, height })
    .jpeg({ quality: 95 })
    .toBuffer();

  const bodyCropBuffer = await sharp(sheetBuffer)
    .extract({ left: halfWidth, top: 0, width: width - halfWidth, height })
    .jpeg({ quality: 95 })
    .toBuffer();

  // 3. Process each panel (strip EXIF, generate thumb & hash)
  const [processedFace, processedBody] = await Promise.all([
    processMediaImage(faceCropBuffer, persona.id),
    processMediaImage(bodyCropBuffer, persona.id),
  ]);

  const timestamp = Date.now();
  const faceKey = `personas/${persona.id}/face_locked_${timestamp}.jpg`;
  const bodyKey = `personas/${persona.id}/body_locked_${timestamp}.jpg`;
  const faceThumbKey = `personas/${persona.id}/thumbs/face_locked_${timestamp}.jpg`;
  const bodyThumbKey = `personas/${persona.id}/thumbs/body_locked_${timestamp}.jpg`;

  const [faceUpload, bodyUpload] = await Promise.all([
    storage.upload(processedFace.optimizedBuffer, faceKey, 'image/jpeg'),
    storage.upload(processedBody.optimizedBuffer, bodyKey, 'image/jpeg'),
    storage.upload(processedFace.thumbnailBuffer, faceThumbKey, 'image/jpeg'),
    storage.upload(processedBody.thumbnailBuffer, bodyThumbKey, 'image/jpeg'),
  ]);

  // 4. Create new locked face & body assets
  const [newFaceAsset, newBodyAsset] = await Promise.all([
    prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: faceKey,
        url: faceUpload.url,
        type: 'image',
        kind: 'face_locked',
        parentAssetId: asset.id,
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: asset.safetyStatus,
        safetyReasons: asset.safetyReasons,
        tags: JSON.stringify(['identity_anchor', 'face_locked', persona.name]),
        provenanceMeta: JSON.stringify({
          derived_from_candidate: asset.id,
          panel: 'left_face_closeup',
          locked_at: new Date().toISOString(),
          contentHashSha256: processedFace.contentHashSha256,
        }),
      },
    }),
    prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: bodyKey,
        url: bodyUpload.url,
        type: 'image',
        kind: 'body_locked',
        parentAssetId: asset.id,
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: asset.safetyStatus,
        safetyReasons: asset.safetyReasons,
        tags: JSON.stringify(['identity_anchor', 'body_locked', persona.name]),
        provenanceMeta: JSON.stringify({
          derived_from_candidate: asset.id,
          panel: 'right_full_body',
          locked_at: new Date().toISOString(),
          contentHashSha256: processedBody.contentHashSha256,
        }),
      },
    }),
  ]);

  // 5. Retire previous locked assets (never delete)
  await prisma.asset.updateMany({
    where: {
      personaId: persona.id,
      kind: { in: ['face_locked', 'body_locked'] },
      id: { notIn: [newFaceAsset.id, newBodyAsset.id] },
    },
    data: {
      kind: 'face_retired',
    },
  });

  // 6. Update Persona record
  let parsedConfig: Record<string, unknown> = {};
  try {
    if (persona.visualModelConfig) {
      parsedConfig = JSON.parse(persona.visualModelConfig);
    }
  } catch {
    parsedConfig = {};
  }

  parsedConfig.isFaceLocked = true;
  parsedConfig.faceAssetId = newFaceAsset.id;
  parsedConfig.bodyAssetId = newBodyAsset.id;
  parsedConfig.lockedFaceUrl = newFaceAsset.url;
  parsedConfig.lockedAt = new Date().toISOString();

  const identityText = persona.identityText || persona.appearanceNotes;

  const updatedPersona = await prisma.persona.update({
    where: { id: persona.id },
    data: {
      faceStatus: 'locked',
      faceAssetId: newFaceAsset.id,
      bodyAssetId: newBodyAsset.id,
      avatarUrl: newFaceAsset.url,
      identityText,
      visualModelConfig: JSON.stringify(parsedConfig),
    },
  });

  // 7. Write PersonaVersion snapshot
  const versionCount = await prisma.personaVersion.count({ where: { personaId: persona.id } });
  await prisma.personaVersion.create({
    data: {
      personaId: persona.id,
      versionNumber: versionCount + 1,
      snapshotJson: JSON.stringify(updatedPersona),
      changeSummary: `Face card locked with face asset ${newFaceAsset.id} and body asset ${newBodyAsset.id}`,
    },
  });

  // 8. Write audit log
  await logAuditEvent({
    action: 'persona_update',
    entity: 'Persona',
    entityId: persona.id,
    meta: {
      event: 'face_card_locked',
      candidateAssetId: asset.id,
      faceAssetId: newFaceAsset.id,
      bodyAssetId: newBodyAsset.id,
      personaName: persona.name,
    },
  });

  return {
    faceAsset: newFaceAsset,
    bodyAsset: newBodyAsset,
    persona: updatedPersona,
  };
}
