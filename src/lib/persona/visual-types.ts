import { buildRealismBlock, CameraPreset, Expression } from './realism';

export interface FaceCardDNA {
  jawline?: 'sharp_angular' | 'sculpted_v' | 'soft_oval' | 'square_defined' | 'heart_shaped';
  eyeShape?: 'almond_expressive' | 'deep_set' | 'doe_eyes' | 'cat_eye';
  noseBridge?: 'refined_straight' | 'delicate_button' | 'high_prominent';
  lipFullness?: 'natural_soft' | 'plush_full' | 'cupids_bow';
  facialSymmetry?: 'symmetrical' | 'high_definition';
}

export interface DimpleDNA {
  type?: 'bilateral_cheeks' | 'left_cheek' | 'right_cheek' | 'chin_cleft' | 'smile_lines' | 'none';
  depth?: 'subtle' | 'pronounced';
}

export interface SkinToneDNA {
  complexion?: 'warm_caramel' | 'olive_wheatish' | 'fair_porcelain' | 'golden_bronze' | 'deep_melanin' | 'sunset_honey' | 'custom';
  customDescription?: string;
  undertone?: 'warm_golden' | 'cool_rosy' | 'neutral_olive';
  finish?: 'dewy_glow' | 'matte' | 'luminous';
}

export interface DistinctiveMarksDNA {
  moles?:
    | 'above_lip'
    | 'cheek_beauty_mark'
    | 'under_left_eye'
    | 'collarbone'
    | 'neck'
    | 'chest_cleavage'
    | 'upper_chest_left'
    | 'sternum'
    | 'lower_cleavage'
    | 'none';
  freckles?: 'none' | 'subtle_nose' | 'cheek_dusting';
  customMark?: string;
}

export interface BodyProportionsDNA {
  silhouette?: 'hourglass' | 'athletic' | 'curvy' | 'slender' | 'pear' | 'tall_statuesque';
  upperBodyBust?: 'natural_petite' | 'moderate' | 'defined' | 'full_curve';
  lowerBodyHip?: 'slender' | 'athletic' | 'balanced' | 'accentuated_curve';
  heightStance?: 'petite' | 'balanced' | 'statuesque';
}

export interface TattooDNA {
  style?: 'minimalist_fineline' | 'floral_botanical' | 'mandala_geometric' | 'script_quote' | 'none';
  placement?:
    | 'wrist'
    | 'collarbone'
    | 'forearm'
    | 'shoulder'
    | 'ankle'
    | 'sternum_cleavage'
    | 'underbust_rib'
    | 'upper_chest_decolletage'
    | 'side_breast_rib'
    | 'none';
  description?: string;
}

export interface HairStylingDNA {
  texture?: 'silky_straight' | 'loose_waves' | 'lustrous_curls' | 'textured_coily';
  length?: 'waist_long' | 'mid_back' | 'shoulder_length' | 'chic_bob';
  accents?: 'jasmine_gajra' | 'gold_hairpins' | 'modern_clean';
}

export type CameraAngle =
  | 'front'
  | 'side'
  | 'full_body'
  | 'full_back'
  | 'full_side'
  | 'three_quarter'
  | 'profile'
  | 'candid';

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
  styleLook: 'minimal_studio' | 'traditional' | 'modern' | 'fusion' | 'streetwear' | 'editorial' | 'casual';
  bodyStructure: 'athletic' | 'slender' | 'hourglass' | 'toned' | 'curvy' | 'tall_statuesque';
  facialFeatures?: string;
  hairStyle?: string;
  lighting?: string;
  shotType: 'portrait' | 'medium' | 'full_body';
  additionalPrompt?: string;
  referenceImageUrl?: string; // Optional reference image to guide generation (non-real person)
  cameraAngle?: CameraAngle; // Multi-angle support

  // Modular Physical Identity Pieces (Persona Agent DNA)
  faceCard?: FaceCardDNA;
  dimple?: DimpleDNA;
  skinTone?: SkinToneDNA;
  distinctiveMarks?: DistinctiveMarksDNA;
  bodyProportions?: BodyProportionsDNA;
  tattoos?: TattooDNA;
  hairStyling?: HairStylingDNA;
  cameraPreset?: CameraPreset;
  expression?: Expression;
  isFaceLocked?: boolean;
  lockedFaceUrl?: string;
}

