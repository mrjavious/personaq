export interface LightingRecipe {
  keyDirection?: string;
  timeOfDay?: string;
  volumetric?: string;
  rimLight?: string;
  bokeh?: string;
  colourGrade?: string;
}

export interface BuildShotPromptInput {
  persona: {
    name: string;
    identityText?: string | null;
    appearanceNotes: string;
    adultAge: number;
  };
  sceneSet: {
    name: string;
    setText: string;
    lightingJson: string | LightingRecipe;
  };
  template: {
    name: string;
    kind: string;
    framing: string;
    lens: string;
    aperture: string;
    cameraState: string;
    aspectRatio: string;
    defaultExpression: string;
    negativeText: string;
  };
  expression?: string;
  action?: string;
}

export interface ShotPromptResult {
  prompt: string;
  negativePrompt: string;
  identityTextVerbatim: string;
  setTextVerbatim: string;
  aspectRatio: string;
}

export interface VideoBeat {
  startSec: number;
  endSec: number;
  action: string;
}

export interface VideoPromptResult {
  videoPrompt: string;
  beats: VideoBeat[];
}

export function parseLightingRecipe(lighting: string | LightingRecipe): LightingRecipe {
  if (typeof lighting === 'object' && lighting !== null) {
    return lighting;
  }
  try {
    return JSON.parse(lighting);
  } catch {
    return {
      keyDirection: '45-degree key light from camera left',
      timeOfDay: 'golden hour soft natural ambient',
      volumetric: 'subtle atmospheric dust motes and soft light rays',
      rimLight: 'gentle edge rim lighting outlining shoulders and hair',
      bokeh: 'natural circular optical bokeh in background',
      colourGrade: 'cinematic neutral warm grade, authentic skin tones',
    };
  }
}

export function formatLightingRecipe(recipe: LightingRecipe): string {
  const parts: string[] = [];
  if (recipe.keyDirection) parts.push(`Key direction: ${recipe.keyDirection}`);
  if (recipe.timeOfDay) parts.push(`Time of day: ${recipe.timeOfDay}`);
  if (recipe.volumetric) parts.push(`Volumetric effects: ${recipe.volumetric}`);
  if (recipe.rimLight) parts.push(`Rim light: ${recipe.rimLight}`);
  if (recipe.bokeh) parts.push(`Bokeh: ${recipe.bokeh}`);
  if (recipe.colourGrade) parts.push(`Colour grade: ${recipe.colourGrade}`);

  return parts.length > 0 ? parts.join(', ') : 'natural soft directional ambient lighting';
}

/**
 * Builds prompt strictly in fixed order:
 * 1. identityText (verbatim)
 * 2. action / expression
 * 3. sceneSet.setText (verbatim)
 * 4. light recipe
 * 5. lens / aperture / framing / camera state
 * 6. aspect ratio
 * 7. negative text ("no text, no logos, no stickers")
 *
 * Identity text and scene set text are NEVER paraphrased.
 * Third-party logos or brands are NEVER injected.
 */
