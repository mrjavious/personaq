import { checkComfyStatus, generateComfyVideo } from '@/lib/comfyui/client';
import { VisualGenerationError } from '@/lib/persona/visual-types';

export interface VideoProviderCapabilities {
  referenceImage: boolean;
  maxDurationSeconds: number;
}

export interface VideoGenerationOptions {
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number;
  cameraMovement?: string;
  personaId?: string;
  negativePrompt?: string;
}

export interface VideoGenerationResult {
  buffer?: Buffer;
  url?: string;
  provider: string;
  model: string;
  estimatedCost: number;
}

export interface VideoProvider {
  readonly name: string;
  readonly capabilities: VideoProviderCapabilities;
  isAvailable(): Promise<boolean>;
  generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult>;
}

export class OpenSourceVideoProvider implements VideoProvider {
  readonly name = 'opensource';
  readonly capabilities: VideoProviderCapabilities = {
    referenceImage: true,
    maxDurationSeconds: 15,
  };

  async isAvailable(): Promise<boolean> {
    const status = await checkComfyStatus();
    return status.connected;
  }

  async generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const status = await checkComfyStatus();
    if (!status.connected) {
      throw new VisualGenerationError(
        'PROVIDER_UNAVAILABLE',
        'Video generation provider is not configured. Start local ComfyUI at http://127.0.0.1:8188 with AnimateDiff or Wan 2.1 to generate videos.',
        503
      );
    }

    const videoBuffer = await generateComfyVideo({
      prompt: options.prompt,
      negativePrompt: options.negativePrompt,
      aspectRatio: options.aspectRatio === '16:9' ? '16:9' : '9:16',
    });

    return {
      buffer: videoBuffer,
      provider: 'comfyui',
      model: 'animatediff-motion-lora',
      estimatedCost: 0,
    };
  }
}

let activeVideoProvider: VideoProvider = new OpenSourceVideoProvider();

export function getVideoProvider(): VideoProvider {
  return activeVideoProvider;
}

export function setVideoProvider(provider: VideoProvider): void {
  activeVideoProvider = provider;
}