export const CAMERA_ANGLES = [
  { id: 'front', label: 'Front', description: 'Direct gaze, balanced symmetrical lighting, ideal for facial and torso reference' },
  { id: 'side', label: 'Side', description: '90° clean profile highlighting bone structure, jawline, and posture' },
  { id: 'full_body', label: 'Full view', description: 'Head-to-toe full front view displaying complete physique, proportions, and stance' },
  { id: 'full_back', label: 'Full Back view', description: '180° full back view showing rear silhouette, shoulder contours, and posture' },
  { id: 'full_side', label: 'Full Side view', description: 'Head-to-toe 90° lateral profile showcasing full-body posture, curve, and alignment' },
] as const;

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
    id: 'minimal_studio',
    label: 'Minimal Studio (Camisoles & Boxers)',
    description: 'Fitted ribbed camisole and neutral boxer shorts — designed for clean, unobstructed viewing of model physique, silhouette, skin tone, moles, and body art',
  },
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

// Presets for Modular Physical Pieces
export const FACE_JAWLINE_PRESETS = [
  { id: 'sharp_angular', label: 'Sharp Angular', desc: 'Sculpted jawline with defined contour' },
  { id: 'sculpted_v', label: 'Sculpted V-Shape', desc: 'Tapered feminine V-line chin' },
  { id: 'soft_oval', label: 'Soft Oval', desc: 'Gentle, balanced harmonious curvature' },
  { id: 'heart_shaped', label: 'Heart Shaped', desc: 'High cheekbones tapering to a delicate chin' },
  { id: 'square_defined', label: 'Square Defined', desc: 'Confident high-fashion structural definition' },
];

export const FACE_EYE_PRESETS = [
  { id: 'almond_expressive', label: 'Almond Expressive', desc: 'Deep warm almond contours, natural lift' },
  { id: 'doe_eyes', label: 'Wide Doe Eyes', desc: 'Large, gentle, expressive and captivating' },
  { id: 'cat_eye', label: 'Feline Cat-Eye', desc: 'Upturned outer corners with striking poise' },
  { id: 'deep_set', label: 'Deep Set Eyes', desc: 'Subtle sultry shadow, intense gaze' },
];

export const FACE_NOSE_PRESETS = [
  { id: 'refined_straight', label: 'Refined Straight', desc: 'Classic straight bridge with subtle tip' },
  { id: 'delicate_button', label: 'Delicate Button', desc: 'Petite, softly rounded natural tip' },
  { id: 'high_prominent', label: 'High Sculpted Bridge', desc: 'Regal aristocratic high bridge' },
];

export const FACE_LIPS_PRESETS = [
  { id: 'natural_soft', label: 'Natural Soft', desc: 'Balanced gentle proportions with soft shine' },
  { id: 'plush_full', label: 'Plush & Full', desc: 'Fuller pout with hydrated natural contour' },
  { id: 'cupids_bow', label: 'Defined Cupid’s Bow', desc: 'Crisp accentuated upper lip arch' },
];

export const DIMPLE_PRESETS = [
  { id: 'bilateral_cheeks', label: 'Both Cheeks', desc: 'Charming symmetrical cheek dimples when smiling' },
  { id: 'left_cheek', label: 'Left Cheek Dimple', desc: 'Signature playful single left dimple' },
  { id: 'right_cheek', label: 'Right Cheek Dimple', desc: 'Signature playful single right dimple' },
  { id: 'chin_cleft', label: 'Subtle Chin Cleft', desc: 'Distinguished delicate cleft in chin center' },
  { id: 'smile_lines', label: 'Soft Smile Lines', desc: 'Warm authentic laughter lines around mouth' },
  { id: 'none', label: 'No Dimples', desc: 'Smooth uninterrupted cheek surface' },
];

