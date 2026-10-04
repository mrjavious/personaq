export type CameraPreset = 'phone_selfie' | 'candid_35mm' | 'portrait_85mm';

export type Expression =
  | 'soft half-smile'
  | 'mid-laugh'
  | 'thoughtful glance'
  | 'subtle closed-lip smile'
  | 'calm deadpan'
  | 'neutral';

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  'phone_selfie',
  'candid_35mm',
  'portrait_85mm',
] as const;

export const EXPRESSIONS: readonly Expression[] = [
  'soft half-smile',
  'mid-laugh',
  'thoughtful glance',
  'subtle closed-lip smile',
  'calm deadpan',
  'neutral',
] as const;

export const CAMERA_PRESET_DETAILS: Record<CameraPreset, string> = {
  phone_selfie:
    'captured with a modern smartphone front camera (~24mm wide angle equivalent), high handheld perspective, subtle wide-angle distortion at edges, natural smartphone HDR dynamic range, slight handheld motion realism',
  candid_35mm:
    'shot on a 35mm prime lens on full frame camera, natural human field of view, organic documentary candid framing, subtle environmental depth of field with sharp subject plane, authentic un-posed snapshot feel',
  portrait_85mm:
    'captured on an 85mm f/1.8 telephoto portrait lens, creamy cinematic background bokeh blur, flattering facial perspective compression, pin-sharp focal plane locked on the eyes with gentle roll-off',
};

export const REALISM_CORE_RULES = [
  'natural human skin texture with visible micro-pores, fine lines, subtle blemishes, natural skin undertones, and organic facial asymmetry (strictly zero airbrushing, zero plastic skin smoothing, zero doll-like porcelain filter)',
  'directional scene lighting consistent with environmental light sources and physically accurate shadow direction and softness',
  'correct physical material reflections: natural corneal eye catchlights reflecting ambient light, authentic fabric sheen and texture highlights, specular hair sheen',
  'fabric realistically following gravity with natural folds, creases, and organic tension points',
  'candid slightly imperfect framing with authentic non-stock body language',
  'lens-appropriate optical depth of field with authentic circular bokeh and chromatic depth roll-off',
];

export interface RealismBlockOptions {
  cameraPreset?: CameraPreset;
  expression?: Expression;
  customAtmosphere?: string;
}

export function buildRealismBlock(options?: RealismBlockOptions): string {
  const parts: string[] = [];

  // 1. Expression
  if (options?.expression) {
    parts.push(`Expression: ${options.expression}, natural relaxed facial muscles without exaggerated posing.`);
  }

  // 2. Camera preset
  if (options?.cameraPreset && CAMERA_PRESET_DETAILS[options.cameraPreset]) {
    parts.push(`Camera Optics (${options.cameraPreset}): ${CAMERA_PRESET_DETAILS[options.cameraPreset]}.`);
  }

  // 3. Core photographic realism rules
  parts.push(`Photographic Realism Directives: ${REALISM_CORE_RULES.join('; ')}.`);

  if (options?.customAtmosphere) {
    parts.push(`Atmosphere: ${options.customAtmosphere}.`);
  }

  return parts.join('\n');
}
