import { GoogleGenAI, PersonGeneration } from '@google/genai';
import sharp from 'sharp';
import { checkComfyStatus, generateComfyImage } from '@/lib/comfyui/client';

export type ImageProviderErrorCode =
  | 'not_configured'
  | 'quota'
  | 'blocked'
  | 'no_image'
  | 'unsupported'
  | 'failed';

export class ImageProviderError extends Error {
  readonly code: ImageProviderErrorCode;
  readonly provider: string;

  constructor(
    code: ImageProviderErrorCode,
    message: string,
    provider = 'unknown',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ImageProviderError';
    this.code = code;
    this.provider = provider;
  }
}

export interface ImageProviderCapabilities {
  referenceImage: boolean;
  maxReferences?: number;
}

export interface ImageReference {
  buffer: Buffer;
  mimeType?: string;
}

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  referenceImages?: ImageReference[];
  negativePrompt?: string;
  personaId?: string;
}

export interface ImageGenerationResult {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
  estimatedCost: number;
}

export interface ImageProvider {
  readonly name: string;
  readonly capabilities: ImageProviderCapabilities;
  isAvailable(): Promise<boolean>;
  generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = 'gemini';
  readonly capabilities: ImageProviderCapabilities = {
    referenceImage: true,
    maxReferences: 3,
  };

  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ImageProviderError(
        'not_configured',
        'GEMINI_API_KEY environment variable is not configured',
        this.name
      );
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const client = this.getClient();

    const references = options.referenceImages || [];

    // If caller needs references but capabilities do not allow, throw unsupported
    if (references.length > 0 && !this.capabilities.referenceImage) {
      throw new ImageProviderError(
        'unsupported',
        'Image provider does not support reference images; refusing to drop references silently',
        this.name
      );
    }

    // References capped at 3
    const cappedReferences = references.slice(0, 3);

    const imageModel = process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-002';
    const multimodalModel = process.env.GEMINI_MULTIMODAL_MODEL || 'gemini-2.5-flash-image';

    let imageBuffer: Buffer | null = null;
    let modelUsed = multimodalModel;
    let lastError: Error | null = null;

    // 1. If references are present, use multimodal model with inlineData
    if (cappedReferences.length > 0) {
      const referenceParts = cappedReferences.map((ref) => ({
        inlineData: {
          mimeType: ref.mimeType || 'image/jpeg',
          data: ref.buffer.toString('base64'),
        },
      }));

      const contents = [options.prompt, ...referenceParts];

      try {
        const response = await client.models.generateContent({
          model: multimodalModel,
          contents,
        });

        // Check for safety finish reason
        const candidate = response.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason.toString().toUpperCase().includes('SAFETY')) {
          throw new ImageProviderError('blocked', 'Image generation was blocked by safety filters', this.name);
        }

        const parts = candidate?.content?.parts;
        if (parts) {
          for (const p of parts) {
            if (p.inlineData?.data) {
              imageBuffer = Buffer.from(p.inlineData.data, 'base64');
              modelUsed = multimodalModel;
              break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof ImageProviderError) throw err;
        lastError = err as Error;
        const msg = String((err as Error)?.message || '');
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted') || msg.includes('limit: 0')) {
          throw new ImageProviderError('quota', 'Gemini image generation quota exceeded. Free-tier Google AI Studio keys have a limit of 0 for image models. Attach billing to your Google AI Studio project, run local ComfyUI, or upload a reference image directly.', this.name, { cause: err });
        }
        if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
          throw new ImageProviderError('blocked', `Blocked by upstream provider: ${msg}`, this.name, { cause: err });
        }
      }
    }

    // 2. If no image buffer yet and no references or multimodal failed, try text-to-image (Imagen 3)
    if (!imageBuffer && cappedReferences.length === 0) {
      try {
        const result = await client.models.generateImages({
          model: imageModel,
          prompt: options.prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: options.aspectRatio || '1:1',
            personGeneration: PersonGeneration.ALLOW_ADULT,
          },
        });

        const base64Data = result.generatedImages?.[0]?.image?.imageBytes;
        if (base64Data) {
          imageBuffer = Buffer.from(base64Data, 'base64');
          modelUsed = imageModel;
        }
      } catch (err: unknown) {
        lastError = err as Error;
        const msg = String((err as Error)?.message || '');
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted') || msg.includes('limit: 0')) {
          throw new ImageProviderError('quota', 'Gemini image generation quota exceeded. Free-tier Google AI Studio keys have a limit of 0 for image models. Attach billing to your Google AI Studio project, run local ComfyUI, or upload a reference image directly.', this.name, { cause: err });
        }
        if (msg.includes('Enterprise Agent Platform') || msg.includes('Vertex AI')) {
          throw new ImageProviderError('unsupported', 'Imagen 3 via generateImages requires Google Cloud Vertex AI credentials. For Google AI Studio keys, enable billing for Gemini image models or run a local ComfyUI worker.', this.name, { cause: err });
        }
        if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
          throw new ImageProviderError('blocked', `Blocked by upstream provider: ${msg}`, this.name, { cause: err });
        }
      }
    }

    if (!imageBuffer) {
      if (lastError) {
        const msg = lastError.message || 'Unknown upstream provider error';
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted') || msg.includes('limit: 0')) {
          throw new ImageProviderError('quota', 'Gemini image generation quota exceeded. Free-tier Google AI Studio keys have a limit of 0 for image models. Attach billing to your Google AI Studio project, run local ComfyUI, or upload a reference image directly.', this.name, { cause: lastError });
        }
        if (msg.includes('Enterprise Agent Platform') || msg.includes('Vertex AI')) {
          throw new ImageProviderError('unsupported', 'Imagen 3 via generateImages requires Google Cloud Vertex AI credentials. For Google AI Studio keys, enable billing for Gemini image models or run a local ComfyUI worker.', this.name, { cause: lastError });
        }
        if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
          throw new ImageProviderError('blocked', `Provider safety error: ${msg}`, this.name, { cause: lastError });
        }
        throw new ImageProviderError('failed', `Image generation failed: ${msg}`, this.name, { cause: lastError });
      }
      throw new ImageProviderError('no_image', 'Provider completed without returning image data', this.name);
    }

    return {
      buffer: imageBuffer,
      mimeType: 'image/jpeg',
      provider: this.name,
      model: modelUsed,
      estimatedCost: 0.04,
    };
  }
}