export const SKIN_COMPLEXION_PRESETS = [
  { id: 'warm_caramel', label: 'Warm Caramel', desc: 'Rich golden-caramel skin with luminous depth' },
  { id: 'olive_wheatish', label: 'Olive Wheatish', desc: 'Warm sunlit olive tones, natural balance' },
  { id: 'golden_bronze', label: 'Golden Bronze', desc: 'Sun-kissed honey bronze with warm radiance' },
  { id: 'deep_melanin', label: 'Radiant Deep Melanin', desc: 'Deep lustrous complexion with velvety glow' },
  { id: 'fair_porcelain', label: 'Porcelain Ivory', desc: 'Translucent ivory with soft peach undertones' },
  { id: 'sunset_honey', label: 'Sunset Honey', desc: 'Glowing amber-honey skin tone' },
];

export const DISTINCTIVE_MARKS_PRESETS = [
  { id: 'above_lip', label: 'Beauty Mark (Upper Lip)', desc: 'Iconic delicate mole above the upper lip' },
  { id: 'cheek_beauty_mark', label: 'Cheek Beauty Spot', desc: 'High cheekbone accent mark' },
  { id: 'under_left_eye', label: 'Under Left Eye', desc: 'Tear-drop location subtle beauty spot' },
  { id: 'collarbone', label: 'Collarbone Mole', desc: 'Delicate beauty spot resting on collarbone' },
  { id: 'neck', label: 'Side of Neck', desc: 'Subtle side-neck mark' },
  { id: 'chest_cleavage', label: 'Chest / Cleavage Mole', desc: 'Alluring delicate beauty mark centered in the cleavage / chest area' },
  { id: 'upper_chest_left', label: 'Upper Chest / Left Breast Accent', desc: 'Natural beauty spot on upper chest above left breast curve' },
  { id: 'sternum', label: 'Sternum Beauty Mark', desc: 'Centered delicate beauty spot between breasts along the sternum' },
  { id: 'lower_cleavage', label: 'Lower Cleavage Beauty Spot', desc: 'Subtle sultry beauty spot nestled in lower cleavage contour' },
  { id: 'none', label: 'Clean Skin (No Moles)', desc: 'Flawless uniform canvas' },
];

export const UPPER_BODY_BUST_PRESETS = [
  { id: 'natural_petite', label: 'Petite Frame', desc: 'Delicate upper proportions, lean silhouette' },
  { id: 'moderate', label: 'Balanced Moderate', desc: 'Proportional natural upper curvature' },
  { id: 'defined', label: 'Defined Form', desc: 'Sculpted and athletic upper definition' },
  { id: 'full_curve', label: 'Full Natural Curves', desc: 'Lush natural curvature and soft contours' },
];

export const LOWER_BODY_HIP_PRESETS = [
  { id: 'slender', label: 'Slender Line', desc: 'Streamlined straight silhouette line' },
  { id: 'athletic', label: 'Athletic Toned', desc: 'Firm athletic curvature and tone' },
  { id: 'balanced', label: 'Balanced Natural', desc: 'Harmonious classic hip-to-waist ratio' },
  { id: 'accentuated_curve', label: 'Accentuated Hip Curve', desc: 'Dramatic feminine hourglass hip sweep' },
];

export const TATTOO_STYLE_PRESETS = [
  { id: 'none', label: 'No Tattoos', desc: 'Bare natural skin without ink' },
  { id: 'minimalist_fineline', label: 'Minimalist Fine-Line', desc: 'Ultra-thin single-needle delicate aesthetic art' },
  { id: 'floral_botanical', label: 'Botanical Floral', desc: 'Dainty wildflowers, lotus, or vine tracery' },
  { id: 'mandala_geometric', label: 'Mandala / Sacred Geometry', desc: 'Intricate circular symmetrical patterns' },
  { id: 'script_quote', label: 'Subtle Script', desc: 'Elegant micro-cursive lettering' },
];

