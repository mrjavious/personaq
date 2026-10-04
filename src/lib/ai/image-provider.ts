import { GoogleGenAI, PersonGeneration } from '@google/genai';

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
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
          throw new ImageProviderError('quota', `Quota exceeded: ${msg}`, this.name, { cause: err });
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
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
          throw new ImageProviderError('quota', `Quota exceeded: ${msg}`, this.name, { cause: err });
        }
        if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('blocked')) {
          throw new ImageProviderError('blocked', `Blocked by upstream provider: ${msg}`, this.name, { cause: err });
        }
      }
    }

    if (!imageBuffer) {
      if (lastError) {
        const msg = lastError.message || 'Unknown upstream provider error';
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
          throw new ImageProviderError('quota', `Provider quota error: ${msg}`, this.name, { cause: lastError });
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

let activeImageProvider: ImageProvider = new GeminiImageProvider();

export function getImageProvider(): ImageProvider {
  return activeImageProvider;
}

export function setImageProvider(provider: ImageProvider): void {
  activeImageProvider = provider;
}
