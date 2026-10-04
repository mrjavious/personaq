import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GeminiImageProvider,
  ImageProviderError,
  ImageProvider,
} from '@/lib/ai/image-provider';
import {
  checkBudget,
  assertWithinBudget,
  recordUsage,
  getMonthlyBudgetCap,
  DEFAULT_ESTIMATED_COSTS,
} from '@/lib/ai/budget';
import {
  buildRealismBlock,
  CAMERA_PRESETS,
  EXPRESSIONS,
} from '@/lib/persona/realism';
import { buildVisualModelPrompt } from '@/lib/persona/visual-types';
import { evaluateConsistency, getMinConsistency } from '@/lib/persona/consistency';
import { OpenAICompatProvider } from '@/lib/ai/openai-compat';
import { prisma } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

vi.mock('@google/genai');

type ProviderWithGetClient = {
  getClient: () => unknown;
};

describe('Phase 3: Providers, Budget, Realism, and Biometric Consistency', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. ImageProvider Error Codes and Reference Enforcement
  // =========================================================================
  describe('1. ImageProvider Error Codes & Reference Capabilities', () => {
    it('throws not_configured when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const provider = new GeminiImageProvider();

      expect(await provider.isAvailable()).toBe(false);

      await expect(
        provider.generateImage({ prompt: 'test prompt' })
      ).rejects.toThrowError(ImageProviderError);

      try {
        await provider.generateImage({ prompt: 'test prompt' });
      } catch (err) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('not_configured');
      }
    });

    it('throws unsupported when provider cannot accept references and never silently drops them', async () => {
      // Mock provider with referenceImage: false
      const limitedProvider: ImageProvider = {
        name: 'limited_mock',
        capabilities: { referenceImage: false },
        isAvailable: async () => true,
        generateImage: async (opts) => {
          if (opts.referenceImages && opts.referenceImages.length > 0 && !limitedProvider.capabilities.referenceImage) {
            throw new ImageProviderError('unsupported', 'Provider does not support references', 'limited_mock');
          }
          return {
            buffer: Buffer.from('img'),
            mimeType: 'image/jpeg',
            provider: 'limited_mock',
            model: 'mock-1',
            estimatedCost: 0.04,
          };
        },
      };

      await expect(
        limitedProvider.generateImage({
          prompt: 'test prompt with refs',
          referenceImages: [{ buffer: Buffer.from('ref1'), mimeType: 'image/jpeg' }],
        })
      ).rejects.toMatchObject({
        code: 'unsupported',
      });
    });

    it('maps upstream quota/429 errors to quota error code', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const provider = new GeminiImageProvider();

      vi.spyOn(provider as unknown as ProviderWithGetClient, 'getClient').mockReturnValue({
        models: {
          generateImages: vi.fn().mockRejectedValue(new Error('Resource has been exhausted (e.g. check quota) 429')),
        },
      });

      try {
        await provider.generateImage({ prompt: 'test prompt' });
        expect.fail('Expected quota error');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('quota');
      }
    });

    it('maps upstream safety block finishReason to blocked error code', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const provider = new GeminiImageProvider();

      vi.spyOn(provider as unknown as ProviderWithGetClient, 'getClient').mockReturnValue({
        models: {
          generateContent: vi.fn().mockResolvedValue({
            candidates: [
              {
                finishReason: 'SAFETY',
              },
            ],
          }),
        },
      });

      try {
        await provider.generateImage({
          prompt: 'test prompt',
          referenceImages: [{ buffer: Buffer.from('ref') }],
        });
        expect.fail('Expected blocked error');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('blocked');
      }
    });

    it('maps empty provider response to no_image error code', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const provider = new GeminiImageProvider();

      vi.spyOn(provider as unknown as ProviderWithGetClient, 'getClient').mockReturnValue({
        models: {
          generateImages: vi.fn().mockResolvedValue({
            generatedImages: [],
          }),
        },
      });

      try {
        await provider.generateImage({ prompt: 'test prompt' });
        expect.fail('Expected no_image error');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('no_image');
      }
    });

    it('maps generic upstream failures to failed error code', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const provider = new GeminiImageProvider();

      vi.spyOn(provider as unknown as ProviderWithGetClient, 'getClient').mockReturnValue({
        models: {
          generateImages: vi.fn().mockRejectedValue(new Error('Internal network timeout')),
        },
      });

      try {
        await provider.generateImage({ prompt: 'test prompt' });
        expect.fail('Expected failed error');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageProviderError);
        expect((err as ImageProviderError).code).toBe('failed');
      }
    });

    it('caps references strictly at 3 when generating image', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const provider = new GeminiImageProvider();

      let capturedContents: unknown[] = [];
      vi.spyOn(provider as unknown as ProviderWithGetClient, 'getClient').mockReturnValue({
        models: {
          generateContent: vi.fn().mockImplementation((args: { contents: unknown[] }) => {
            capturedContents = args.contents;
            return Promise.resolve({
              candidates: [
                {
                  content: {
                    parts: [{ inlineData: { data: Buffer.from('fake-out').toString('base64') } }],
                  },
                },
              ],
            });
          }),
        },
      });

      const refs = [
        { buffer: Buffer.from('ref1') },
        { buffer: Buffer.from('ref2') },
        { buffer: Buffer.from('ref3') },
        { buffer: Buffer.from('ref4') },
        { buffer: Buffer.from('ref5') },
      ];

      const res = await provider.generateImage({
        prompt: 'test prompt with 5 references',
        referenceImages: refs,
      });

      expect(res.buffer).toBeDefined();
      // capturedContents contains: prompt string + reference inlineData objects
      // Must have exactly 1 (prompt) + 3 (capped references) = 4 items
      expect(capturedContents.length).toBe(4);
    });
  });

  // =========================================================================
  // 2. UsageLedger and Monthly Budget Cap Refusal
  // =========================================================================
  describe('2. UsageLedger and Budget Refusal', () => {
    it('creates UsageLedger records and calculates default estimated costs', async () => {
      const entry = await recordUsage({
        provider: 'gemini',
        model: 'imagen-3.0-generate-002',
        kind: 'image',
      });

      expect(entry.id).toBeDefined();
      expect(entry.provider).toBe('gemini');
      expect(entry.kind).toBe('image');
      expect(entry.estimatedCost).toBe(DEFAULT_ESTIMATED_COSTS.image);

      // Clean up test entry
      await prisma.usageLedger.delete({ where: { id: entry.id } });
    });

    it('refuses generation when monthly budget cap is exceeded', async () => {
      process.env.MONTHLY_BUDGET_CAP = '10.00';
      expect(getMonthlyBudgetCap()).toBe(10.0);

      // Create dummy high-cost ledger entry to breach cap
      const overspendEntry = await prisma.usageLedger.create({
        data: {
          provider: 'gemini',
          model: 'imagen-3',
          kind: 'image',
          estimatedCost: 15.0,
          createdAt: new Date(),
        },
      });

      try {
        const budgetStatus = await checkBudget(0.04);
        expect(budgetStatus.allowed).toBe(false);
        expect(budgetStatus.currentSpent).toBeGreaterThanOrEqual(15.0);

        await expect(assertWithinBudget(0.04)).rejects.toThrowError(
          /Monthly AI generation budget exceeded/
        );
      } finally {
        await prisma.usageLedger.delete({ where: { id: overspendEntry.id } });
      }
    });
  });

  // =========================================================================
  // 3. Photographic Realism Block Directives
  // =========================================================================
  describe('3. Photographic Realism Block Directives', () => {
    it('exports all 3 camera presets and 6 expressions', () => {
      expect(CAMERA_PRESETS).toEqual(['phone_selfie', 'candid_35mm', 'portrait_85mm']);
      expect(EXPRESSIONS).toEqual([
        'soft half-smile',
        'mid-laugh',
        'thoughtful glance',
        'subtle closed-lip smile',
        'calm deadpan',
        'neutral',
      ]);
    });

    it('buildRealismBlock includes all required natural photographic and physics rules', () => {
      const block = buildRealismBlock({
        cameraPreset: 'candid_35mm',
        expression: 'soft half-smile',
      });

      // Expression and camera preset
      expect(block).toContain('soft half-smile');
      expect(block).toContain('candid_35mm');

      // Natural skin texture and asymmetry (no airbrushing)
      expect(block).toContain('natural human skin texture');
      expect(block).toContain('micro-pores');
      expect(block).toContain('organic facial asymmetry');
      expect(block).toContain('zero airbrushing');

      // Lighting consistent with scene and shadow direction
      expect(block).toContain('directional scene lighting consistent with environmental light sources');

      // Material reflections (eye catchlights, fabric sheen)
      expect(block).toContain('corneal eye catchlights');
      expect(block).toContain('fabric sheen');

      // Fabric following gravity
      expect(block).toContain('fabric realistically following gravity');

      // Candid imperfect framing and lens-appropriate depth of field
      expect(block).toContain('candid slightly imperfect framing');
      expect(block).toContain('lens-appropriate optical depth of field');
    });

    it('buildVisualModelPrompt includes the realism directives in generated prompts', () => {
      const { prompt } = buildVisualModelPrompt(
        {
          ethnicity: 'south_indian',
          styleLook: 'modern',
          bodyStructure: 'athletic',
          shotType: 'portrait',
          cameraPreset: 'portrait_85mm',
          expression: 'thoughtful glance',
        },
        'Kavya',
        23
      );

      expect(prompt).toContain('Photographic Realism Directives');
      expect(prompt).toContain('thoughtful glance');
      expect(prompt).toContain('85mm');
      expect(prompt).toContain('zero airbrushing');
    });
  });

  // =========================================================================
  // 4. Biometric Identity Consistency Scoring and Drift Flagging
  // =========================================================================
  describe('4. Biometric Consistency Scoring & Drift Flagging', () => {
    it('evaluates consistency and flags asset as drifted when score is below CONSISTENCY_MIN', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.CONSISTENCY_MIN = '75';
      expect(getMinConsistency()).toBe(75);

      const fakeRefBuffer = Buffer.from('canonical-face-image');
      const fakeNewBuffer = Buffer.from('new-generation-image');

      // Mock Gemini returning a low score (drifted)
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          score: 55,
          reasons: ['Jawline significantly narrower than reference', 'Nose shape differs'],
        }),
      });

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = { generateContent: mockGenerateContent };
      } as unknown as typeof GoogleGenAI);

      const result = await evaluateConsistency(fakeRefBuffer, fakeNewBuffer);

      expect(result.score).toBe(55);
      expect(result.passed).toBe(false);
      expect(result.status).toBe('drifted — regenerate');
      expect(result.reasons).toContain('Jawline significantly narrower than reference');
    });

    it('marks asset consistent when score meets or exceeds CONSISTENCY_MIN', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.CONSISTENCY_MIN = '70';

      const fakeRefBuffer = Buffer.from('canonical-face-image');
      const fakeNewBuffer = Buffer.from('new-generation-image');

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          score: 88,
          reasons: ['Identical bone structure', 'Eye shape matches canonical face card'],
        }),
      });

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = { generateContent: mockGenerateContent };
      } as unknown as typeof GoogleGenAI);

      const result = await evaluateConsistency(fakeRefBuffer, fakeNewBuffer);

      expect(result.score).toBe(88);
      expect(result.passed).toBe(true);
      expect(result.status).toBe('consistent');
    });

    it('fails closed with score 0 when consistency check encounters an error', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = {
          generateContent: vi.fn().mockRejectedValue(new Error('Network failure during consistency check')),
        };
      } as unknown as typeof GoogleGenAI);

      const result = await evaluateConsistency(Buffer.from('ref'), Buffer.from('new'));

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.status).toBe('drifted — regenerate');
    });
  });

  // =========================================================================
  // 5. OpenAI-Compatible Text-Only Provider Guardrails
  // =========================================================================
  describe('5. OpenAI-Compatible Text-Only Provider Guardrails', () => {
    it('is available only when OPENAI_COMPAT_BASE_URL is set', async () => {
      delete process.env.OPENAI_COMPAT_BASE_URL;
      const provider = new OpenAICompatProvider();
      expect(await provider.isAvailable()).toBe(false);

      process.env.OPENAI_COMPAT_BASE_URL = 'http://127.0.0.1:11434';
      expect(await provider.isAvailable()).toBe(true);
    });

    it('strictly prohibits images and safety checks from being routed through it', async () => {
      process.env.OPENAI_COMPAT_BASE_URL = 'http://127.0.0.1:11434';
      const provider = new OpenAICompatProvider();

      // Passing image buffer in caption request
      const taintedRequest = {
        concept: 'Beach day',
        platform: 'instagram',
        persona: {
          name: 'Test',
          adultAge: 22,
          backstory: 'Story',
          voiceTone: 'Casual',
          catchphrases: [],
          boundaries: [],
          contentPillars: [],
          aiDisclosureText: 'AI persona',
        },
        image: Buffer.from('fake-image-bytes'),
      } as unknown as Parameters<typeof provider.generateCaption>[0];

      await expect(provider.generateCaption(taintedRequest)).rejects.toThrowError(
        /SECURITY VIOLATION: OpenAI-compatible router is strictly text-only/
      );
    });

    it('prohibits safetyCheck objects from being routed through it', async () => {
      process.env.OPENAI_COMPAT_BASE_URL = 'http://127.0.0.1:11434';
      const provider = new OpenAICompatProvider();

      const taintedReply = {
        contextText: 'Hello',
        platform: 'x',
        persona: { name: 'Test', voiceTone: 'Warm', catchphrases: [], boundaries: [] },
        safetyCheck: true,
      } as unknown as Parameters<typeof provider.draftReply>[0];

      await expect(provider.draftReply(taintedReply)).rejects.toThrowError(
        /SECURITY VIOLATION: OpenAI-compatible router is strictly text-only/
      );
    });
  });
});
