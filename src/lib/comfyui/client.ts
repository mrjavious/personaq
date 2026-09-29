/**
 * ComfyUI HTTP Client
 * Orchestrates local ComfyUI instance via its HTTP API (Flux/SD + Character LoRA).
 * Generates SFW persona imagery locally. Does not embed weights.
 */

export interface ComfyJobParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  seed?: number;
  steps?: number;
  characterLora?: string;
  loraWeight?: number;
}

export interface ComfyStatusResult {
  connected: boolean;
  endpoint: string;
  queueRemaining: number;
  message: string;
}

const DEFAULT_COMFY_URL = process.env.COMFYUI_API_URL || 'http://127.0.0.1:8188';

export async function checkComfyStatus(): Promise<ComfyStatusResult> {
  try {
    const res = await fetch(`${DEFAULT_COMFY_URL}/system_stats`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return {
        connected: false,
        endpoint: DEFAULT_COMFY_URL,
        queueRemaining: 0,
        message: `ComfyUI returned status ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      connected: true,
      endpoint: DEFAULT_COMFY_URL,
      queueRemaining: data?.exec_info?.queue_remaining ?? 0,
      message: 'ComfyUI HTTP API connected and ready',
    };
  } catch (error) {
    return {
      connected: false,
      endpoint: DEFAULT_COMFY_URL,
      queueRemaining: 0,
      message: `ComfyUI offline or unreachable at ${DEFAULT_COMFY_URL}: ${error instanceof Error ? error.message : 'Connection refused'}`,
    };
  }
}

/**
 * Builds a standardized SFW Character generation workflow payload for ComfyUI.
 * Enforces negative prompts against minors, celebrities, and explicit content.
 */
export function buildComfyWorkflow(params: ComfyJobParams) {
  // Dimension mapping
  let width = 1024;
  let height = 1024;
  if (params.aspectRatio === '4:5') {
    width = 896;
    height = 1152;
  } else if (params.aspectRatio === '9:16') {
    width = 768;
    height = 1344;
  } else if (params.aspectRatio === '16:9') {
    width = 1344;
    height = 768;
  }

  // Mandatory Guardrail Negative Prompt
  const mandatoryNegative =
    'minor, child, underage, teen, youthful appearance, celebrity, real person likeness, explicit, nude, nsfw, deformed, distorted, low quality';

  const combinedNegative = params.negativePrompt
    ? `${mandatoryNegative}, ${params.negativePrompt}`
    : mandatoryNegative;

  // Basic API prompt graph
  return {
    client_id: 'personaq_studio',
    prompt: {
      '3': {
        class_type: 'KSampler',
        inputs: {
          cfg: 7,
          denoise: 1,
          latent_image: ['5', 0],
          model: ['4', 0],
          negative: ['7', 0],
          positive: ['6', 0],
          sampler_name: 'euler',
          scheduler: 'normal',
          seed: params.seed || Math.floor(Math.random() * 1000000000),
          steps: params.steps || 25,
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: 'flux1-dev.sft',
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          batch_size: 1,
          height,
          width,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['4', 1],
          text: `Aria Nova AI persona, stylized digital artist aesthetic, ${params.prompt}`,
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['4', 1],
          text: combinedNegative,
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'personaq_aria',
          images: ['8', 0],
        },
      },
    },
  };
}

/**
 * Queue a generation job on ComfyUI
 */
export async function queueComfyGeneration(params: ComfyJobParams): Promise<{ promptId: string }> {
  const workflow = buildComfyWorkflow(params);

  const res = await fetch(`${DEFAULT_COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ComfyUI queue failed: ${errorText}`);
  }

  const data = await res.json();
  return { promptId: data.prompt_id };
}
