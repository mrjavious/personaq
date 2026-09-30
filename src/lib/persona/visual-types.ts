export interface VisualModelOptions {
  ethnicity:
    | 'south_indian'
    | 'north_indian'
    | 'east_asian'
    | 'southeast_asian'
    | 'latina'
    | 'caucasian'
    | 'african'
    | 'middle_eastern'
    | 'custom';
  ethnicityCustom?: string;
  styleLook: 'traditional' | 'modern' | 'fusion' | 'streetwear' | 'editorial' | 'casual';
  bodyStructure: 'athletic' | 'slender' | 'hourglass' | 'toned' | 'curvy' | 'tall_statuesque';
  facialFeatures?: string;
  hairStyle?: string;
  lighting?: string;
  shotType: 'portrait' | 'medium' | 'full_body';
  additionalPrompt?: string;
}

export const ETHNICITY_PRESETS = [
  { id: 'south_indian', label: 'South Indian', description: 'Warm olive/caramel skin, almond dark eyes, thick dark hair' },
  { id: 'north_indian', label: 'North Indian', description: 'Wheatish to warm fair skin, expressive eyes, sculpted jawline' },
  { id: 'east_asian', label: 'East Asian', description: 'Porcelain smooth skin, refined bone structure, sleek hair' },
  { id: 'southeast_asian', label: 'Southeast Asian', description: 'Golden bronze complexion, warm friendly gaze, natural wave hair' },
  { id: 'latina', label: 'Latina / Hispanic', description: 'Honey bronze skin, prominent cheekbones, voluminous hair' },
  { id: 'caucasian', label: 'Nordic / European', description: 'Fair complexion, subtle freckles, sculpted features' },
  { id: 'african', label: 'African / Melanin-Rich', description: 'Deep rich radiant complexion, striking bone structure, textured hair' },
  { id: 'middle_eastern', label: 'Middle Eastern', description: 'Olive complexion, dramatic dark eyes, arched brows' },
  { id: 'custom', label: 'Custom Specification', description: 'User-specified cultural background and features' },
];

export const STYLE_PRESETS = [
  {
    id: 'traditional',
    label: 'Traditional Look',
    description: 'Authentic cultural attire (e.g. rich Kanjeevaram silk saree / embroidered lehenga, temple gold jewelry, bindi, jasmine)',
  },
  {
    id: 'modern',
    label: 'Modern Look',
    description: 'Contemporary chic styling (e.g. tailored structured blazer, clean minimal gold accents, urban elegance)',
  },
  {
    id: 'fusion',
    label: 'Indo-Western Fusion',
    description: 'Harmonious blend of ethnic fabrics and modern silhouettes (e.g. banarasi crop top, flared trousers, silver jhumkas)',
  },
  {
    id: 'streetwear',
    label: 'Urban Streetwear',
    description: 'Trend-setting oversized aesthetic, graphic elements, sneakers, effortless cool',
  },
  {
    id: 'editorial',
    label: 'High-Fashion Editorial',
    description: 'Avant-garde couture, striking geometric lighting, high-contrast vogue aesthetic',
  },
  {
    id: 'casual',
    label: 'Casual Lifestyle',
    description: 'Everyday approachable vibe, natural cozy knitwear or linen, soft morning sunlight',
  },
];

export const BODY_STRUCTURE_PRESETS = [
  { id: 'slender', label: 'Graceful Slender', description: 'Delicate bone structure, graceful posture, natural elegance' },
  { id: 'athletic', label: 'Athletic & Toned', description: 'Fit physique, defined shoulders, healthy active posture' },
  { id: 'hourglass', label: 'Classic Hourglass', description: 'Balanced feminine proportions, defined waist, statuesque presence' },
  { id: 'toned', label: 'Toned & Lean', description: 'Natural lean build, confident poise, subtle definition' },
  { id: 'curvy', label: 'Naturally Curvy', description: 'Fuller natural curves, soft contours, radiant presence' },
  { id: 'tall_statuesque', label: 'Tall & Statuesque', description: 'Long silhouette, runway proportions, high neck posture' },
];

