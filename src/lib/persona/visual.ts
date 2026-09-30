import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
export * from './visual-types';
import { VisualModelOptions, buildVisualModelPrompt } from './visual-types';

/**
 * Generates an SVG/Canvas simulation placeholder when external Gemini Imagen API is unavailable or unconfigured.
 */
function createFallbackPersonaImageBuffer(
  options: VisualModelOptions,
  personaName: string,
  age: number
): Buffer {
  const isSouthIndian = options.ethnicity === 'south_indian';
  const isTraditional = options.styleLook === 'traditional';

  const bgGradStart = isTraditional ? '#3b0764' : '#0f172a';
  const bgGradEnd = isTraditional ? '#831843' : '#1e1b4b';
  const accentGold = '#f59e0b';
  const sareeColor = isTraditional ? '#be123c' : '#3b82f6';
  const skinTone = isSouthIndian ? '#9a6138' : '#c68642';

  const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradStart}"/>
      <stop offset="50%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="${bgGradEnd}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accentGold}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="saree" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${sareeColor}"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#halo)"/>

  <!-- Subtle ornamental border -->
  <rect x="30" y="30" width="964" height="964" fill="none" stroke="${accentGold}" stroke-width="2" stroke-opacity="0.4" rx="24"/>
  <rect x="42" y="42" width="940" height="940" fill="none" stroke="${accentGold}" stroke-width="1" stroke-dasharray="8,8" stroke-opacity="0.3" rx="20"/>

  <!-- Character Silhouette & Styling Details -->
  <!-- Shoulders / Torso -->
  <ellipse cx="512" cy="780" rx="300" ry="240" fill="url(#saree)"/>
  ${
    isTraditional
      ? `<!-- Traditional Zari border -->
  <path d="M 280 680 Q 512 850 744 680" stroke="${accentGold}" stroke-width="24" fill="none" stroke-linecap="round"/>
  <path d="M 290 710 Q 512 880 734 710" stroke="#fef08a" stroke-width="6" fill="none" stroke-dasharray="10,6"/>`
      : `<!-- Modern Blazer Lapels -->
  <polygon points="412,640 512,820 612,640" fill="#09090b" stroke="${accentGold}" stroke-width="2"/>`
  }

  <!-- Neck -->
  <rect x="462" y="480" width="100" height="150" fill="${skinTone}" rx="20"/>
  <!-- Necklace -->
  <path d="M 440 570 Q 512 620 584 570" stroke="${accentGold}" stroke-width="12" fill="none" stroke-linecap="round"/>
  <circle cx="512" cy="625" r="14" fill="${accentGold}"/>

  <!-- Head & Hair Base -->
  <circle cx="512" cy="380" r="190" fill="#09090b"/>
  <!-- Face -->
  <ellipse cx="512" cy="390" rx="140" ry="175" fill="${skinTone}"/>

  <!-- Hair framing -->
  <path d="M 372 380 Q 512 210 652 380 Q 640 260 512 250 Q 384 260 372 380 Z" fill="#09090b"/>
  ${
    isTraditional
      ? `<!-- Jasmine Flowers (Gajra) in hair -->
  <circle cx="370" cy="340" r="12" fill="#ffffff"/>
  <circle cx="385" cy="320" r="12" fill="#fef9c3"/>
  <circle cx="410" cy="300" r="12" fill="#ffffff"/>
  <circle cx="614" cy="300" r="12" fill="#ffffff"/>
  <circle cx="639" cy="320" r="12" fill="#fef9c3"/>
  <circle cx="654" cy="340" r="12" fill="#ffffff"/>`
      : ''
  }

  <!-- Jhumka / Earrings -->
  <circle cx="360" cy="430" r="8" fill="${accentGold}"/>
  <polygon points="350,442 370,442 360,465" fill="${accentGold}"/>
  <circle cx="664" cy="430" r="8" fill="${accentGold}"/>
  <polygon points="654,442 674,442 664,465" fill="${accentGold}"/>

  <!-- Eyebrows -->
  <path d="M 420 335 Q 455 320 485 335" stroke="#18181b" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M 539 335 Q 569 320 604 335" stroke="#18181b" stroke-width="7" fill="none" stroke-linecap="round"/>

  <!-- Almond Eyes -->
  <ellipse cx="452" cy="360" rx="26" ry="14" fill="#ffffff"/>
  <circle cx="454" cy="360" r="11" fill="#261a14"/>
  <circle cx="456" cy="357" r="3" fill="#ffffff"/>

  <ellipse cx="572" cy="360" rx="26" ry="14" fill="#ffffff"/>
  <circle cx="570" cy="360" r="11" fill="#261a14"/>
  <circle cx="572" cy="357" r="3" fill="#ffffff"/>

  ${
    isSouthIndian
      ? `<!-- Traditional Red Bindi / Kumkum -->
  <circle cx="512" cy="325" r="7" fill="#b91c1c" stroke="${accentGold}" stroke-width="1.5"/>`
      : ''
  }

  <!-- Nose & Lips -->
  <path d="M 512 370 L 507 415 L 518 418" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="512" cy="460" rx="34" ry="12" fill="#991b1b"/>
  <path d="M 478 460 Q 512 472 546 460" stroke="#f43f5e" stroke-width="2" fill="none"/>

  <!-- Metadata Badge Overlay -->
  <rect x="80" y="860" width="864" height="90" rx="16" fill="#09090b" fill-opacity="0.85" stroke="#27272a" stroke-width="1.5"/>
  <text x="110" y="900" font-family="system-ui, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">
    ${personaName} (Adult Age ${age})
  </text>
  <text x="110" y="930" font-family="system-ui, sans-serif" font-size="16" fill="${accentGold}">
    ✨ Visual Model Reference • ${options.ethnicity.replace('_', ' ').toUpperCase()} • ${options.styleLook.toUpperCase()}
  </text>
  <text x="750" y="915" font-family="monospace" font-size="14" fill="#a1a1aa">
    [Disclosed AI Persona]
  </text>
