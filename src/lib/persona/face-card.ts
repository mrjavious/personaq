import { getImageProvider, ImageProviderError } from '@/lib/ai/image-provider';
import prisma from '@/lib/db/prisma';
import storage, { getAssetBuffer } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { VisualGenerationError } from './visual-types';
import sharp from 'sharp';
import { assertWithinBudget, recordUsage } from '@/lib/ai/budget';

function formatDetailedTraits(traits: Record<string, unknown>): string[] {
  const parts: string[] = [];

  // Ethnicity
  if (traits.ethnicity && typeof traits.ethnicity === 'string') {
    const eth = traits.ethnicity;
    if (eth === 'south_indian') {
      parts.push('Cultural Heritage: authentic South Indian heritage, warm glowing olive-caramel complexion, expressive deep brown almond eyes, soft arched eyebrows, natural dark lustrous hair');
    } else if (eth === 'north_indian') {
      parts.push('Cultural Heritage: North Indian heritage, warm wheatish complexion, sharp sculpted features, expressive hazel-brown eyes, silky dark brown hair');
    } else if (eth === 'east_asian') {
      parts.push('Cultural Heritage: East Asian heritage, smooth porcelain skin, refined facial symmetry, delicate almond eyes, sleek dark hair');
    } else if (eth === 'southeast_asian') {
      parts.push('Cultural Heritage: Southeast Asian heritage, warm golden-bronze sun-kissed skin, soft expressive gaze, natural wavy hair');
    } else if (eth === 'latina') {
      parts.push('Cultural Heritage: Latina heritage, rich honey-bronze complexion, high sculpted cheekbones, warm amber eyes, voluminous wavy dark hair');
    } else if (eth === 'caucasian') {
      parts.push('Cultural Heritage: Nordic / European heritage, radiant fair skin with subtle natural undertones, sharp jawline, expressive clear eyes');
    } else if (eth === 'african') {
      parts.push('Cultural Heritage: African heritage, deep luminous melanin-rich skin, striking bone structure, sculpted facial harmony, elegant textured dark hair');
    } else if (eth === 'middle_eastern') {
      parts.push('Cultural Heritage: Middle Eastern heritage, luminous olive skin tone, deep dramatic almond eyes, defined brows, thick dark waves');
    } else if (traits.ethnicityCustom && typeof traits.ethnicityCustom === 'string') {
      parts.push(`Cultural Heritage: ${traits.ethnicityCustom}`);
    } else {
      parts.push(`Cultural Heritage: ${eth.replace(/_/g, ' ')}`);
    }
  }

  // Face Card DNA
  const faceCard = traits.faceCard as Record<string, string> | undefined;
  if (faceCard && typeof faceCard === 'object') {
    const fParts: string[] = [];
    if (faceCard.jawline) fParts.push(`jawline: ${faceCard.jawline.replace(/_/g, ' ')}`);
    if (faceCard.eyeShape) fParts.push(`eyes: ${faceCard.eyeShape.replace(/_/g, ' ')}`);
    if (faceCard.noseBridge) fParts.push(`nose: ${faceCard.noseBridge.replace(/_/g, ' ')}`);
    if (faceCard.lipFullness) fParts.push(`lips: ${faceCard.lipFullness.replace(/_/g, ' ')} with warm natural smile showing teeth`);
    if (fParts.length) parts.push(`Face Structure: ${fParts.join(', ')}`);
  }

  // Dimple
  const dimple = traits.dimple as Record<string, string> | undefined;
  if (dimple && typeof dimple === 'object' && dimple.type && dimple.type !== 'none') {
    parts.push(`Dimples: ${dimple.depth || 'subtle'} ${dimple.type.replace(/_/g, ' ')}`);
  }

  // Skin Tone & Complexion
  const skinTone = traits.skinTone as Record<string, string> | undefined;
  if (skinTone && typeof skinTone === 'object') {
    const comp = skinTone.complexion ? skinTone.complexion.replace(/_/g, ' ') : 'warm caramel';
    const undertone = skinTone.undertone ? `with ${skinTone.undertone.replace(/_/g, ' ')} undertone` : '';
    const finish = skinTone.finish ? `and a natural ${skinTone.finish.replace(/_/g, ' ')} finish` : 'and a dewy glow';
    parts.push(`Complexion & Skin: ${comp} skin tone ${undertone} ${finish}`.trim());
  }

  // Distinctive Marks (Moles & Freckles)
  const marks = traits.distinctiveMarks as Record<string, string> | undefined;
  if (marks && typeof marks === 'object') {
    const mParts: string[] = [];
    if (marks.moles && marks.moles !== 'none') {
      let molePlace = marks.moles.replace(/_/g, ' ');
      if (marks.moles === 'chest_cleavage') molePlace = 'the central chest and cleavage area';
      else if (marks.moles === 'upper_chest_left') molePlace = 'the upper chest curve above the left breast';
      else if (marks.moles === 'sternum') molePlace = 'the center of the sternum between the breasts';
      else if (marks.moles === 'lower_cleavage') molePlace = 'the lower cleavage contour';
      mParts.push(`signature delicate beauty mark / mole located at ${molePlace}`);
    } else if (marks.moles === 'none') {
      mParts.push('clean unblemished skin with no moles');
    }
    if (marks.freckles && marks.freckles !== 'none') {
      mParts.push(`${marks.freckles.replace(/_/g, ' ')} freckles`);
    }
    if (marks.customMark) {
      mParts.push(marks.customMark);
    }
    if (mParts.length) parts.push(`Distinctive Marks: ${mParts.join(', ')}`);
  }

  // Body Proportions & Silhouette
  const body = traits.bodyProportions as Record<string, string> | undefined;
  if (body && typeof body === 'object') {
    const bParts: string[] = [];
    if (body.silhouette) bParts.push(`${body.silhouette.replace(/_/g, ' ')} silhouette`);
    if (body.upperBodyBust) bParts.push(`${body.upperBodyBust.replace(/_/g, ' ')} upper proportions`);
    if (body.lowerBodyHip) bParts.push(`${body.lowerBodyHip.replace(/_/g, ' ')} hip curve`);
    if (bParts.length) parts.push(`Physique Proportions: ${bParts.join(', ')}`);
  } else if (traits.bodyStructure && typeof traits.bodyStructure === 'string') {
    parts.push(`Physique: ${traits.bodyStructure.replace(/_/g, ' ')} build`);
  }

  // Tattoos & Body Art
  const tattoos = traits.tattoos as Record<string, string> | undefined;
  if (tattoos && typeof tattoos === 'object') {
    if (tattoos.style && tattoos.style !== 'none') {
      const place = tattoos.placement && tattoos.placement !== 'none' ? ` on ${tattoos.placement.replace(/_/g, ' ')}` : '';
      const desc = tattoos.description ? ` (${tattoos.description})` : '';
      parts.push(`Body Art: ${tattoos.style.replace(/_/g, ' ')} tattoo${place}${desc}`);
    } else if (tattoos.style === 'none') {
      parts.push('Body Art: Bare natural skin, no tattoos');
    }
  }

  // Hair Styling
  const hair = traits.hairStyling as Record<string, string> | undefined;
  if (hair && typeof hair === 'object') {
    const hParts: string[] = [];
    if (hair.texture) hParts.push(hair.texture.replace(/_/g, ' '));
    if (hair.length) hParts.push(`${hair.length.replace(/_/g, ' ')} length`);
    if (hair.accents && hair.accents !== 'modern_clean') hParts.push(`adorned with ${hair.accents.replace(/_/g, ' ')}`);
    if (hParts.length) parts.push(`Hair: ${hParts.join(', ')}`);
  } else if (traits.hairStyle && typeof traits.hairStyle === 'string') {
    parts.push(`Hair: ${traits.hairStyle}`);
  }

  // Any remaining scalar traits
  for (const [k, v] of Object.entries(traits)) {
    if (
      [
        'ethnicity',
        'ethnicityCustom',
        'styleLook',
        'bodyStructure',
        'faceCard',
        'dimple',
        'skinTone',
        'distinctiveMarks',
        'bodyProportions',
        'tattoos',
        'hairStyling',
        'hairStyle',
        'cameraAngle',
        'shotType',
        'referenceImageUrl',
        'isFaceLocked',
        'lockedFaceUrl',
      ].includes(k)
    ) {
      continue;
    }
    if (typeof v === 'string' && v.trim()) {
      parts.push(`${k.replace(/_/g, ' ')}: ${v.trim()}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      parts.push(`${k.replace(/_/g, ' ')}: ${v}`);
    }
  }

  return parts;
}

export function buildFaceCardPrompt(
  persona: {
    name: string;
    adultAge: number;
    appearanceNotes: string;
    backstory?: string;
    voiceTone?: string;
    boundaries?: string | string[];
    contentPillars?: string | string[];
    aiDisclosureText?: string;
  },
  traits?: Record<string, unknown>
): string {
  const parts = [
    `Professional photorealistic two-panel character reference sheet of a fictional adult woman named ${persona.name} (${persona.adultAge} years old) on a seamless pure solid white background (#FFFFFF).`,
    `Attire: Wearing an elegant minimalist neutral studio camisole top with slim delicate shoulder straps, tastefully tailored and fitted.`,
    `Left Panel: Ultra-sharp high-definition macro close-up portrait of the face, neck, and upper chest, direct eye contact with camera, neutral calm confident expression with a warm engaging natural smile, authentic glowing skin texture with realistic micro-pores, showing the delicate ribbed camisole straps.`,
    `Right Panel: Full-body front standing view of the exact same character from head to toe, identical face and hairstyle, identical neutral camisole top with matching tailored neutral boxers/shorts, standing straight against the clean white studio backdrop.`,
    `Character visual identity: ${persona.appearanceNotes}`,
  ];

  if (persona.backstory) {
    parts.push(`Backstory & Context: ${persona.backstory}`);
  }

  if (persona.voiceTone) {
    parts.push(`Demeanor & Mannerisms: ${persona.voiceTone}`);
  }

  if (traits && Object.keys(traits).length > 0) {
    const detailedTraits = formatDetailedTraits(traits);
    if (detailedTraits.length > 0) {
      parts.push(`Specific traits:\n${detailedTraits.map((t) => `• ${t}`).join('\n')}`);
    }
  }

  // Parse boundaries if present
  let boundaryList: string[] = [];
  if (Array.isArray(persona.boundaries)) {
    boundaryList = persona.boundaries;
  } else if (typeof persona.boundaries === 'string') {
    try {
      const parsed = JSON.parse(persona.boundaries);
      if (Array.isArray(parsed)) boundaryList = parsed;
    } catch {
      if (persona.boundaries.trim()) boundaryList = [persona.boundaries.trim()];
    }
  }
  if (boundaryList.length > 0) {
    parts.push(`Strict Content Boundaries:\n${boundaryList.map((b) => `• ${b}`).join('\n')}`);
  }

  // Parse content pillars if present
  let pillarList: string[] = [];
  if (Array.isArray(persona.contentPillars)) {
    pillarList = persona.contentPillars;
  } else if (typeof persona.contentPillars === 'string') {
    try {
      const parsed = JSON.parse(persona.contentPillars);
      if (Array.isArray(parsed)) pillarList = parsed;
    } catch {
      if (persona.contentPillars.trim()) pillarList = [persona.contentPillars.trim()];
    }
  }
  if (pillarList.length > 0) {
    parts.push(`Persona Content Focus Pillars: ${pillarList.join('; ')}`);
  }

  if (persona.aiDisclosureText) {
    parts.push(`Disclosure Notice: ${persona.aiDisclosureText}`);
  }

  parts.push(
    `Lighting & Quality: Crisp 8k studio key lighting, soft neutral fill, crystal clear focus, RAW photography.`,
    `Composition: Exact 50/50 vertical division between the two panels. Left is close-up portrait, Right is full-body standing. Single character only.`,
    `Strict Guardrails: Adult only (21+). Purely fictional person with no celebrity likeness or public figure resemblance. Absolutely NO text, NO labels, NO typography, NO watermarks, NO brands, NO repeating photo grids, NO collage, NO multiple heads.`
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

  // Merge traits from persona's visualModelConfig if available
  let mergedTraits = input.traits || {};
  if (persona.visualModelConfig) {
    try {
      const cfg = JSON.parse(persona.visualModelConfig);
      mergedTraits = { ...cfg, ...mergedTraits };
    } catch {
      // ignore
    }
  }

  const prompt = buildFaceCardPrompt(persona, mergedTraits);
  await assertWithinBudget(0.04);
  const provider = getImageProvider();
  if (!(await provider.isAvailable())) {
    throw new VisualGenerationError(
      'PROVIDER_UNAVAILABLE',
      'No visual generation provider configured. Run a local ComfyUI worker, set HF_TOKEN, or upload a reference sheet directly.',
      503
    );
  }

  let imageBuffer: Buffer;
  let facePreviewBuffer: Buffer;
  let modelUsed: string;

  try {
      const genResult = await provider.generateImage({
        prompt,
        negativePrompt:
          'blurry, low quality, grid, collage, multiple heads, repeating faces, contact sheet, photo booth, passport photo sheet, tiled, split horizontal, duplicate faces, distorted anatomy, cartoon, anime, 3d render',
        aspectRatio: '16:9',
        personaId: persona.id,
      });
      imageBuffer = genResult.buffer;
      modelUsed = genResult.model;

      // Extract left half as front portrait preview
      const meta = await sharp(imageBuffer).metadata();
      const width = meta.width || 1024;
      const height = meta.height || 1024;
      const halfWidth = Math.floor(width / 2);
      facePreviewBuffer = await sharp(imageBuffer)
        .extract({ left: 0, top: 0, width: halfWidth, height })
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (err) {
      if (err instanceof ImageProviderError) {
        if (err.code === 'quota') {
          throw new VisualGenerationError(
            'PROVIDER_UNAVAILABLE',
            'Image generation provider rate limit or quota exceeded. Run a local ComfyUI worker or upload a reference sheet directly.',
            429
          );
        }
        if (err.code === 'not_configured') {
          throw new VisualGenerationError(
            'PROVIDER_UNAVAILABLE',
            'No visual generation provider configured. Run a local ComfyUI worker, set HF_TOKEN, or upload a reference sheet directly.',
            503
          );
        }
        if (err.code === 'unsupported') {
          throw new VisualGenerationError(
            'PROVIDER_UNAVAILABLE',
            err.message,
            503
          );
        }
        throw new VisualGenerationError(
          'GEN_UPSTREAM_ERROR',
          `Visual face card generation failed: ${err.message}`,
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
    personaId: persona.id,
  }).catch(() => {});

  // 3. Safety Gate Pipeline Check with declared adultAge
  const safetyResult = await runSafetyGatePipeline({
    buffer: imageBuffer,
    metadata: {
      prompt,
      tags: ['face_candidate', 'character_sheet', persona.name],
      suitability: 'sfw_safe',
      adultAge: persona.adultAge,
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
  const facePreviewKey = `personas/${persona.id}/candidates/face_preview_${timestamp}.jpg`;

  const [uploadRes, , facePreviewRes] = await Promise.all([
    storage.upload(processed.optimizedBuffer, storageKey, 'image/jpeg'),
    storage.upload(processed.thumbnailBuffer, thumbKey, 'image/jpeg'),
    storage.upload(facePreviewBuffer, facePreviewKey, 'image/jpeg'),
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
        facePreviewUrl: facePreviewRes.url,
        evaluatedAt: new Date().toISOString(),
        contentHashSha256: processed.contentHashSha256,
        traits: mergedTraits,
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
    facePreviewUrl: facePreviewRes.url,
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
