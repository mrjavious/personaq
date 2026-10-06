import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CloudflareImageProvider,
  PollinationsImageProvider,
  HuggingFaceImageProvider,
  OpenSourceImageProvider,
  ImageProviderError,
  formatIdentityFirstPrompt,
} from '@/lib/ai/image-provider';

describe('Phase B: Real Providers Pipeline (Cloudflare, Pollinations, Hugging Face, Dispatcher)', () => {
  const origEnv = { ...process.env };
  const sampleImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.POLLINATIONS_API_KEY;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...origEnv };
  });

  describe('1. CloudflareImageProvider (Workers AI FLUX.1-schnell)', () => {
    beforeEach(() => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_account_123';
      process.env.CLOUDFLARE_API_TOKEN = 'cf_token_abc';
    });

    it('returns generated image on successful 200 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(sampleImageBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      const provider = new CloudflareImageProvider();
      const result = await provider.generateImage({
        prompt: 'Studio portrait of adult character',
      });

      expect(result.provider).toBe('cloudflare');
      expect(result.model).toBe('@cf/black-forest-labs/flux-1-schnell');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.estimatedCost).toBe(0);
    });

    it('throws ImageProviderError("quota") on 429 rate limit or neuron quota exceeded', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Rate limit or neuron quota exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const provider = new CloudflareImageProvider();
      try {
        await provider.generateImage({ prompt: 'Studio portrait' });
        expect.unreachable('Should have thrown quota error');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('quota');
      }
    });

    it('throws ImageProviderError("blocked") on 400 safety violation', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Blocked by content safety filter' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const provider = new CloudflareImageProvider();
      try {
        await provider.generateImage({ prompt: 'Unsafe prompt' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('blocked');
      }
    });

    it('throws ImageProviderError("no_image") on empty payload', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array(0), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      const provider = new CloudflareImageProvider();
      try {
        await provider.generateImage({ prompt: 'Studio portrait' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('no_image');
      }
    });

    it('throws ImageProviderError("failed") on timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new DOMException('The operation timed out', 'TimeoutError')
      );

      const provider = new CloudflareImageProvider();
      try {
        await provider.generateImage({ prompt: 'Studio portrait' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('failed');
      }
    });

    it('throws ImageProviderError("unsupported") when references are passed to text-to-image backend', async () => {
      const provider = new CloudflareImageProvider();
      await expect(
        provider.generateImage({
          prompt: 'Studio portrait',
          referenceImages: [{ buffer: sampleImageBytes }],
        })
      ).rejects.toThrowError(ImageProviderError);

      try {
        await provider.generateImage({
          prompt: 'Studio portrait',
          referenceImages: [{ buffer: sampleImageBytes }],
        });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('unsupported');
      }
    });
  });

  describe('2. PollinationsImageProvider (Text-to-Image & Reference-Image Generation)', () => {
    beforeEach(() => {
      process.env.POLLINATIONS_API_KEY = 'pollinations_secret_key_123';
    });

    it('calls gen.pollinations.ai with Authorization Bearer header for text-to-image', async () => {
      let capturedUrl = '';
      let capturedHeaders: HeadersInit | undefined;

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = init?.headers;
        return new Response(sampleImageBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      });

      const provider = new PollinationsImageProvider();
      const result = await provider.generateImage({
        prompt: 'Studio portrait of adult character',
      });

      expect(capturedUrl).toContain('https://gen.pollinations.ai/image/');
      expect(capturedUrl).toContain('model=flux');
      expect((capturedHeaders as Record<string, string>)?.Authorization).toBe('Bearer pollinations_secret_key_123');
      expect(result.provider).toBe('pollinations');
      expect(result.model).toBe('flux');
    });

    it('uses image-edit model (kontext) and passes reference as data URI in image parameter', async () => {
      let capturedUrl = '';

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        capturedUrl = String(url);
        return new Response(sampleImageBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      });

      const provider = new PollinationsImageProvider();
      const result = await provider.generateImage({
        prompt: 'Side perspective view matching locked face reference',
        referenceImages: [{ buffer: sampleImageBytes, mimeType: 'image/jpeg' }],
      });

      expect(capturedUrl).toContain('model=kontext');
      expect(capturedUrl).toContain('image=data%3Aimage%2Fjpeg%3Bbase64%2C');
      expect(result.model).toBe('kontext');
    });

    it('throws ImageProviderError("quota") on 429 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Pollen quota exceeded', { status: 429 })
      );

      const provider = new PollinationsImageProvider();
      try {
        await provider.generateImage({ prompt: 'Portrait' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('quota');
      }
    });

    it('throws ImageProviderError("blocked") on moderation refusal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Request blocked by NSFW safety filters', { status: 400 })
      );

      const provider = new PollinationsImageProvider();
      try {
        await provider.generateImage({ prompt: 'Portrait' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('blocked');
      }
    });
  });

  describe('3. HuggingFaceImageProvider', () => {
    beforeEach(() => {
      process.env.HF_TOKEN = 'hf_test_token';
    });

    it('sends POST request to router.huggingface.co FLUX.1-schnell endpoint', async () => {
      let capturedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        capturedUrl = String(url);
        return new Response(sampleImageBytes, { status: 200 });
      });

      const provider = new HuggingFaceImageProvider();
      const result = await provider.generateImage({ prompt: 'Studio portrait' });

      expect(capturedUrl).toContain('router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell');
      expect(result.provider).toBe('huggingface');
      expect(result.model).toBe('FLUX.1-schnell');
    });

    it('throws ImageProviderError("quota") on 429 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Rate limit reached' }), { status: 429 })
      );

      const provider = new HuggingFaceImageProvider();
      try {
        await provider.generateImage({ prompt: 'Studio portrait' });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('quota');
      }
    });
  });

  describe('4. Selection Order Dispatcher (OpenSourceImageProvider)', () => {
    it('routes reference generation strictly to reference-capable providers (Pollinations)', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc';
      process.env.CLOUDFLARE_API_TOKEN = 'cf_tok';
      process.env.POLLINATIONS_API_KEY = 'poll_key';
      process.env.IMAGE_PROVIDER_ORDER = 'cloudflare,pollinations';

      let calledUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
        calledUrl = String(url);
        return new Response(sampleImageBytes, { status: 200 });
      });

      const provider = new OpenSourceImageProvider();
      const result = await provider.generateImage({
        prompt: 'Side angle view',
        referenceImages: [{ buffer: sampleImageBytes }],
      });

      // Must have routed to Pollinations, NOT Cloudflare (which lacks reference capability)
      expect(calledUrl).toContain('gen.pollinations.ai');
      expect(result.provider).toBe('pollinations');
    });

    it('throws ImageProviderError("unsupported") if references are passed without any reference-capable provider configured', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc';
      process.env.CLOUDFLARE_API_TOKEN = 'cf_tok';
      // Pollinations not configured
      process.env.IMAGE_PROVIDER_ORDER = 'cloudflare';

      const provider = new OpenSourceImageProvider();
      try {
        await provider.generateImage({
          prompt: 'Side angle view',
          referenceImages: [{ buffer: sampleImageBytes }],
        });
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('unsupported');
      }
    });

    it('falls through to next provider when first provider encounters 429 quota error', async () => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc';
      process.env.CLOUDFLARE_API_TOKEN = 'cf_tok';
      process.env.POLLINATIONS_API_KEY = 'poll_key';
      process.env.IMAGE_PROVIDER_ORDER = 'cloudflare,pollinations';

      // First fetch (Cloudflare) returns 429
      // Second fetch (Pollinations) succeeds with 200
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('Cloudflare quota exceeded', { status: 429 }))
        .mockResolvedValueOnce(new Response(sampleImageBytes, { status: 200 }));

      const provider = new OpenSourceImageProvider();
      const result = await provider.generateImage({ prompt: 'Studio portrait' });

      expect(result.provider).toBe('pollinations');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('5. Identity-First Prompt Budgeting', () => {
    it('preserves identity traits and expression while truncating photography boilerplate', () => {
      const identityTraits = 'Adult 24, South Asian, olive skin with warm undertones, almond dark-brown eyes, prominent cheekbones, wavy black shoulder-length hair';
      const expression = 'warm calm half-smile';
      const boilerplate = 'ultra-detailed 85mm portrait photography, soft neutral studio key lighting, subtle micro-pores and authentic skin texture, seamless grey backdrop, high resolution raw image';

      const budgeted = formatIdentityFirstPrompt({
        identityTraitsPrompt: identityTraits,
        expressionPrompt: expression,
        studioBoilerplate: boilerplate,
        maxBudgetChars: 180,
      });

      // The identity traits must be completely intact
      expect(budgeted).toContain(identityTraits);
      expect(budgeted).toContain(expression);
      // Overall length must not exceed budget
      expect(budgeted.length).toBeLessThanOrEqual(180);
    });
  });
});