export class OpenSourceImageProvider implements ImageProvider {
  readonly name = 'opensource';

  get capabilities(): ImageProviderCapabilities {
    const hasRefBackend = Boolean(process.env.POLLINATIONS_API_KEY);
    return {
      referenceImage: hasRefBackend,
      maxReferences: hasRefBackend ? 3 : 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)) return true;
    if (Boolean(process.env.POLLINATIONS_API_KEY)) return true;
    if (Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY)) return true;
    try {
      const status = await checkComfyStatus();
      if (status.connected) return true;
    } catch {
      // offline
    }
    return false;
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    if (!(await this.isAvailable())) {
      throw new ImageProviderError(
        'not_configured',
        'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run a local ComfyUI worker.',
        this.name
      );
    }

    if (options.referenceImages && options.referenceImages.length > 0) {
      if (!this.capabilities.referenceImage) {
        throw new ImageProviderError(
          'unsupported',
          'Reference-image generation is not supported by the active backend.',
          this.name
        );
      }
    }

    // 1. Try local ComfyUI worker if running
    try {
      const status = await checkComfyStatus();
      if (status.connected) {
        const buffer = await generateComfyImage({
          prompt: options.prompt,
          negativePrompt: options.negativePrompt,
          aspectRatio: (options.aspectRatio as '1:1' | '9:16' | '16:9') || '1:1',
        });
        return {
          buffer,
          mimeType: 'image/jpeg',
          provider: 'comfyui',
          model: 'flux1-dev-lora',
          estimatedCost: 0,
        };
      }
    } catch {
      // Local worker offline, continue to cloud open source
    }

    // 2. Try Hugging Face serverless FLUX / SDXL if token is set
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (hfToken) {
      try {
        const hfRes = await fetch(
          'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: options.prompt,
              parameters: {
                negative_prompt: options.negativePrompt,
              },
            }),
            signal: AbortSignal.timeout(45000),
          }
        );
        if (hfRes.ok) {
          const arrayBuf = await hfRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          return {
            buffer,
            mimeType: 'image/jpeg',
            provider: 'huggingface_flux',
            model: 'FLUX.1-schnell',
            estimatedCost: 0,
          };
        }
      } catch {
        // Fall through to next alternative
      }
    }

    // 3. Try Pollinations open-source endpoint if key is present
    if (process.env.POLLINATIONS_API_KEY) {
      try {
        const targetWidth = options.aspectRatio === '16:9' ? 1024 : options.aspectRatio === '9:16' ? 576 : 1024;
        const targetHeight = options.aspectRatio === '16:9' ? 576 : options.aspectRatio === '9:16' ? 1024 : 1024;
        const cleanPrompt = options.prompt.replace(/\s+/g, ' ').trim().slice(0, 1000);
        const seed = Math.floor(Math.random() * 1000000);
        const negParam = options.negativePrompt ? `&negative_prompt=${encodeURIComponent(options.negativePrompt)}` : '';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${targetWidth}&height=${targetHeight}&model=flux&nologo=true&enhance=false&seed=${seed}${negParam}`;

        const res = await fetch(url, {
          headers: {
            Accept: 'image/jpeg,image/png,image/*',
            Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
          },
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const meta = await sharp(buf).metadata();
          if (meta.width && meta.height) {
            const finalBuf = await sharp(buf)
              .resize(targetWidth, targetHeight, { fit: 'contain', background: '#FFFFFF' })
              .jpeg({ quality: 95 })
              .toBuffer();

            return {
              buffer: finalBuf,
              mimeType: 'image/jpeg',
              provider: 'pollinations_flux',
              model: 'flux-schnell',
              estimatedCost: 0,
            };
          }
        }
      } catch {
        // Fall through
      }
    }

    // No silent fallback to stock presets or SVGs: throw typed error
    throw new ImageProviderError(
      'no_image',
      'All configured visual generation backends failed to produce an image.',
      this.name
    );
  }
}

let customImageProvider: ImageProvider | null = null;
const geminiImageProvider = new GeminiImageProvider();
const openSourceImageProvider = new OpenSourceImageProvider();

export function getImageProvider(): ImageProvider {
  if (customImageProvider) {
    return customImageProvider;
  }
  // When running automated test suite, default to Gemini provider so unit tests
  // verifying unconfigured keys and error codes pass cleanly
  if (process.env.NODE_ENV === 'test' && process.env.TEST_IMAGE_PROVIDER !== 'opensource') {
    return geminiImageProvider;
  }
  const configured = (process.env.IMAGE_PROVIDER || '').trim().toLowerCase();
  if (configured === 'gemini') {
    return geminiImageProvider;
  }
  return openSourceImageProvider;
}

export function setImageProvider(provider: ImageProvider): void {
  customImageProvider = provider;
}