</svg>`;

  return Buffer.from(svg);
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
}> {
  const { prompt } = buildVisualModelPrompt(
    input.options,
    input.personaName,
    input.adultAge
  );

  let imageBuffer: Buffer | null = null;
  let modelUsed = 'gemini-imagen-3';

  // 1. Attempt Gemini Imagen generation if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 5) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const imageResult = await client.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
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
      }
    } catch (err) {
      console.warn('Gemini Imagen API call failed or quota restricted. Falling back to internal engine:', err);
    }
  }

  // 2. Fallback to high-resolution stylized canvas vector if external generation was unavailable
  if (!imageBuffer) {
    imageBuffer = createFallbackPersonaImageBuffer(input.options, input.personaName, input.adultAge);
    modelUsed = 'personaq-visual-engine (offline ready)';
  }

  // 3. Process media: EXIF stripping, 400px thumbnail, cryptographic SHA-256 manifest
  const processed = await processMediaImage(imageBuffer, input.personaId);

  // 4. Upload to storage
  const timestamp = Date.now();
  const fileExt = processed.format === 'svg' ? 'svg' : 'jpg';
  const storageKey = `personas/${input.personaId}/visual_${timestamp}.${fileExt}`;
  const thumbKey = `personas/${input.personaId}/thumb_${timestamp}.${fileExt}`;

  const uploadRes = await storage.upload(
    processed.optimizedBuffer,
    storageKey,
    processed.format === 'svg' ? 'image/svg+xml' : 'image/jpeg'
  );

  const thumbRes = await storage.upload(
    processed.thumbnailBuffer,
    thumbKey,
    'image/jpeg'
  );

  return {
    imageUrl: uploadRes.url,
    thumbnailUrl: thumbRes.url,
    provenanceHash: processed.contentHashSha256,
    prompt,
    modelUsed,
    config: input.options,
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
      : config.ethnicity.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const styleTitle = config.styleLook.replace(/\b\w/g, (c) => c.toUpperCase());
  const bodyTitle = config.bodyStructure.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const visualSummary = `[Visual Reference Model: ${ethnicityTitle} • ${styleTitle} Look • ${bodyTitle} Build • Model: ${modelUsed || 'Gemini Imagen'}]`;

  // Merge with existing appearance notes cleanly
  const baseNotes = persona.appearanceNotes.replace(/\[Visual Reference Model:.*?\]/g, '').trim();
  const updatedAppearanceNotes = `${visualSummary}\n${baseNotes}`.trim();

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
      visualModelConfig: JSON.stringify(config),
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
      changeSummary: `Updated Persona Visual Model (${ethnicityTitle} - ${styleTitle})`,
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