export const TATTOO_PLACEMENT_PRESETS = [
  { id: 'none', label: 'None', desc: 'No placement' },
  { id: 'sternum_cleavage', label: 'Sternum / Cleavage Center', desc: 'Intricate fine-line or ornamental sacred geometry between breasts / sternum' },
  { id: 'underbust_rib', label: 'Underbust / Ribcage', desc: 'Delicate botanical or fine-line script flowing under the breast curve along the ribcage' },
  { id: 'upper_chest_decolletage', label: 'Upper Chest / Décolletage', desc: 'Graceful script or botanical branch tracing across the upper chest and décolletage' },
  { id: 'side_breast_rib', label: 'Side Breast / Rib Accent', desc: 'Discreet fine-line aesthetic script or floral accent on the side breast / ribline' },
  { id: 'collarbone', label: 'Along Collarbone', desc: 'Delicate tracery following the clavicle line' },
  { id: 'wrist', label: 'Inner Wrist', desc: 'Discreet inner wrist accent' },
  { id: 'forearm', label: 'Outer Forearm', desc: 'Visible modern art placement' },
  { id: 'shoulder', label: 'Shoulder Blade', desc: 'Graceful shoulder blade accent' },
  { id: 'ankle', label: 'Outer Ankle', desc: 'Subtle low-profile ankle design' },
];

/**
 * Builds an authoritative, photorealistic prompt for Gemini / Imagen generation.
 * Injects all modular Persona Agent DNA pieces:
 * - Face Card (jawline, eyes, nose, lips)
 * - Dimples & Facial Nuances
 * - Skin Tone, Undertone & Finish
 * - Distinctive Marks & Moles
 * - Body Proportions (Silhouette, upper bust, lower hip curve, height)
 * - Tattoos & Body Art
 * - Hair Styling & Cultural Accents
 */
