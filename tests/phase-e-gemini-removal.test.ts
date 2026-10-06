import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  evaluateVisionSafety,
  runSafetyGatePipeline,
  setVisionClassifier,
  evaluateApparentAge,
} from '@/lib/safety/pipeline';
import {
  evaluateConsistency,
  calculateLocalSimilarity,
  setConsistencyEvaluator,
} from '@/lib/persona/consistency';
import { getImageProvider } from '@/lib/ai/image-provider';
import { getDemographicAgeEstimate } from '@/lib/free-apis';
import { GET as healthRouteGet } from '@/app/api/health/route';
import * as session from '@/lib/auth/session';

describe('Phase E: Complete Removal of Gemini and Guardrail Hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    setVisionClassifier(null);
    setConsistencyEvaluator(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setVisionClassifier(null);
    setConsistencyEvaluator(null);
    vi.restoreAllMocks();
  });

  // 1. Codebase Cleanliness: Zero Gemini Imports or Files
  describe('1. Codebase Cleanliness & SDK Decoupling', () => {
    it('verifies src/lib/ai/gemini.ts does not exist', () => {
      const geminiFilePath = path.join(process.cwd(), 'src', 'lib', 'ai', 'gemini.ts');
      expect(fs.existsSync(geminiFilePath)).toBe(false);
    });

    it('verifies package.json does not contain @google/genai dependency', () => {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.dependencies?.['@google/genai']).toBeUndefined();
      expect(pkg.devDependencies?.['@google/genai']).toBeUndefined();
    });

    it('verifies default image provider is OpenSourceImageProvider', () => {
      const provider = getImageProvider();
      expect(provider.name).toBe('opensource');
    });
  });

  // 2. Pluggable Vision Classifier & Fail-Closed Behavior
  describe('2. Pluggable Vision Classifier & Fail-Closed Behavior', () => {
    it('fails closed when vision classifier confidence is below threshold (< 0.60)', async () => {
      setVisionClassifier({
        name: 'mock-low-confidence',
        classify: async () => ({
          adultAppearing: true,
          estimatedAge: 25,
          youthLikelihood: 0.05,
          nudityLevel: 'none',
          nsfwScore: 0.01,
          realPersonResemblance: false,
          resemblanceScore: 0.02,
          confidence: 0.45, // below threshold
        }),
      });

      const dummyBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
      }).jpeg().toBuffer();

      await expect(evaluateVisionSafety(dummyBuffer)).rejects.toThrow(/confidence too low/i);

      const pipelineResult = await runSafetyGatePipeline({ buffer: dummyBuffer });
      expect(pipelineResult.status).toBe('blocked');
      expect(pipelineResult.reasons[0]).toContain('FAIL-CLOSED');
    });

    it('fails closed when vision classifier encounters timeout or error', async () => {
      setVisionClassifier({
        name: 'mock-error-classifier',
        classify: async () => {
          throw new Error('Connection timeout to vision model endpoint');
        },
      });

      const dummyBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
      }).jpeg().toBuffer();

      const pipelineResult = await runSafetyGatePipeline({ buffer: dummyBuffer });
      expect(pipelineResult.status).toBe('blocked');
      expect(pipelineResult.reasons[0]).toContain('FAIL-CLOSED');
      expect(pipelineResult.classifierBreakdown.ageCheck.status).toBe('blocked');
    });

    it('strictly enforces adult threshold of 21 and stays blind to declared age', async () => {
      // Declared age 25 in metadata must NOT override apparent visual age 19
      const resultUnder21 = await evaluateApparentAge({
        metadata: { adultAge: 25 },
        customScores: { apparentAge: 19, youthLikelihood: 0.15 },
      });
      expect(resultUnder21.status).toBe('blocked');
      expect(resultUnder21.estimatedAge).toBe(19);
      expect(resultUnder21.details).toContain('adult threshold of 21 years');

      // Age 17 must be blocked with under 18 notice
      const resultMinor = await evaluateApparentAge({
        metadata: { adultAge: 22 },
        customScores: { apparentAge: 17, youthLikelihood: 0.90 },
      });
      expect(resultMinor.status).toBe('blocked');
      expect(resultMinor.details).toContain('under 18');

      // Valid adult age 22 passes
      const resultAdult = await evaluateApparentAge({
        customScores: { apparentAge: 22, youthLikelihood: 0.05 },
      });
      expect(resultAdult.status).toBe('passed');
      expect(resultAdult.estimatedAge).toBe(22);
    });
  });

  // 3. CPU-based Biometric Similarity Analysis
  describe('3. CPU-based Biometric Similarity & Pluggable Consistency Evaluator', () => {
    it('computes local image structural similarity deterministically without external API', async () => {
      const img1 = await sharp({
        create: { width: 128, height: 128, channels: 3, background: { r: 200, g: 100, b: 50 } },
      }).jpeg().toBuffer();

      const img2 = await sharp({
        create: { width: 128, height: 128, channels: 3, background: { r: 200, g: 100, b: 50 } },
      }).jpeg().toBuffer();

      const similarity = await calculateLocalSimilarity(img1, img2);
      expect(similarity.score).toBeGreaterThan(95);

      const diffImg = await sharp({
        create: { width: 128, height: 128, channels: 3, background: { r: 10, g: 10, b: 240 } },
      }).jpeg().toBuffer();

      const diffSimilarity = await calculateLocalSimilarity(img1, diffImg);
      expect(diffSimilarity.score).toBeLessThan(similarity.score);
    });

    it('fails closed when consistency evaluation encounters an error', async () => {
      setConsistencyEvaluator(async () => {
        throw new Error('Vision consistency service unavailable');
      });

      const res = await evaluateConsistency(Buffer.from('ref'), Buffer.from('cand'));
      expect(res.score).toBe(0);
      expect(res.passed).toBe(false);
      expect(res.status).toBe('drifted — regenerate');
    });
  });

  // 4. Free APIs Age Clamping
  describe('4. Free APIs Age Clamping to Adult 21+', () => {
    it('clamps Agify predicted age to at least 21', async () => {
      // Mock Agify returning age 16 for a name
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('api.agify.io')) {
          return new Response(JSON.stringify({ name: 'test', age: 16, count: 100 }), { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      });

      const details = await getDemographicAgeEstimate('Priya');
      expect(details.suggestedAge).toBeGreaterThanOrEqual(21);
      expect(details.suggestedAge).toBe(21);
    });
  });

  // 5. Health Endpoint Without Gemini
  describe('5. Health Endpoint Provider Reporting', () => {
    it('reports AI text, image provider, and vision classifier status without leaking secrets', async () => {
      vi.spyOn(session, 'getCurrentUser').mockResolvedValue({
        userId: 'admin-id',
        email: 'admin@personaq.test',
        role: 'admin',
        twoFactorAuthenticated: true,
      });

      process.env.OPENAI_COMPAT_BASE_URL = 'http://localhost:11434';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf-test-id';
      process.env.CLOUDFLARE_API_TOKEN = 'cf-test-token-secret-12345';
      process.env.POLLINATIONS_API_KEY = 'poll-test-token-secret-67890';

      const req = new Request('http://localhost:3000/api/health');
      const res = await healthRouteGet(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.services.aiText).toBeDefined();
      expect(data.services.imageProvider).toBeDefined();
      expect(data.services.visionClassifier).toBeDefined();

      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('cf-test-token-secret-12345');
      expect(serialized).not.toContain('poll-test-token-secret-67890');
      expect(serialized).not.toContain('GEMINI');
    });
  });
});
