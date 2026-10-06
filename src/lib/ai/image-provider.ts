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
  seed?: number;
  prompt?: string;
  estimatedCost: number;
}

export interface ImageProvider {
  readonly name: string;
  readonly capabilities: ImageProviderCapabilities;
  isAvailable(): Promise<boolean>;
  generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

/**
 * Builds an identity-first prompt within a budget (default 700 chars).
 * Preserves identity-defining traits and expression cues with highest priority,
 * truncating studio/photography boilerplate only if required.
 */
export function formatIdentityFirstPrompt(options: {
  identityTraitsPrompt: string;
  expressionPrompt?: string;
  studioBoilerplate?: string;
  maxBudgetChars?: number;
}): string {
  const maxChars = options.maxBudgetChars || 700;
  const identity = options.identityTraitsPrompt.trim();
  const expression = options.expressionPrompt ? options.expressionPrompt.trim() : '';
  const boilerplate = options.studioBoilerplate
    ? options.studioBoilerplate.trim()
    : 'studio portrait, 85mm lens, soft key lighting, natural skin texture with micro-pores, neutral backdrop, no text, no logos';

  const prefix = [identity, expression].filter(Boolean).join(', ');
  if (!boilerplate) {
    return prefix.slice(0, maxChars);
  }

  if (prefix.length >= maxChars) {
    // Identity traits consume the entire budget; preserve identity first!
    return prefix.slice(0, maxChars);
  }

  const remaining = maxChars - prefix.length - 2; // account for separator
  const truncatedBoilerplate = boilerplate.slice(0, Math.max(0, remaining)).trim();
  return truncatedBoilerplate ? `${prefix}, ${truncatedBoilerplate}` : prefix;
}

export class CloudflareImageProvider implements ImageProvider {
  readonly name = 'cloudflare';
  readonly capabilities: ImageProviderCapabilities = {
    referenceImage: false,
    maxReferences: 0,
  };

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      throw new ImageProviderError(
        'not_configured',
        'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be configured',
        this.name
      );
    }

    if (options.referenceImages && options.referenceImages.length > 0) {
      throw new ImageProviderError(
        'unsupported',
        'Cloudflare Workers AI FLUX.1-schnell does not support reference images; refusing to drop references silently',
        this.name
      );
    }

    const model = '@cf/black-forest-labs/flux-1-schnell';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const seed = Math.floor(Math.random() * 1000000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: options.prompt,
          num_steps: 4,
          seed,
        }),
        signal: AbortSignal.timeout(35000),
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Request failed';
      if ((err as Error)?.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('aborted')) {
        throw new ImageProviderError('failed', `Cloudflare Workers AI request timed out: ${msg}`, this.name, { cause: err });
      }
      throw new ImageProviderError('failed', `Cloudflare Workers AI connection failed: ${msg}`, this.name, { cause: err });
    }

    if (res.status === 429) {
      throw new ImageProviderError(
        'quota',
        'Cloudflare Workers AI rate limit or neuron quota exceeded (429)',
        this.name
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (
        res.status === 400 &&
        (errText.toLowerCase().includes('safety') ||
          errText.toLowerCase().includes('nsfw') ||
          errText.toLowerCase().includes('moderation') ||
          errText.toLowerCase().includes('blocked'))
      ) {
        throw new ImageProviderError(
          'blocked',
          `Blocked by Cloudflare Workers AI safety policy: ${errText}`,
          this.name
        );
      }
      throw new ImageProviderError(
        'failed',
        `Cloudflare Workers AI returned status ${res.status}: ${errText}`,
        this.name
      );
    }

    const contentType = res.headers.get('content-type') || '';
    let buffer: Buffer;

    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null);
      if (json?.result?.image) {
        buffer = Buffer.from(json.result.image, 'base64');
      } else if (json?.image) {
        buffer = Buffer.from(json.image, 'base64');
      } else {
        throw new ImageProviderError(
          'no_image',
          'Cloudflare Workers AI returned JSON without valid image payload',
          this.name
        );
      }
    } else {
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    }

    if (!buffer || buffer.length === 0) {
      throw new ImageProviderError('no_image', 'Cloudflare Workers AI returned an empty image', this.name);
    }

    return {
      buffer,
      mimeType: 'image/jpeg',
      provider: this.name,
      model,
      seed,
      prompt: options.prompt,
      estimatedCost: 0,
    };
  }
}

