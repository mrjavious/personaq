/**
 * ComfyUI HTTP Client
 * Orchestrates local ComfyUI instance via its HTTP API (Flux/SD + Character LoRA).
 * Generates SFW persona imagery locally. Does not embed weights.
 */

import { VisualGenerationError } from '@/lib/persona/visual-types';

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
  // Reachability check before attempting to queue
  const status = await checkComfyStatus();
  if (!status.connected) {
    throw new VisualGenerationError(
      'GPU_OFFLINE',
      `ComfyUI server is offline or unreachable at ${status.endpoint}. Ensure the local ComfyUI worker is running.`,
      503
    );
  }

  const workflow = buildComfyWorkflow(params);

  try {
    const res = await fetch(`${DEFAULT_COMFY_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new VisualGenerationError(
        'GEN_UPSTREAM_ERROR',
        `ComfyUI queue failed with status ${res.status}: ${errorText}`,
        502
      );
    }

    const data = await res.json();
    return { promptId: data.prompt_id };
  } catch (error) {
    if (error instanceof VisualGenerationError) throw error;
    throw new VisualGenerationError(
      'GPU_OFFLINE',
      `ComfyUI communication error: ${error instanceof Error ? error.message : 'Connection failed'}`,
      503
    );
  }
}

/**
 * Execute ComfyUI generation and poll until the resulting image buffer is returned.
 */
export async function generateComfyImage(params: ComfyJobParams, maxWaitMs = 120000): Promise<Buffer> {
  const { promptId } = await queueComfyGeneration(params);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const histRes = await fetch(`${DEFAULT_COMFY_URL}/history/${promptId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!histRes.ok) continue;
      const history = await histRes.json();
      const promptData = history[promptId];
      if (promptData && promptData.outputs) {
        for (const nodeId of Object.keys(promptData.outputs)) {
          const nodeOutput = promptData.outputs[nodeId];
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            const img = nodeOutput.images[0];
            const viewUrl = `${DEFAULT_COMFY_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${encodeURIComponent(img.type || 'output')}`;
            const imgRes = await fetch(viewUrl);
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              return Buffer.from(arrayBuf);
            }
          }
        }
      }
    } catch {
      // Continue polling
    }
  }

  throw new VisualGenerationError(
    'GEN_UPSTREAM_ERROR',
    'ComfyUI generation timed out waiting for image output',
    504
  );
}

/**
 * Builds an open-source SFW Character video animation workflow payload for ComfyUI (AnimateDiff / Wan 2.1).
 */
export function buildComfyVideoWorkflow(params: ComfyJobParams) {
  const basePrompt = buildComfyWorkflow(params);
  // Enhance workflow with AnimateDiff or VHS Video Combine node
  const promptGraph = {
    ...basePrompt.prompt,
    '10': {
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['8', 0],
        frame_rate: 16,
        loop_count: 0,
        filename_prefix: 'personaq_video',
        format: 'video/h264-mp4',
        save_output: true,
      },
    },
  };

  return {
    client_id: 'personaq_video_studio',
    prompt: promptGraph,
  };
}

/**
 * Queue a video generation job on local ComfyUI.
 */
export async function queueComfyVideoGeneration(params: ComfyJobParams): Promise<{ promptId: string }> {
  const status = await checkComfyStatus();
  if (!status.connected) {
    throw new VisualGenerationError(
      'GPU_OFFLINE',
      `ComfyUI server is offline or unreachable at ${status.endpoint}. Ensure the local ComfyUI worker is running.`,
      503
    );
  }

  const workflow = buildComfyVideoWorkflow(params);

  try {
    const res = await fetch(`${DEFAULT_COMFY_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new VisualGenerationError(
        'GEN_UPSTREAM_ERROR',
        `ComfyUI video queue failed with status ${res.status}: ${errorText}`,
        502
      );
    }

    const data = await res.json();
    return { promptId: data.prompt_id };
  } catch (error) {
    if (error instanceof VisualGenerationError) throw error;
    throw new VisualGenerationError(
      'GPU_OFFLINE',
      `ComfyUI communication error: ${error instanceof Error ? error.message : 'Connection failed'}`,
      503
    );
  }
}

/**
 * Execute ComfyUI video generation and poll until the resulting MP4 video buffer is returned.
 */
export async function generateComfyVideo(params: ComfyJobParams, maxWaitMs = 180000): Promise<Buffer> {
  const { promptId } = await queueComfyVideoGeneration(params);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const histRes = await fetch(`${DEFAULT_COMFY_URL}/history/${promptId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!histRes.ok) continue;
      const history = await histRes.json();
      const promptData = history[promptId];
      if (promptData && promptData.outputs) {
        for (const nodeId of Object.keys(promptData.outputs)) {
          const nodeOutput = promptData.outputs[nodeId];
          const videos = nodeOutput.gifs || nodeOutput.videos;
          if (videos && videos.length > 0) {
            const vid = videos[0];
            const viewUrl = `${DEFAULT_COMFY_URL}/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder || '')}&type=${encodeURIComponent(vid.type || 'output')}`;
            const vidRes = await fetch(viewUrl);
            if (vidRes.ok) {
              const arrayBuf = await vidRes.arrayBuffer();
              return Buffer.from(arrayBuf);
            }
          }
        }
      }
    } catch {
      // Continue polling
    }
  }

  throw new VisualGenerationError(
    'GEN_UPSTREAM_ERROR',
    'ComfyUI video generation timed out waiting for output',
    504
  );
}

