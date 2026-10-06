import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  OpenSourceImageProvider,
  ImageProviderError,
  setImageProvider,
  ImageProvider,
} from '@/lib/ai/image-provider';
import { generateFaceCardCandidate } from '@/lib/persona/face-card';
import { VisualGenerationError } from '@/lib/persona/visual-types';
import prisma from '@/lib/db/prisma';
import * as comfyClient from '@/lib/comfyui/client';

describe('Phase A: Honest Generation & Zero Stock Fakes', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.POLLINATIONS_API_KEY;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('1. Static Code Audit: No code path under src/ imports or reads public/presets/personas for generation', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const allFiles: string[] = [];

    function collectFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(fullPath);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          allFiles.push(fullPath);
        }
      }
    }

    collectFiles(srcDir);

    const violatingFiles: string[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('presets/personas') || content.includes('public/presets')) {
        violatingFiles.push(file);
      }
    }

    expect(violatingFiles).toEqual([]);
  });

  it('2. OpenSourceImageProvider.isAvailable() returns false when no backends are configured', async () => {
    vi.spyOn(comfyClient, 'checkComfyStatus').mockResolvedValue({
      connected: false,
      endpoint: 'http://127.0.0.1:8188',
      queueRemaining: 0,
      message: 'offline',
    });
    const provider = new OpenSourceImageProvider();
    const available = await provider.isAvailable();
    expect(available).toBe(false);
  });

  it('3. OpenSourceImageProvider.isAvailable() returns true when at least one backend is configured', async () => {
    vi.spyOn(comfyClient, 'checkComfyStatus').mockResolvedValue({
      connected: false,
      endpoint: 'http://127.0.0.1:8188',
      queueRemaining: 0,
      message: 'offline',
    });
    const provider = new OpenSourceImageProvider();

    // With HF token
    process.env.HF_TOKEN = 'test_hf_token';
    expect(await provider.isAvailable()).toBe(true);
    delete process.env.HF_TOKEN;

    // With Pollinations key
    process.env.POLLINATIONS_API_KEY = 'test_pollinations_key';
    expect(await provider.isAvailable()).toBe(true);
    delete process.env.POLLINATIONS_API_KEY;

    // With Cloudflare credentials
    process.env.CLOUDFLARE_ACCOUNT_ID = 'cf_acc';
    process.env.CLOUDFLARE_API_TOKEN = 'cf_tok';
    expect(await provider.isAvailable()).toBe(true);
  });

  it('4. Face card generation with unconfigured provider returns 503 PROVIDER_UNAVAILABLE', async () => {
    vi.spyOn(comfyClient, 'checkComfyStatus').mockResolvedValue({
      connected: false,
      endpoint: 'http://127.0.0.1:8188',
      queueRemaining: 0,
      message: 'offline',
    });
    const provider = new OpenSourceImageProvider();
    setImageProvider(provider);

    // Create a temporary persona for test
    const persona = await prisma.persona.create({
      data: {
        name: 'Honest Test Persona',
        adultAge: 25,
        backstory: 'Testing honest pipeline with zero stock fallback',
        appearanceNotes: 'Natural authentic styling',
        voiceTone: 'Clear',
        aiDisclosureText: 'AI Persona',
      },
    });

    try {
      await expect(
        generateFaceCardCandidate({ personaId: persona.id })
      ).rejects.toThrowError(VisualGenerationError);

      try {
        await generateFaceCardCandidate({ personaId: persona.id });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(VisualGenerationError);
        const visualErr = err as VisualGenerationError;
        expect(visualErr.statusCode).toBe(503);
        expect(visualErr.code).toBe('PROVIDER_UNAVAILABLE');
      }
    } finally {
      await prisma.persona.delete({ where: { id: persona.id } });
      setImageProvider(null as unknown as ImageProvider);
    }
  });

  it('5. References passed to a non-reference backend throw ImageProviderError("unsupported")', async () => {
    process.env.HF_TOKEN = 'test_hf_token'; // HF schnell is text-to-image only
    delete process.env.POLLINATIONS_API_KEY;
    vi.spyOn(comfyClient, 'checkComfyStatus').mockResolvedValue({
      connected: false,
      endpoint: 'http://127.0.0.1:8188',
      queueRemaining: 0,
      message: 'offline',
    });

    const provider = new OpenSourceImageProvider();
    expect(provider.capabilities.referenceImage).toBe(false);

    await expect(
      provider.generateImage({
        prompt: 'Generate side angle view of character',
        referenceImages: [{ buffer: Buffer.from('fake_face_image_bytes') }],
      })
    ).rejects.toThrowError(ImageProviderError);

    try {
      await provider.generateImage({
        prompt: 'Generate side angle view of character',
        referenceImages: [{ buffer: Buffer.from('fake_face_image_bytes') }],
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ImageProviderError);
      const imgErr = err as ImageProviderError;
      expect(imgErr.code).toBe('unsupported');
      expect(imgErr.message).toContain('Reference-image generation is not supported');
    }
  });
});