export function buildVisualModelPrompt(
  options: VisualModelOptions,
  personaName: string,
  adultAge: number
): { prompt: string; negativePrompt: string } {
  const age = Math.max(21, adultAge || 21);

  // 1. Ethnicity
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

  // 2. Face Card DNA
  const faceParts: string[] = [];
  if (options.faceCard) {
    if (options.faceCard.jawline) {
      faceParts.push(`jawline: ${options.faceCard.jawline.replace(/_/g, ' ')}`);
    }
    if (options.faceCard.eyeShape) {
      faceParts.push(`eyes: ${options.faceCard.eyeShape.replace(/_/g, ' ')}`);
    }
    if (options.faceCard.noseBridge) {
      faceParts.push(`nose: ${options.faceCard.noseBridge.replace(/_/g, ' ')}`);
    }
    if (options.faceCard.lipFullness) {
      faceParts.push(`lips: ${options.faceCard.lipFullness.replace(/_/g, ' ')}`);
    }
  }

  // 3. Dimples & Nuances
  let dimpleDesc = '';
  if (options.dimple && options.dimple.type && options.dimple.type !== 'none') {
    dimpleDesc = `${options.dimple.depth || 'subtle'} ${options.dimple.type.replace(/_/g, ' ')}`;
  }

  // 4. Skin Tone & Finish
  let skinToneDesc = '';
  if (options.skinTone) {
    const complexion = options.skinTone.complexion
      ? options.skinTone.complexion.replace(/_/g, ' ')
      : 'warm glowing';
    const finish = options.skinTone.finish
      ? options.skinTone.finish.replace(/_/g, ' ')
      : 'dewy glow';
    skinToneDesc = `${complexion} skin tone with a natural ${finish}`;
  }

  // 5. Distinctive Marks (Moles & Freckles)
  const marksParts: string[] = [];
  if (options.distinctiveMarks) {
    if (options.distinctiveMarks.moles && options.distinctiveMarks.moles !== 'none') {
      let molePlace = options.distinctiveMarks.moles.replace(/_/g, ' ');
      if (options.distinctiveMarks.moles === 'chest_cleavage') {
        molePlace = 'the central chest and cleavage area';
      } else if (options.distinctiveMarks.moles === 'upper_chest_left') {
        molePlace = 'the upper chest curve above the left breast';
      } else if (options.distinctiveMarks.moles === 'sternum') {
        molePlace = 'the center of the sternum between the breasts';
      } else if (options.distinctiveMarks.moles === 'lower_cleavage') {
        molePlace = 'the lower cleavage contour';
      }
      marksParts.push(`signature beauty mark / mole located at ${molePlace}`);
    }
    if (options.distinctiveMarks.freckles && options.distinctiveMarks.freckles !== 'none') {
      marksParts.push(`${options.distinctiveMarks.freckles.replace(/_/g, ' ')} freckles`);
    }
    if (options.distinctiveMarks.customMark) {
      marksParts.push(options.distinctiveMarks.customMark);
    }
  }

  // 6. Body Silhouette & Proportions
  const bodyParts: string[] = [];
  if (options.bodyProportions) {
    if (options.bodyProportions.silhouette) {
      bodyParts.push(`${options.bodyProportions.silhouette.replace(/_/g, ' ')} silhouette`);
    }
    if (options.bodyProportions.upperBodyBust) {
      bodyParts.push(`${options.bodyProportions.upperBodyBust.replace(/_/g, ' ')} upper proportions`);
    }
    if (options.bodyProportions.lowerBodyHip) {
      bodyParts.push(`${options.bodyProportions.lowerBodyHip.replace(/_/g, ' ')} hip curve`);
    }
  } else if (options.bodyStructure) {
    bodyParts.push(options.bodyStructure.replace(/_/g, ' '));
  }

  // 7. Tattoos & Body Art
  let tattooDesc = '';
  if (options.tattoos && options.tattoos.style && options.tattoos.style !== 'none') {
    let placeStr = options.tattoos.placement ? options.tattoos.placement.replace(/_/g, ' ') : 'tastefully placed';
    if (options.tattoos.placement === 'sternum_cleavage') {
      placeStr = 'the sternum and center cleavage between breasts';
    } else if (options.tattoos.placement === 'underbust_rib') {
      placeStr = 'under the breast curve along the ribcage';
    } else if (options.tattoos.placement === 'upper_chest_decolletage') {
      placeStr = 'the upper chest and décolletage';
    } else if (options.tattoos.placement === 'side_breast_rib') {
      placeStr = 'the side of the breast along the ribline';
    }
    const place = options.tattoos.placement && options.tattoos.placement !== 'none'
      ? `on ${placeStr}`
      : 'tastefully placed';
    const note = options.tattoos.description ? ` (${options.tattoos.description})` : '';
    tattooDesc = `discrete body art: ${options.tattoos.style.replace(/_/g, ' ')} tattoo ${place}${note}`;
  }

  // 8. Style Look
  let styleDesc = '';
  switch (options.styleLook) {
    case 'minimal_studio':
      styleDesc =
        'minimal studio reference attire: clean fitted neutral ribbed camisole top and matching neutral boxer shorts, unobtrusive minimalist styling to provide a clear, unobstructed full view of the model physique, natural silhouette, skin tone, chest, cleavage, and body traits';
      break;
    case 'traditional':
      if (options.ethnicity === 'south_indian') {
        styleDesc =
          'traditional attire: opulent Kanjeevaram silk saree in deep jewel tones with rich pure gold zari border, traditional South Indian temple gold jewelry (jhumkas, delicate necklace), subtle auspicious bindi, fresh fragrant jasmine flowers pinned neatly into hair';
      } else if (options.ethnicity === 'north_indian') {
        styleDesc =
          'traditional attire: hand-embroidered silk lehenga with delicate zari threadwork, polki kundan necklace and earrings, subtle small bindi, royal ethnic styling';
      } else {
        styleDesc =
          'authentic cultural heritage attire crafted from luxurious hand-woven fabrics, delicate heritage jewelry, intricate festive detailing';
      }
      break;
    case 'modern':
      styleDesc =
        'contemporary modern chic aesthetic: tailored minimalist blazer over clean silk blouse, subtle modern geometric gold earrings, polished sophisticated urban luxury';
      break;
    case 'fusion':
      styleDesc =
        'Indo-Western fusion fashion: contemporary structured silhouette combined with rich heritage brocade textile, modern layered delicate jewelry';
      break;
    case 'streetwear':
      styleDesc =
        'high-end streetwear styling: modern relaxed-fit designer silhouette, stylish layered textures, minimal aesthetic jewelry';
      break;
    case 'editorial':
      styleDesc =
        'high-fashion editorial look: sculptural avant-garde designer attire, dramatic silhouettes, sleek architectural styling';
      break;
    case 'casual':
      styleDesc =
        'relaxed chic lifestyle: premium soft cashmere knit, minimal everyday gold pendant, effortless natural hair, warm cozy ambiance';
      break;
  }

  const shotDesc =
    options.shotType === 'portrait'
      ? 'Head and shoulders portrait shot, shallow depth of field with creamy bokeh, razor-sharp focus on the eyes'
      : options.shotType === 'medium'
        ? 'Medium shot waist-up, showing detailed upper-body attire, graceful posture, and tasteful background context'
        : 'Full length head-to-toe shot, complete outfit drape, natural stance, grounded in a beautifully rendered setting';

  const lighting =
    options.lighting ||
    'Warm natural golden-hour ambient illumination, soft cinematic fill light, delicate catchlights in the eyes, high dynamic range';

  let angleDesc = '';
  switch (options.cameraAngle) {
    case 'front':
      angleDesc = 'Direct front-facing portrait (0° angle), eye-level master reference portraiture';
      break;
    case 'side':
    case 'profile':
      angleDesc = 'Clean side profile view (90° angle), highlighting facial profile, nose bridge, posture, and side silhouette';
      break;
    case 'full_body':
      angleDesc = 'Full length head-to-toe view (0° front), displaying entire physique, proportions, and natural stance';
      break;
    case 'full_back':
      angleDesc = 'Full back view (180° rear), complete head-to-toe rear perspective showing back silhouette, shoulder blades, and posture';
      break;
    case 'full_side':
      angleDesc = 'Full side view head-to-toe profile (90° side angle), displaying complete lateral silhouette, posture, and proportions';
      break;
    case 'three_quarter':
      angleDesc = 'Dynamic three-quarter angle (45° view), turning gracefully towards the camera, accentuating cheekbones and jawline';
      break;
    case 'candid':
      angleDesc = 'Spontaneous candid lifestyle angle, natural unposed expression, relaxed authentic moment captured naturally';
      break;
  }

  const prompt = [
    `Ultra-photorealistic professional master photography of an adult woman strictly ${age} years old.`,
    angleDesc ? `Camera Perspective: ${angleDesc}.` : '',
    `Ethnicity: ${ethnicityDesc}.`,
    faceParts.length > 0 ? `Facial Features: ${faceParts.join(', ')}.` : '',
    dimpleDesc ? `Dimple Feature: ${dimpleDesc}.` : '',
    skinToneDesc ? `Complexion: ${skinToneDesc}.` : '',
    marksParts.length > 0 ? `Distinctive Marks: ${marksParts.join(', ')}.` : '',
    bodyParts.length > 0 ? `Body Proportions: ${bodyParts.join(', ')}.` : '',
    tattooDesc ? `Body Art: ${tattooDesc}.` : '',
    options.hairStyle ? `Hair: ${options.hairStyle}.` : '',
    `Attire & Style: ${styleDesc}.`,
    `Composition: ${shotDesc}.`,
    `Lighting & Environment: ${lighting}.`,
    options.referenceImageUrl ? 'Identity Anchor: Maintain precise facial structure, bone structure, and likeness from approved persona reference model.' : '',
    options.additionalPrompt ? `Additional Details: ${options.additionalPrompt}.` : '',
    buildRealismBlock({ cameraPreset: options.cameraPreset, expression: options.expression }),
    `Quality standards: Hasselblad medium format camera photograph, 85mm f/1.4 lens, 8k resolution, photorealistic, hyper-detailed skin texture, subsurface scattering, authentic fabric weave and embroidery texture, perfectly formed hands and symmetrical features.`,
    `Mandatory Guardrails: Adult woman (age >= 21), fully compliant SFW, fictional character with zero likeness to any real person or celebrity.`,
  ]
    .filter(Boolean)
    .join(' ');

  const negativePrompt =
    'minor, child, teen, underage, youthful appearance, babyface, real person likeness, celebrity face, plastic skin, oversaturated, deformed hands, extra fingers, mutated anatomy, blur, low resolution, watermark, text, signature, nsfw, explicit, revealing, inappropriate, cartoon, 3d render, anime';

  return { prompt, negativePrompt };
}