export class PollinationsImageProvider implements ImageProvider {
  readonly name = 'pollinations';
  readonly capabilities: ImageProviderCapabilities = {
    referenceImage: true,
    maxReferences: 1,
  };

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.POLLINATIONS_API_KEY);
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    if (!apiKey) {
      throw new ImageProviderError(
        'not_configured',
        'POLLINATIONS_API_KEY must be configured',
        this.name
      );
    }

    const hasRef = Boolean(options.referenceImages && options.referenceImages.length > 0);
    // When references are provided, use image-edit model kontext or flux.2-klein-4b
    const model = hasRef ? (process.env.POLLINATIONS_EDIT_MODEL || 'kontext') : (process.env.POLLINATIONS_IMAGE_MODEL || 'flux');
    const seed = Math.floor(Math.random() * 1000000);
    const targetWidth = options.aspectRatio === '16:9' ? 1024 : options.aspectRatio === '9:16' ? 576 : 1024;
    const targetHeight = options.aspectRatio === '16:9' ? 576 : options.aspectRatio === '9:16' ? 1024 : 1024;

    const cleanPrompt = options.prompt.replace(/\s+/g, ' ').trim();
    let url = `https://gen.pollinations.ai/image/${encodeURIComponent(cleanPrompt)}?model=${encodeURIComponent(model)}&seed=${seed}&width=${targetWidth}&height=${targetHeight}&nologo=true`;

    if (hasRef && options.referenceImages && options.referenceImages[0]) {
      const ref = options.referenceImages[0];
      const mime = ref.mimeType || 'image/jpeg';
      const dataUri = `data:${mime};base64,${ref.buffer.toString('base64')}`;
      url += `&image=${encodeURIComponent(dataUri)}`;
    }

    if (options.negativePrompt) {
      url += `&negative_prompt=${encodeURIComponent(options.negativePrompt)}`;
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/jpeg,image/png,image/*',
        },
        signal: AbortSignal.timeout(45000),
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Request failed';
      if ((err as Error)?.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('aborted')) {
        throw new ImageProviderError('failed', `Pollinations request timed out: ${msg}`, this.name, { cause: err });
      }
      throw new ImageProviderError('failed', `Pollinations connection failed: ${msg}`, this.name, { cause: err });
    }

    if (res.status === 429) {
      throw new ImageProviderError(
        'quota',
        'Pollinations pollen quota exceeded or rate limited (429)',
        this.name
      );
    }

    if (res.status === 400 || res.status === 403) {
      const errText = await res.text().catch(() => '');
      if (
        errText.toLowerCase().includes('safety') ||
        errText.toLowerCase().includes('nsfw') ||
        errText.toLowerCase().includes('moderation') ||
        errText.toLowerCase().includes('blocked')
      ) {
        throw new ImageProviderError('blocked', `Blocked by Pollinations safety filters: ${errText}`, this.name);
      }
      throw new ImageProviderError('failed', `Pollinations returned error ${res.status}: ${errText}`, this.name);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ImageProviderError('failed', `Pollinations returned error ${res.status}: ${errText}`, this.name);
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (!buf || buf.length === 0) {
      throw new ImageProviderError('no_image', 'Pollinations returned an empty response', this.name);
    }

    return {
      buffer: buf,
      mimeType: 'image/jpeg',
      provider: this.name,
      model,
      seed,
      prompt: options.prompt,
      estimatedCost: 0,
    };
  }
}

export class HuggingFaceImageProvider implements ImageProvider {
  readonly name = 'huggingface';
  readonly capabilities: ImageProviderCapabilities = {
    referenceImage: false,
    maxReferences: 0,
  };

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY);
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (!token) {
      throw new ImageProviderError(
        'not_configured',
        'HF_TOKEN or HUGGINGFACE_API_KEY must be configured',
        this.name
      );
    }

    if (options.referenceImages && options.referenceImages.length > 0) {
      throw new ImageProviderError(
        'unsupported',
        'Hugging Face FLUX.1-schnell does not support reference images; refusing to drop references silently',
        this.name
      );
    }

    const model = 'FLUX.1-schnell';
    const seed = Math.floor(Math.random() * 1000000);
    const url = 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell';

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: options.prompt,
          parameters: {
            negative_prompt: options.negativePrompt,
            seed,
          },
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Request failed';
      if ((err as Error)?.name === 'TimeoutError' || msg.includes('timeout') || msg.includes('aborted')) {
        throw new ImageProviderError('failed', `Hugging Face request timed out: ${msg}`, this.name, { cause: err });
      }
      throw new ImageProviderError('failed', `Hugging Face connection failed: ${msg}`, this.name, { cause: err });
    }

    if (res.status === 429) {
      throw new ImageProviderError(
        'quota',
        'Hugging Face inference rate limit or quota exceeded (429)',
        this.name
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (errText.toLowerCase().includes('safety') || errText.toLowerCase().includes('blocked')) {
        throw new ImageProviderError('blocked', `Blocked by Hugging Face safety filters: ${errText}`, this.name);
      }
      throw new ImageProviderError('failed', `Hugging Face error ${res.status}: ${errText}`, this.name);
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (!buffer || buffer.length === 0) {
      throw new ImageProviderError('no_image', 'Hugging Face returned empty image buffer', this.name);
    }

    return {
      buffer,
      mimeType: 'image/jpeg',
      provider: this.name,
      model,
      seed,
      prompt: options.prompt,
      estimatedCost: 0,
    };
  }
}

export class ComfyUIImageProvider implements ImageProvider {
  readonly name = 'comfyui';
  readonly capabilities: ImageProviderCapabilities = {
    referenceImage: false,
    maxReferences: 0,
  };

  async isAvailable(): Promise<boolean> {
    try {
      const status = await checkComfyStatus();
      return Boolean(status.connected);
    } catch {
      return false;
    }
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new ImageProviderError(
        'not_configured',
        'Local ComfyUI worker is offline or not reachable',
        this.name
      );
    }

    if (options.referenceImages && options.referenceImages.length > 0) {
      throw new ImageProviderError(
        'unsupported',
        'Local ComfyUI worker does not support reference images without workflow setup; refusing to drop references silently',
        this.name
      );
    }

    const buffer = await generateComfyImage({
      prompt: options.prompt,
      negativePrompt: options.negativePrompt,
      aspectRatio: (options.aspectRatio as '1:1' | '9:16' | '16:9') || '1:1',
    });

    return {
      buffer,
      mimeType: 'image/jpeg',
      provider: this.name,
      model: 'flux1-dev-lora',
      prompt: options.prompt,
      estimatedCost: 0,
    };
  }
}

export class OpenSourceImageProvider implements ImageProvider {
  readonly name = 'opensource';

  private cloudflare = new CloudflareImageProvider();
  private pollinations = new PollinationsImageProvider();
  private huggingface = new HuggingFaceImageProvider();
  private comfyui = new ComfyUIImageProvider();

  getProviderMap(): Record<string, ImageProvider> {
    return {
      cloudflare: this.cloudflare,
      pollinations: this.pollinations,
      huggingface: this.huggingface,
      comfyui: this.comfyui,
    };
  }

  getOrder(): string[] {
    const envOrder = (process.env.IMAGE_PROVIDER_ORDER || 'cloudflare,pollinations,huggingface,comfyui')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return envOrder;
  }

  get capabilities(): ImageProviderCapabilities {
    const map = this.getProviderMap();
    const order = this.getOrder();
    // If any provider in order supports references and is configured, capabilities.referenceImage is true
    for (const name of order) {
      const p = map[name];
      if (p && p.capabilities.referenceImage) {
        if (name === 'pollinations' && Boolean(process.env.POLLINATIONS_API_KEY)) {
          return { referenceImage: true, maxReferences: 3 };
        }
      }
    }
    return { referenceImage: false, maxReferences: 0 };
  }

  async isAvailable(): Promise<boolean> {
    const map = this.getProviderMap();
    const order = this.getOrder();
    for (const name of order) {
      const p = map[name];
      if (p && (await p.isAvailable())) {
        return true;
      }
    }
    return false;
  }

  async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const hasRefs = Boolean(options.referenceImages && options.referenceImages.length > 0);
    const map = this.getProviderMap();
    const order = this.getOrder();

    let candidateNames = order;
    if (hasRefs) {
      const refProviders = order.filter((name) => map[name]?.capabilities.referenceImage);
      const availableRefProviders: string[] = [];
      for (const name of refProviders) {
        if (await map[name]?.isAvailable()) {
          availableRefProviders.push(name);
        }
      }
      if (availableRefProviders.length === 0) {
        throw new ImageProviderError(
          'unsupported',
          'Reference-image generation is not supported: no reference-capable provider is configured. Configure POLLINATIONS_API_KEY.',
          this.name
        );
      }
      candidateNames = availableRefProviders;
    }

    let lastError: Error | null = null;
    let anyAttempted = false;

    for (const name of candidateNames) {
      const provider = map[name];
      if (!provider) continue;

      const isAvail = await provider.isAvailable();
      if (!isAvail) continue;

      anyAttempted = true;
      try {
        const result = await provider.generateImage(options);
        return result;
      } catch (err: unknown) {
        lastError = err as Error;
        if (err instanceof ImageProviderError) {
          // If content was explicitly blocked by safety filter, do not try another provider to bypass moderation
          if (err.code === 'blocked') {
            throw err;
          }
          // If unsupported, rethrow
          if (err.code === 'unsupported') {
            throw err;
          }
        }
        // Transient/quota failure: fall through to next provider in order
        continue;
      }
    }

    if (!anyAttempted) {
      throw new ImageProviderError(
        'not_configured',
        'No visual generation provider configured. Set CLOUDFLARE_*, POLLINATIONS_API_KEY, HF_TOKEN, or run a local ComfyUI worker.',
        this.name
      );
    }

    if (lastError instanceof ImageProviderError) {
      throw lastError;
    }

    throw new ImageProviderError(
      'no_image',
      `All configured visual generation backends failed to produce an image${lastError ? `: ${(lastError as Error).message}` : ''}`,
      this.name
    );
  }
}

let customImageProvider: ImageProvider | null = null;
const openSourceImageProvider = new OpenSourceImageProvider();

export function getImageProvider(): ImageProvider {
  if (customImageProvider) {
    return customImageProvider;
  }
  return openSourceImageProvider;
}

export function setImageProvider(provider: ImageProvider): void {
  customImageProvider = provider;
}