export const SHOT_TYPES = [
  { id: 'portrait', label: 'Portrait (Head & Shoulders)', description: 'Close-up emphasizing facial expression, eyes, jewelry, and makeup' },
  { id: 'medium', label: 'Medium Shot (Waist Up)', description: 'Balanced view of styling, upper-body garment, posture, and ambiance' },
  { id: 'full_body', label: 'Full Body (Head to Toe)', description: 'Full silhouette displaying complete outfit drape, footwear, and setting' },
];

/**
 * Builds an authoritative, photorealistic prompt for Gemini / Imagen generation.
 * Enforces all Section 2 Guardrails:
 * - Adult-only (>= 25 years old)
 * - Disclosed fictional character (no real-person likeness)
 * - Safe for work (SFW)
 */
export function buildVisualModelPrompt(
  options: VisualModelOptions,
  personaName: string,
  adultAge: number
): { prompt: string; negativePrompt: string } {
  const age = Math.max(25, adultAge || 26);

  let ethnicityDesc = '';
  switch (options.ethnicity) {
    case 'south_indian':
      ethnicityDesc =
        'authentic South Indian heritage, warm glowing olive-caramel complexion, expressive deep brown almond eyes, soft arched eyebrows, natural dark lustrous hair';
      break;
    case 'north_indian':
      ethnicityDesc =
        'North Indian heritage, warm wheatish complexion, sharp sculpted features, expressive hazel-brown eyes, silky dark brown hair';
      break;
    case 'east_asian':
      ethnicityDesc =
        'East Asian heritage, smooth porcelain skin, refined facial symmetry, delicate almond eyes, sleek dark hair';
      break;
    case 'southeast_asian':
      ethnicityDesc =
        'Southeast Asian heritage, warm golden-bronze sun-kissed skin, soft expressive gaze, natural wavy hair';
      break;
    case 'latina':
      ethnicityDesc =
        'Latina heritage, rich honey-bronze complexion, high sculpted cheekbones, warm amber eyes, voluminous wavy dark hair';
      break;
    case 'caucasian':
      ethnicityDesc =
        'Nordic / European heritage, radiant fair skin with subtle natural undertones, sharp jawline, expressive clear eyes';
      break;
    case 'african':
      ethnicityDesc =
        'African heritage, deep luminous melanin-rich skin, striking bone structure, sculpted facial harmony, elegant textured dark hair';
      break;
    case 'middle_eastern':
      ethnicityDesc =
        'Middle Eastern heritage, luminous olive skin tone, deep dramatic almond eyes, defined brows, thick dark waves';
      break;
    case 'custom':
      ethnicityDesc = options.ethnicityCustom || 'distinct unique ethnic features and harmonious natural beauty';
      break;
  }

  let styleDesc = '';
  switch (options.styleLook) {
    case 'traditional':
      if (options.ethnicity === 'south_indian') {
        styleDesc =
          'traditional attire: opulent Kanjeevaram silk saree in deep jewel tones with rich pure gold zari border, traditional South Indian temple gold jewelry (jhumkas, delicate necklace), subtle auspicious bindi, fresh fragrant jasmine flowers pinned neatly into hair';
      } else if (options.ethnicity === 'north_indian') {
        styleDesc =
          'traditional attire: intricately hand-embroidered raw silk lehenga with delicate zari threadwork, polki kundan necklace and earrings, subtle small bindi, royal ethnic styling';
      } else {
        styleDesc =
          'authentic cultural heritage attire crafted from luxurious hand-woven fabrics, delicate heritage jewelry, intricate festive detailing and timeless elegance';
      }
      break;
    case 'modern':
      styleDesc =
        'contemporary modern chic aesthetic: impeccably tailored minimalist blazer over a clean silk blouse, subtle modern geometric gold earrings, polished sophisticated styling, clean urban luxury';
      break;
    case 'fusion':
      styleDesc =
        'Indo-Western fusion fashion: contemporary structured silhouette combined with rich heritage brocade textile, modern layered delicate jewelry, avant-garde elegance';
      break;
    case 'streetwear':
      styleDesc =
        'high-end streetwear styling: modern relaxed-fit designer silhouette, stylish layered textures, minimal aesthetic jewelry, effortless urban confidence';
      break;
    case 'editorial':
      styleDesc =
        'high-fashion editorial look: sculptural avant-garde designer attire, dramatic silhouettes, sleek architectural styling, vogue magazine quality';
      break;
    case 'casual':
      styleDesc =
        'relaxed chic lifestyle: premium soft cashmere knit, minimal everyday gold pendant, effortless natural hair, warm cozy ambiance';
      break;
  }

  let bodyDesc = '';
  switch (options.bodyStructure) {
    case 'slender':
      bodyDesc = 'graceful slender frame, elegant posture, delicate neckline';
      break;
    case 'athletic':
      bodyDesc = 'athletic toned physique, healthy posture, confident poise';
      break;
    case 'hourglass':
      bodyDesc = 'classic natural hourglass silhouette, balanced feminine proportions, statuesque poise';
      break;
    case 'toned':
      bodyDesc = 'toned and lean build, subtle muscle definition, natural healthy stature';
      break;
    case 'curvy':
      bodyDesc = 'naturally curvy build, soft contours, radiant confident posture';
      break;
    case 'tall_statuesque':
      bodyDesc = 'tall statuesque silhouette, model proportions, long graceful neck';
      break;
  }

  const shotDesc =
    options.shotType === 'portrait'
      ? 'Head and shoulders portrait shot, shallow depth of field with creamy bokeh, razor-sharp focus on the eyes'
      : options.shotType === 'medium'
        ? 'Medium shot waist-up, showing detailed upper-body attire, graceful hand gestures, and tasteful background context'
        : 'Full length head-to-toe shot, complete outfit drape, natural stance, grounded in a beautifully rendered architectural setting';

  const lighting =
    options.lighting ||
    'Warm natural golden-hour ambient illumination, soft cinematic fill light, delicate catchlights in the eyes, high dynamic range';

  const facialDetails = options.facialFeatures
    ? options.facialFeatures
    : 'flawless realistic skin texture with visible micro-pores, subtle natural makeup, warm serene gaze, gentle confident smile';

  const hair = options.hairStyle
    ? options.hairStyle
    : 'natural healthy hair with realistic strand details and subtle movement';

  const prompt = [
    `Ultra-photorealistic professional master photography of fictional character ${personaName}, an adult woman strictly ${age} years old.`,
    `Physical Appearance: ${ethnicityDesc}, ${facialDetails}, ${hair}, ${bodyDesc}.`,
    `Attire & Style: ${styleDesc}.`,
    `Composition: ${shotDesc}.`,
    `Lighting & Environment: ${lighting}.`,
    options.additionalPrompt ? `Additional Details: ${options.additionalPrompt}.` : '',
    `Quality standards: Hasselblad medium format camera photograph, 85mm f/1.4 lens, 8k resolution, photorealistic, hyper-detailed skin texture, subsurface scattering, authentic fabric weave and embroidery texture, perfectly formed hands and symmetrical features.`,
    `Mandatory Guardrails: Adult woman (age >= 25), fully compliant SFW, fictional character with zero likeness to any real person or celebrity, disclosed artificial persona.`,
  ]
    .filter(Boolean)
    .join(' ');

  const negativePrompt =
    'minor, child, teen, underage, youthful appearance, babyface, real person likeness, celebrity face, plastic skin, oversaturated, deformed hands, extra fingers, mutated anatomy, blur, low resolution, watermark, text, signature, nsfw, explicit, revealing, inappropriate, cartoon, 3d render, anime';

  return { prompt, negativePrompt };
}