export function buildShotPrompt(input: BuildShotPromptInput): ShotPromptResult {
  // 1. Identity Text (strictly verbatim)
  const identityTextVerbatim = (input.persona.identityText || input.persona.appearanceNotes).trim();

  // 2. Action / Expression
  const effectiveExpression = (input.expression || input.template.defaultExpression || 'neutral').trim();
  const effectiveAction = (input.action || 'standing naturally').trim();
  const actionExpressionText = `Action: ${effectiveAction}. Expression: ${effectiveExpression}, relaxed natural facial muscles.`;

  // 3. Scene Set Text (strictly verbatim)
  const setTextVerbatim = input.sceneSet.setText.trim();

  // 4. Light Recipe
  const parsedLighting = parseLightingRecipe(input.sceneSet.lightingJson);
  const lightingRecipeText = `Lighting Recipe: ${formatLightingRecipe(parsedLighting)}.`;

  // 5. Lens / Aperture / Framing / Camera State
  const cameraOpticsText = `Camera & Optics: Framing: ${input.template.framing}. Lens: ${input.template.lens}. Aperture: ${input.template.aperture}. Camera State: ${input.template.cameraState}.`;

  // 6. Aspect Ratio
  const aspectRatioText = `Aspect Ratio: ${input.template.aspectRatio || '1:1'}.`;

  // 7. Negative Text
  const negativeConstraintsText = `Negative Constraints: ${input.template.negativeText || 'no text, no logos, no stickers, no watermarks, no third-party branding'}.`;

  // Strict fixed order assembly
  const sections = [
    identityTextVerbatim,
    actionExpressionText,
    setTextVerbatim,
    lightingRecipeText,
    cameraOpticsText,
    aspectRatioText,
    negativeConstraintsText,
  ];

  const prompt = sections.join('\n\n');

  // Hard negative prompt: strictly no text, no logos, no brands, no minors
  const negativePrompt = [
    input.template.negativeText || 'no text, no logos, no stickers',
    'watermark',
    'brand logo',
    'trademark',
    'sponsor brand',
    'minor',
    'underage',
    'youthful appearance',
    'child',
    'teen',
    'plastic skin',
    'oversmoothed',
    'distorted anatomy',
    'extra limbs',
  ].join(', ');

  return {
    prompt,
    negativePrompt,
    identityTextVerbatim,
    setTextVerbatim,
    aspectRatio: input.template.aspectRatio || '1:1',
  };
}

/**
 * Builds video camera direction and timing beats beside each image asset.
 * Rule: single camera move; subject stays still unless a beat says otherwise.
 */
export function buildVideoPromptForAsset(
  template: { name: string; kind: string; cameraState: string },
  actionText?: string
): VideoPromptResult {
  let videoPrompt: string;
  let beats: VideoBeat[];

  switch (template.kind) {
    case 'portrait':
      videoPrompt =
        'Single continuous camera move: slow cinematic push-in towards the subject; subject maintains still posture with subtle natural eye blink and soft micro-breathing motion.';
      beats = [
        {
          startSec: 0,
          endSec: 2,
          action: 'Subject holds still posture maintaining direct eye gaze, subtle natural eye blink.',
        },
        {
          startSec: 2,
          endSec: 4,
          action: 'Camera pushes in steadily towards subject eye plane, subtle soft breathing movement.',
        },
        {
          startSec: 4,
          endSec: 5,
          action: 'Camera rests in locked close-up; subject soft natural half-smile relaxation.',
        },
      ];
      break;

    case 'action':
      videoPrompt =
        'Single continuous camera move: smooth lateral tracking dolly move alongside subject; subject maintains still focal pose, ambient environment moves gently in parallax.';
      beats = [
        {
          startSec: 0,
          endSec: 2,
          action: `Subject in static action stance (${actionText || 'composed posture'}), background elements show gentle ambient motion.`,
        },
        {
          startSec: 2,
          endSec: 5,
          action: 'Smooth linear dolly tracking past subject; subject holds primary stance with natural subtle gaze shift.',
        },
      ];
      break;

    case 'full_body':
      videoPrompt =
        'Single continuous camera move: slow cinematic vertical crane pedestal up from waist to full head height; subject stands still with natural weight transfer.';
      beats = [
        {
          startSec: 0,
          endSec: 2,
          action: 'Camera static wide; subject stands still in natural relaxed grounded stance.',
        },
        {
          startSec: 2,
          endSec: 5,
          action: 'Camera rises steadily vertically; subject maintains grounded posture with slight breathing rhythm.',
        },
      ];
      break;

    case 'detail':
    default:
      videoPrompt =
        'Single continuous camera move: static locked macro lens focus with subtle rack focus from foreground garment texture to eyes; subject remains still.';
      beats = [
        {
          startSec: 0,
          endSec: 3,
          action: 'Focal plane locked sharply on micro-texture; subject remains completely still.',
        },
        {
          startSec: 3,
          endSec: 5,
          action: 'Gentle rack focus transition towards eyes; subject blinks naturally once.',
        },
      ];
      break;
  }

  return {
    videoPrompt,
    beats,
  };
}