/**
 * Formats modular physical DNA attributes into a clean, human-readable summary
 * for updating persona.appearanceNotes.
 */
export function formatPhysicalDNASummary(options: VisualModelOptions): string {
  const lines: string[] = [];

  // Face Card
  if (options.faceCard) {
    const faceItems = [
      options.faceCard.jawline ? `Jawline: ${options.faceCard.jawline.replace(/_/g, ' ')}` : '',
      options.faceCard.eyeShape ? `Eyes: ${options.faceCard.eyeShape.replace(/_/g, ' ')}` : '',
      options.faceCard.noseBridge ? `Nose: ${options.faceCard.noseBridge.replace(/_/g, ' ')}` : '',
      options.faceCard.lipFullness ? `Lips: ${options.faceCard.lipFullness.replace(/_/g, ' ')}` : '',
    ].filter(Boolean);
    if (faceItems.length) lines.push(`• Face Card: ${faceItems.join(' | ')}`);
  }

  // Dimples
  if (options.dimple && options.dimple.type && options.dimple.type !== 'none') {
    lines.push(`• Dimple: ${options.dimple.depth || 'Subtle'} ${options.dimple.type.replace(/_/g, ' ')}`);
  }

  // Skin Tone
  if (options.skinTone) {
    lines.push(
      `• Skin Tone: ${options.skinTone.complexion?.replace(/_/g, ' ') || 'Warm'} (${options.skinTone.undertone || 'warm'} undertone, ${options.skinTone.finish || 'dewy'} finish)`
    );
  }

  // Distinctive Marks
  if (options.distinctiveMarks) {
    const marks: string[] = [];
    if (options.distinctiveMarks.moles && options.distinctiveMarks.moles !== 'none') {
      const moleLabel = DISTINCTIVE_MARKS_PRESETS.find((p) => p.id === options.distinctiveMarks?.moles)?.label || options.distinctiveMarks.moles.replace(/_/g, ' ');
      marks.push(moleLabel);
    }
    if (options.distinctiveMarks.freckles && options.distinctiveMarks.freckles !== 'none') {
      marks.push(`${options.distinctiveMarks.freckles.replace(/_/g, ' ')} freckles`);
    }
    if (marks.length) lines.push(`• Distinctive Marks: ${marks.join(', ')}`);
  }

  // Body Proportions
  if (options.bodyProportions) {
    lines.push(
      `• Body Silhouette: ${options.bodyProportions.silhouette?.replace(/_/g, ' ') || 'Hourglass'} | Bust: ${options.bodyProportions.upperBodyBust?.replace(/_/g, ' ') || 'Moderate'} | Hip: ${options.bodyProportions.lowerBodyHip?.replace(/_/g, ' ') || 'Balanced'}`
    );
  }

  // Tattoos
  if (options.tattoos && options.tattoos.style && options.tattoos.style !== 'none') {
    const placeLabel = TATTOO_PLACEMENT_PRESETS.find((p) => p.id === options.tattoos?.placement)?.label || options.tattoos.placement || 'wrist';
    lines.push(`• Body Art: ${options.tattoos.style.replace(/_/g, ' ')} on ${placeLabel}`);
  }

  return lines.join('\n');
}

export interface PersonaAngleItem {
  angle: CameraAngle;
  label: string;
  url: string;
}

/**
 * Returns available multi-angle reference portraits (client-safe).
 * Always returns the 5 requested views by default:
 * 1. Front
 * 2. Side
 * 3. Full view
 * 4. Full Back view
 * 5. Full Side view
 */
export function getPersonaMultiAnglePackClient(
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

import { ApiError } from '@/lib/api/error';

export type VisualErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_UNSUPPORTED'
  | 'GEN_UPSTREAM_ERROR'
  | 'GEN_TIMEOUT'
  | 'GPU_OFFLINE'
  | 'PROMPT_REJECTED'
  | 'SAFETY_BLOCKED'
  | 'PERSONA_NOT_FOUND'
  | 'ASSET_NOT_FOUND'
  | 'FORBIDDEN_ASSET'
  | 'INVALID_ASSET_KIND'
  | 'SAFETY_STATUS_NOT_PASSED'
  | 'MISSING_ETHNICITY';

export class VisualGenerationError extends ApiError {
  constructor(
    public code: VisualErrorCode,
    message: string,
    statusCode: number = 502,
    public details?: unknown
  ) {
    super(statusCode, message);
    this.name = 'VisualGenerationError';
  }
}

