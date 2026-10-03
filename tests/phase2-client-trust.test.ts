import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/db/prisma';
import * as guards from '@/lib/auth/guards';
import {
  evaluateVisionSafety,
  runSafetyGatePipeline,
} from '@/lib/safety/pipeline';
import {
  getClientIp,
  getRateLimitKey,
  checkApiRateLimit,
} from '@/lib/security/rate-limit';
import {
  calculateBackoffWithJitter,
  initPublishWorker,
  getPublishWorker,
  isWorkerInitialized,
} from '@/lib/publishing/queue';
import * as session from '@/lib/auth/session';
import { GET as healthRouteGet } from '@/app/api/health/route';
import { POST as uploadAssetRoute } from '@/app/api/assets/upload/route';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

vi.mock('@google/genai');

describe('Phase 2: Remove Trust-The-Client Holes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(guards, 'requireAuth').mockResolvedValue({
      userId: 'test-user-p2',
      email: 'owner@personaq.test',
      role: 'owner',
      twoFactorAuthenticated: true,
    });
    vi.spyOn(guards, 'requirePermission').mockResolvedValue({
      userId: 'test-user-p2',
      email: 'owner@personaq.test',
      role: 'owner',
      twoFactorAuthenticated: true,
    });
    vi.spyOn(session, 'getCurrentUser').mockResolvedValue(null);
  });

  describe('1 & 2. Real Vision Safety Check & Fail-Closed Behavior', () => {
    it('parses structured JSON from Gemini vision when evaluating an image buffer', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          adultAppearing: true,
          estimatedAge: 26,
          youthLikelihood: 0.02,
          nudityLevel: 'none',
          nsfwScore: 0.01,
          realPersonResemblance: false,
          resemblanceScore: 0.04,
          matchedCelebrity: null,
          hasTextOrLogos: false,
          textOrLogosDetails: null,
          confidence: 0.95,
          reasoning: 'Mature adult subject in casual studio lighting, no logos, fully SFW.',
        }),
      });

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = {
          generateContent: mockGenerateContent,
        };
      } as unknown as typeof GoogleGenAI);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const assessment = await evaluateVisionSafety(dummyBuffer);

      expect(assessment.adultAppearing).toBe(true);
      expect(assessment.estimatedAge).toBe(26);
      expect(assessment.confidence).toBe(0.95);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('fails closed when Gemini vision confidence is below 0.70', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              adultAppearing: true,
              estimatedAge: 24,
              youthLikelihood: 0.1,
              nudityLevel: 'none',
              nsfwScore: 0.05,
              realPersonResemblance: false,
              resemblanceScore: 0.05,
              confidence: 0.55, // Low confidence!
            }),
          }),
        };
      } as unknown as typeof GoogleGenAI);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      await expect(evaluateVisionSafety(dummyBuffer)).rejects.toThrow(/confidence too low/i);

      // Pipeline must fail closed and mark asset blocked
      const result = await runSafetyGatePipeline({ buffer: dummyBuffer });
      expect(result.status).toBe('blocked');
      expect(result.reasons[0]).toContain('FAIL-CLOSED');
    });

    it('fails closed when Gemini vision call throws an error or API key is missing', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
        this.models = {
          generateContent: vi.fn().mockRejectedValue(new Error('API quota exceeded / network timeout')),
        };
      } as unknown as typeof GoogleGenAI);

      const dummyBuffer = Buffer.from('fake-image-bytes');
      const result = await runSafetyGatePipeline({ buffer: dummyBuffer });

      expect(result.status).toBe('blocked');
      expect(result.reasons[0]).toContain('FAIL-CLOSED');
      expect(result.classifierBreakdown.ageCheck.status).toBe('blocked');
      expect(result.classifierBreakdown.sfwCheck.status).toBe('blocked');
    });

    it('upload route ignores customScores and forceFailure when NODE_ENV is not test', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'test-gemini-key';

        // Mock vision check to return clean adult
        vi.mocked(GoogleGenAI).mockImplementation(function (this: { models: { generateContent: unknown } }) {
          this.models = {
            generateContent: vi.fn().mockResolvedValue({
              text: JSON.stringify({
                adultAppearing: true,
                estimatedAge: 25,
                youthLikelihood: 0.05,
                nudityLevel: 'none',
                nsfwScore: 0.02,
                realPersonResemblance: false,
                resemblanceScore: 0.05,
                confidence: 0.95,
              }),
            }),
          };
        } as unknown as typeof GoogleGenAI);

        // Create persona
        let persona = await prisma.persona.findFirst();
        if (!persona) {
          persona = await prisma.persona.create({
            data: {
              name: 'Upload Test Persona',
              adultAge: 23,
              backstory: 'Testing production upload safety',
              appearanceNotes: 'Casual',
              voiceTone: 'Friendly',
              catchphrases: '[]',
              boundaries: '[]',
              contentPillars: '[]',
              aiDisclosureText: 'AI Persona',
            },
          });
        }

        const imageBuffer = await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 240, g: 240, b: 240 },
          },
        })
          .jpeg()
          .toBuffer();

        // Form data attempting to force failure or inject fake customScores in production
        const mockFormData = new Map<string, unknown>();
        const fakeFile = new File([imageBuffer], 'test.jpg', { type: 'image/jpeg' });
        mockFormData.set('file', fakeFile);
        mockFormData.set('personaId', persona.id);
        mockFormData.set('forceFailure', 'true'); // Attacker tries to force failure/pending
        mockFormData.set(
          'customScores',
          JSON.stringify({ apparentAge: 16, youthLikelihood: 0.9 }) // Attacker tries to inject minor score
        );

        const req = new Request('http://localhost:3000/api/assets/upload', {
          method: 'POST',
        });
        (req as unknown as { formData: () => Promise<{ get: (k: string) => unknown }> }).formData = async () => ({
          get: (k: string) => mockFormData.get(k) || null,
        });

        const res = await uploadAssetRoute(req);
        expect(res.status).toBe(200);

        const data = await res.json();
        // Since in production customScores were ignored, the real vision check ran and returned passed!
        expect(data.asset.safetyStatus).toBe('passed');

        // Cleanup
        await prisma.asset.delete({ where: { id: data.asset.id } });
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('3. Rate Limiting: TRUST_PROXY=1 and Authenticated User Keying', () => {
    it('ignores x-forwarded-for unless TRUST_PROXY=1', () => {
      delete process.env.TRUSTED_PROXY;

      // When TRUST_PROXY is not 1
      process.env.TRUST_PROXY = '0';
      const spoofedReq = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '198.51.100.99' },
      });
      expect(getClientIp(spoofedReq)).toBe('direct-client');

      // When TRUST_PROXY=1
      process.env.TRUST_PROXY = '1';
      expect(getClientIp(spoofedReq)).toBe('198.51.100.99');
    });

    it('keys rate limiting by user when authenticated', () => {
      const req = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      // Unauthenticated -> keys by IP
      process.env.TRUST_PROXY = '1';
      expect(getRateLimitKey(req, null)).toBe('ip:203.0.113.1');

      // Authenticated -> keys by user ID
      expect(getRateLimitKey(req, { userId: 'usr_premium_99' })).toBe('user:usr_premium_99');
    });

    it('enforces API rate limits per user across different IP addresses', () => {
      const user = { userId: 'usr_ip_hopper' };
      const req1 = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '1.1.1.1' },
      });
      const req2 = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '2.2.2.2' },
      });

      // 2 requests allowed
      const res1 = checkApiRateLimit(req1, user, { maxRequests: 2 });
      const res2 = checkApiRateLimit(req2, user, { maxRequests: 2 });
      expect(res1.allowed).toBe(true);
      expect(res2.allowed).toBe(true);

      // 3rd request from another IP is rate limited because user limit reached
      const res3 = checkApiRateLimit(req1, user, { maxRequests: 2 });
      expect(res3.allowed).toBe(false);
      expect(res3.remaining).toBe(0);
    });
  });

  describe('4. Health Endpoint: Unauthenticated Callers get strictly { status }', () => {
    it('returns only { status } for unauthenticated requests, no internal details', async () => {
      vi.spyOn(session, 'getCurrentUser').mockResolvedValue(null);
      const req = new Request('http://localhost:3000/api/health');
      const res = await healthRouteGet(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Object.keys(data)).toEqual(['status']);
      expect(['ok', 'degraded']).toContain(data.status);
      expect(data.services).toBeUndefined();
      expect(data.counts).toBeUndefined();
      expect(data.guardrails).toBeUndefined();
    });

    it('returns detailed report for authenticated callers', async () => {
      vi.spyOn(session, 'getCurrentUser').mockResolvedValue({
        userId: 'admin-1',
        email: 'admin@personaq.test',
        role: 'admin',
        twoFactorAuthenticated: true,
      });

      const req = new Request('http://localhost:3000/api/health');
      const res = await healthRouteGet(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('counts');
      expect(data).toHaveProperty('guardrails');
    });
  });

  describe('5. Queue: No IORedis or Worker at Import Time', () => {
    it('importing queue utilities does not initialize worker or IORedis connection', () => {
      // Calling standalone utilities like jitter backoff does not spin up worker
      const backoff = calculateBackoffWithJitter(1);
      expect(backoff).toBeGreaterThanOrEqual(3000);
      expect(isWorkerInitialized()).toBe(false);
      expect(getPublishWorker()).toBeNull();
    });

    it('worker is only initialized when initPublishWorker() is explicitly called', () => {
      expect(isWorkerInitialized()).toBe(false);
      const worker = initPublishWorker();
      expect(worker).toBeDefined();
      expect(isWorkerInitialized()).toBe(true);
      expect(getPublishWorker()).toBe(worker);
    });
  });
});
