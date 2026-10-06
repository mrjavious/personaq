import {
  getImageProvider,
  ImageProviderError,
  formatIdentityFirstPrompt,
} from '@/lib/ai/image-provider';
import prisma from '@/lib/db/prisma';
import storage, { getAssetBuffer } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import { logAuditEvent } from '@/lib/audit/logger';
import { VisualGenerationError } from './visual-types';
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

export function computePersonaCandidateSeed(personaId: string, attempt: number, index: number): number {
  const str = `${personaId}:attempt:${attempt}:index:${index}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % 1000000;
}

export function buildFaceCardPrompt(
  persona: {
    name?: string;
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
  const identityParts: string[] = [];

  // 1. Age band (21+ rule: fictional adult) - plain words, no name
  identityParts.push(`Adult age ${Math.max(21, persona.adultAge)}`);

  // 2. Section 5: Physical Breakdown & Modular Features (highest priority)
  if (traits && Object.keys(traits).length > 0) {
    const detailedTraits = formatDetailedTraits(traits);
    if (detailedTraits.length > 0) {
      identityParts.push(...detailedTraits);
    }
  }

  // 3. Section 2: Appearance & Physical Styling Notes (condensed, without names or backstory prose)
  if (persona.appearanceNotes) {
    const cleanAppearance = persona.appearanceNotes
      .replace(/\[.*?\]/g, '')
      .replace(/\b(name|named|called)\b[:\s]+\w+/gi, '')
      .trim();
    if (cleanAppearance) {
      identityParts.push(cleanAppearance);
    }
  }

  // 4. Section 3: Expression cue derived from voice tone (single cue only, never catchphrases)
  let expressionCue = 'calm confident gaze with subtle natural half-smile';
  if (persona.voiceTone) {
    const tone = persona.voiceTone.toLowerCase();
    if (tone.includes('warm') || tone.includes('friendly') || tone.includes('approachable') || tone.includes('clear')) {
      expressionCue = 'warm engaging half-smile, welcoming soft gaze';
    } else if (tone.includes('serious') || tone.includes('authoritative') || tone.includes('stoic') || tone.includes('professional')) {
      expressionCue = 'serene focused expression, steady direct gaze';
    } else if (tone.includes('playful') || tone.includes('humorous') || tone.includes('witty')) {
      expressionCue = 'subtle amused smirk, lively bright eyes';
    } else if (tone.includes('mysterious') || tone.includes('poetic') || tone.includes('dreamy')) {
      expressionCue = 'thoughtful contemplative gaze, gentle calm expression';
    }
  }

  // 5. Fixed studio-portrait photography boilerplate
  const studioBoilerplate =
    'front-facing studio portrait, head and shoulders, 85mm lens, soft key light, authentic skin texture with micro-pores, neutral backdrop, direct eye contact, photorealistic, no text, no watermark, no logos';

  // Format identity-first with ≤ 700 characters budget, truncating photography boilerplate only
  const prompt = formatIdentityFirstPrompt({
    identityTraitsPrompt: identityParts.join(', '),
    expressionPrompt: expressionCue,
    studioBoilerplate,
    maxBudgetChars: 700,
  });

  return prompt;
}

export async function generateCandidatePortrait(input: {
  persona: { id: string; name: string; adultAge: number; faceStatus: string };
  mergedTraits: Record<string, unknown>;
  prompt: string;
  seed: number;
  provider: ReturnType<typeof getImageProvider>;
  index: number;
}) {
  const { persona, mergedTraits, prompt, seed, provider, index } = input;

  let imageBuffer: Buffer;
  let modelUsed: string;
  let providerUsed = provider.name;

  try {
    const genResult = await provider.generateImage({
      prompt,
      negativePrompt:
        'blurry, text, watermark, logo, typography, youthful, minor, child, cartoon, 3d render, collage, split image, multi-panel, repeating faces, distorted anatomy',
      aspectRatio: '1:1',
      personaId: persona.id,
    });
    imageBuffer = genResult.buffer;
    modelUsed = genResult.model;
    providerUsed = genResult.provider || provider.name;
  } catch (err) {
    if (err instanceof ImageProviderError) {
      if (err.code === 'quota') {
        throw new VisualGenerationError(
          'PROVIDER_UNAVAILABLE',
          'Image generation provider rate limit or quota exceeded. Configure another provider in IMAGE_PROVIDER_ORDER or upload a reference directly.',
          429
        );
      }
      if (err.code === 'not_configured') {
        throw new VisualGenerationError(
          'PROVIDER_UNAVAILABLE',
          'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run a local ComfyUI worker.',
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
    provider: providerUsed,
    model: modelUsed,
    kind: 'image',
    estimatedCost: 0.04,
    personaId: persona.id,
  }).catch(() => {});

  // Safety Gate Check with declared adultAge
  const safetyResult = await runSafetyGatePipeline({
    buffer: imageBuffer,
    metadata: {
      prompt,
      tags: ['face_candidate', 'portrait', persona.name],
      suitability: 'sfw_safe',
      adultAge: persona.adultAge,
    },
  });

  if (safetyResult.status === 'blocked') {
    throw new VisualGenerationError(
      'SAFETY_BLOCKED',
      `Generated face portrait candidate blocked by safety gate: ${safetyResult.reasons.join(', ')}`,
      422,
      safetyResult.reasons
    );
  }

  // Process single portrait (EXIF stripping, 400px thumbnail, content hash)
  const processed = await processMediaImage(imageBuffer, persona.id);

  const timestamp = Date.now();
  const storageKey = `personas/${persona.id}/candidates/portrait_${timestamp}_${index}.jpg`;
  const thumbKey = `personas/${persona.id}/candidates/thumb_portrait_${timestamp}_${index}.jpg`;

  const [uploadRes] = await Promise.all([
    storage.upload(processed.optimizedBuffer, storageKey, 'image/jpeg'),
    storage.upload(processed.thumbnailBuffer, thumbKey, 'image/jpeg'),
  ]);

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
        provider: providerUsed,
        model: modelUsed,
        modelUsed,
        seed,
        candidateIndex: index,
        prompt,
        facePreviewUrl: uploadRes.url,
        evaluatedAt: new Date().toISOString(),
        contentHashSha256: processed.contentHashSha256,
        traits: mergedTraits,
      }),
    },
  });

  if (persona.faceStatus === 'none') {
    await prisma.persona.update({
      where: { id: persona.id },
      data: { faceStatus: 'draft' },
    });
  }

  return {
    asset: candidateAsset,
    modelUsed,
  };
}

export async function generateFaceCardCandidates(input: {
  personaId: string;
  traits?: Record<string, unknown>;
  attempt?: number;
  candidateCount?: number;
}) {
  const persona = await prisma.persona.findUnique({
    where: { id: input.personaId },
  });

  if (!persona) {
    throw new VisualGenerationError('PERSONA_NOT_FOUND', 'Persona not found', 404);
  }

  let mergedTraits = input.traits || {};
  if (persona.visualModelConfig) {
    try {
      const cfg = JSON.parse(persona.visualModelConfig);
      mergedTraits = { ...cfg, ...mergedTraits };
    } catch {
      // ignore
    }
  }

  // Phase C Item 3: Remove default 'south_indian' fallback. If missing, block generation with clear 400.
  const hasEthnicity = Boolean(
    mergedTraits.ethnicity ||
    mergedTraits.ethnicityCustom ||
    (persona.appearanceNotes && /(indian|asian|african|latina|caucasian|hispanic|european|arab|heritage)/i.test(persona.appearanceNotes))
  );

  if (!hasEthnicity) {
    throw new VisualGenerationError(
      'MISSING_ETHNICITY',
      'Persona ethnicity is required for authentic identity generation. Please select or specify an ethnicity before generating.',
      400
    );
  }

  const prompt = buildFaceCardPrompt(persona, mergedTraits);
  await assertWithinBudget(0.04);
  const provider = getImageProvider();
  if (!(await provider.isAvailable())) {
    throw new VisualGenerationError(
      'PROVIDER_UNAVAILABLE',
      'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run a local ComfyUI worker.',
      503
    );
  }

  const count = input.candidateCount ?? 4;
  const attempt = input.attempt ?? 1;

  // Generate 4 candidates in parallel with distinct per-persona seeds
  const candidateIndices = Array.from({ length: count }, (_, i) => i);
  const candidateResults = await Promise.all(
    candidateIndices.map(async (index) => {
      const seed = computePersonaCandidateSeed(persona.id, attempt, index);
      return generateCandidatePortrait({
        persona,
        mergedTraits,
        prompt,
        seed,
        provider,
        index,
      });
    })
  );

  return {
    candidates: candidateResults.map((r) => r.asset),
    prompt,
    modelUsed: candidateResults[0]?.modelUsed || 'unknown',
  };
}

export async function generateFaceCardCandidate(input: {
  personaId: string;
  traits?: Record<string, unknown>;
  attempt?: number;
}) {
  const result = await generateFaceCardCandidates({
    personaId: input.personaId,
    traits: input.traits,
    attempt: input.attempt || 1,
    candidateCount: 4,
  });

  return {
    asset: result.candidates[0],
    candidates: result.candidates,
    facePreviewUrl: result.candidates[0]?.url,
    prompt: result.prompt,
    modelUsed: result.modelUsed,
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

  // Load candidate portrait image bytes (single portrait, no 50/50 crop)
  const portraitBuffer = await getAssetBuffer(asset);

  // Process chosen portrait directly
  const processedFace = await processMediaImage(portraitBuffer, persona.id);

  const timestamp = Date.now();
  const faceKey = `personas/${persona.id}/face_locked_${timestamp}.jpg`;
  const faceThumbKey = `personas/${persona.id}/thumbs/face_locked_${timestamp}.jpg`;

  const [faceUpload] = await Promise.all([
    storage.upload(processedFace.optimizedBuffer, faceKey, 'image/jpeg'),
    storage.upload(processedFace.thumbnailBuffer, faceThumbKey, 'image/jpeg'),
  ]);

  // Create new locked face asset
  const newFaceAsset = await prisma.asset.create({
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
        locked_at: new Date().toISOString(),
        contentHashSha256: processedFace.contentHashSha256,
      }),
    },
  });

  // Retire previous face_locked assets (never delete)
  await prisma.asset.updateMany({
    where: {
      personaId: persona.id,
      kind: 'face_locked',
      id: { not: newFaceAsset.id },
    },
    data: {
      kind: 'face_retired',
    },
  });

  // Update Persona record
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
  parsedConfig.lockedFaceUrl = newFaceAsset.url;
  parsedConfig.lockedAt = new Date().toISOString();

  const identityText = persona.identityText || persona.appearanceNotes;

  const updatedPersona = await prisma.persona.update({
    where: { id: persona.id },
    data: {
      faceStatus: 'locked',
      faceAssetId: newFaceAsset.id,
      avatarUrl: newFaceAsset.url,
      identityText,
      visualModelConfig: JSON.stringify(parsedConfig),
    },
  });

  // Write PersonaVersion snapshot
  const versionCount = await prisma.personaVersion.count({ where: { personaId: persona.id } });
  const newVersion = await prisma.personaVersion.create({
    data: {
      personaId: persona.id,
      versionNumber: versionCount + 1,
      snapshotJson: JSON.stringify(updatedPersona),
      changeSummary: `Face card locked with portrait asset ${newFaceAsset.id}`,
    },
  });

  // Write audit log
  await logAuditEvent({
    action: 'persona_update',
    entity: 'Persona',
    entityId: persona.id,
    meta: {
      event: 'face_card_locked',
      candidateAssetId: asset.id,
      faceAssetId: newFaceAsset.id,
      personaName: persona.name,
      versionNumber: newVersion.versionNumber,
    },
  });

  let existingBodyAsset = null;
  if (persona.bodyAssetId) {
    existingBodyAsset = await prisma.asset.findUnique({ where: { id: persona.bodyAssetId } });
  }

  return {
    faceAsset: newFaceAsset,
    bodyAsset: existingBodyAsset,
    persona: updatedPersona,
    version: newVersion,
  };
}
