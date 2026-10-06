import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPersonaSystemPrompt } from '@/lib/persona/prompt';
import { validatePersonaGuardrails } from '@/lib/guardrails/rules';
import { buildVisualModelPrompt, getPersonaMultiAnglePackClient, generatePersonaVisual, VisualGenerationError } from '@/lib/persona/visual';
import { queueComfyGeneration } from '@/lib/comfyui/client';
import { POST as lockFaceRoute } from '@/app/api/persona/lock-face/route';
import { POST as generateContentRoute } from '@/app/api/persona/generate-content/route';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import * as guards from '@/lib/auth/guards';
import sharp from 'sharp';

describe('Persona Agent & Prompt Context', () => {
  const validPersona = {
    name: 'Aria Nova',
    adultAge: 26,
    backstory: 'Aria is a digital artist living in Neo-Arcadia.',
    appearanceNotes: 'Stylized violet eyes, silver bob, clearly digital aesthetic.',
    voiceTone: 'Thoughtful, curious, witty, approachable.',
    catchphrases: ['Pixels into imagination', 'Code meets beauty'],
    boundaries: ['Never simulate real grief', 'No minor depictions'],
    contentPillars: ['Digital Art', 'Workflows'],
    aiDisclosureText: '✨ Disclosed Fictional AI Persona: Created with generative AI tools.',
  };

  it('should compile an authoritative AI system prompt containing all guardrails', () => {
    const prompt = buildPersonaSystemPrompt(validPersona);

    // Verify Adult Guardrail
    expect(prompt).toContain('Adult (26 years old)');
    expect(prompt).toContain('NEVER depict, reference, or simulate minors');

    // Verify AI Disclosure Guardrail
    expect(prompt).toContain('MANDATORY AI DISCLOSURE');
    expect(prompt).toContain('✨ Disclosed Fictional AI Persona');

    // Verify Fictional Identity Guardrail
    expect(prompt).toContain('Fictional, AI-generated digital creator');
    expect(prompt).toContain('NEVER claim or pretend to be a real human person');

    // Verify Persona Voice & Context
    expect(prompt).toContain('Aria is a digital artist living in Neo-Arcadia.');
    expect(prompt).toContain('Thoughtful, curious, witty, approachable.');
    expect(prompt).toContain('Pixels into imagination');
    expect(prompt).toContain('Never simulate real grief');
  });

  it('should refuse to generate system prompt if persona has guardrail violations', () => {
    expect(() =>
      buildPersonaSystemPrompt({
        ...validPersona,
        adultAge: 16, // Minor violation
      })
    ).toThrow(/Guardrail violation/);

    expect(() =>
      buildPersonaSystemPrompt({
        ...validPersona,
        aiDisclosureText: '', // Missing disclosure
      })
    ).toThrow(/Guardrail violation/);
  });

  it('should validate persona fields with validatePersonaGuardrails', () => {
    const invalidAge = validatePersonaGuardrails({
      adultAge: 17,
      aiDisclosureText: 'Valid disclosure',
    });
    expect(invalidAge.valid).toBe(false);
    expect(invalidAge.errors[0]).toContain('Minors are strictly prohibited');

    const missingDisclosure = validatePersonaGuardrails({
      adultAge: 27,
      aiDisclosureText: '',
    });
    expect(missingDisclosure.valid).toBe(false);
    expect(missingDisclosure.errors[0]).toContain('AI disclosure text is mandatory');
  });

  describe('Visual Model Generator (Gemini / Imagen Engine)', () => {
    it('builds a compliant photorealistic prompt for a South Indian traditional look', () => {
      const { prompt, negativePrompt } = buildVisualModelPrompt(
        {
          ethnicity: 'south_indian',
          styleLook: 'traditional',
          bodyStructure: 'slender',
          shotType: 'portrait',
        },
        'Aria Nova',
        26
      );

      expect(prompt).toContain('Aria Nova');
      expect(prompt).toContain('strictly 26 years old');
      expect(prompt).toContain('South Indian');
      expect(prompt).toContain('Kanjeevaram silk saree');
      expect(prompt).toContain('temple gold jewelry');
      expect(prompt).toContain('Mandatory Guardrails: Adult woman (age >= 21)');
      expect(prompt).toContain('zero likeness to any real person');
      expect(negativePrompt).toContain('minor');
      expect(negativePrompt).toContain('real person likeness');
    });

    it('builds a modern aesthetic prompt with tailored blazer styling', () => {
      const { prompt } = buildVisualModelPrompt(
        {
          ethnicity: 'south_indian',
          styleLook: 'modern',
          bodyStructure: 'athletic',
          shotType: 'medium',
        },
        'Aria Nova',
        26
      );

      expect(prompt).toContain('contemporary modern chic');
      expect(prompt).toContain('tailored minimalist blazer');
      expect(prompt).toContain('Medium shot waist-up');
    });

    it('resolves consistent 5-angle reference pack structure without fake presets', () => {
      const pack = getPersonaMultiAnglePackClient('south_indian', undefined, 'minimal_studio', 'https://storage/avatar.jpg');

      expect(pack).toHaveLength(5);
      expect(pack[0].angle).toBe('front');
      expect(pack[0].url).toBe('https://storage/avatar.jpg');
      expect(pack[1].angle).toBe('side');
      expect(pack[2].angle).toBe('full_body');
      expect(pack[3].angle).toBe('full_back');
      expect(pack[4].angle).toBe('full_side');
    });
  });

  describe('Honest Visual Generation Pipeline (Zero Silent Mocks)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('generatePersonaVisual throws VisualGenerationError 503 PROVIDER_UNAVAILABLE when GEMINI_API_KEY is not configured', async () => {
      const origKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        await expect(
          generatePersonaVisual({
            personaId: 'test-id',
            options: { ethnicity: 'south_indian', styleLook: 'traditional', bodyStructure: 'hourglass', shotType: 'portrait' },
            personaName: 'Test Persona',
            adultAge: 25,
          })
        ).rejects.toThrow(VisualGenerationError);

        try {
          await generatePersonaVisual({
            personaId: 'test-id',
            options: { ethnicity: 'south_indian', styleLook: 'traditional', bodyStructure: 'hourglass', shotType: 'portrait' },
            personaName: 'Test Persona',
            adultAge: 25,
          });
        } catch (err: unknown) {
          const e = err as VisualGenerationError;
          expect(e.code).toBe('PROVIDER_UNAVAILABLE');
          expect(e.statusCode).toBe(503);
        }
      } finally {
        if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
      }
    });

    it('queueComfyGeneration throws VisualGenerationError 503 GPU_OFFLINE when ComfyUI is unreachable', async () => {
      await expect(
        queueComfyGeneration({
          prompt: 'test prompt',
          aspectRatio: '1:1',
        })
      ).rejects.toThrow(VisualGenerationError);

      try {
        await queueComfyGeneration({
          prompt: 'test prompt',
          aspectRatio: '1:1',
        });
      } catch (err: unknown) {
        const e = err as VisualGenerationError;
        expect(e.code).toBe('GPU_OFFLINE');
        expect(e.statusCode).toBe(503);
      }
    });

    it('POST /api/persona/generate-content returns 503 PROVIDER_UNAVAILABLE for unconfigured video generation', async () => {
      vi.spyOn(guards, 'requireAuth').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });
      vi.spyOn(guards, 'requirePermission').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });

      const persona = await prisma.persona.create({
        data: {
          name: 'Video Test Persona',
          adultAge: 24,
          backstory: 'Testing honest pipeline',
          appearanceNotes: 'Photorealistic',
          voiceTone: 'Calm',
          aiDisclosureText: 'AI Persona',
          faceStatus: 'locked',
        },
      });

      try {
        const req = new Request('http://localhost:3000/api/persona/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            mediaType: 'video',
            prompt: 'Walking in a scenic garden at golden hour',
          }),
        });

        const res = await generateContentRoute(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.code).toBe('PROVIDER_UNAVAILABLE');
        expect(data.error).toContain('Video generation provider is not configured');
      } finally {
        await prisma.persona.delete({ where: { id: persona.id } });
      }
    });

    it('POST /api/persona/generate-content returns 503 PROVIDER_UNAVAILABLE when image provider is unconfigured', async () => {
      const origKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      vi.spyOn(guards, 'requireAuth').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });
      vi.spyOn(guards, 'requirePermission').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });

      const persona = await prisma.persona.create({
        data: {
          name: 'Image Test Persona',
          adultAge: 24,
          backstory: 'Testing honest image pipeline',
          appearanceNotes: 'Photorealistic',
          voiceTone: 'Calm',
          aiDisclosureText: 'AI Persona',
          faceStatus: 'locked',
        },
      });

      try {
        const req = new Request('http://localhost:3000/api/persona/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            mediaType: 'image',
            prompt: 'Portrait in morning light',
          }),
        });

        const res = await generateContentRoute(req);
        expect(res.status).toBe(503);
        const data = await res.json();
        expect(data.code).toBe('PROVIDER_UNAVAILABLE');
        expect(data.error).toContain('No cloud visual generation provider configured');
      } finally {
        if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
        await prisma.persona.delete({ where: { id: persona.id } });
      }
    });
  });

  describe('Persona Face Card Anchoring & Integrity', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('POST /api/persona/lock-face locks identity with valid candidate asset, updates avatarUrl and creates PersonaVersion snapshot', async () => {
      vi.spyOn(guards, 'requireAuth').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });
      vi.spyOn(guards, 'requirePermission').mockResolvedValue({
        userId: 'user-1',
        email: 'owner@personaq.test',
        role: 'owner',
        twoFactorAuthenticated: true,
      });

      const persona = await prisma.persona.create({
        data: {
          name: 'Lock Card Test Persona',
          adultAge: 25,
          backstory: 'Face lock testing',
          appearanceNotes: 'Distinctive cheek dimple',
          voiceTone: 'Warm',
          aiDisclosureText: 'AI Persona',
          visualModelConfig: JSON.stringify({
            ethnicity: 'south_indian',
            styleLook: 'traditional',
          }),
        },
      });

      // Create a test 2-panel candidate sheet using sharp
      const dummySheet = await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      const candidateKey = `personas/${persona.id}/candidates/test_sheet.jpg`;
      const uploadRes = await storage.upload(dummySheet, candidateKey, 'image/jpeg');

      const candidateAsset = await prisma.asset.create({
        data: {
          personaId: persona.id,
          storageKey: candidateKey,
          url: uploadRes.url,
          type: 'image',
          kind: 'face_candidate',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          safetyReasons: JSON.stringify(['Passed']),
        },
      });

      try {
        // 1. Lock face with valid candidate assetId
        const lockReq = new Request('http://localhost:3000/api/persona/lock-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: persona.id,
            assetId: candidateAsset.id,
          }),
        });

        const lockRes = await lockFaceRoute(lockReq);
        expect(lockRes.status).toBe(200);
        const lockData = await lockRes.json();
        expect(lockData.success).toBe(true);
        expect(lockData.isFaceLocked).toBe(true);
        expect(lockData.faceAssetId).toBeDefined();
        expect(lockData.bodyAssetId).toBeDefined();

        // Verify Persona in DB
        const updatedPersona = await prisma.persona.findUnique({ where: { id: persona.id } });
        expect(updatedPersona?.faceStatus).toBe('locked');
        expect(updatedPersona?.faceAssetId).toBe(lockData.faceAssetId);
        expect(updatedPersona?.bodyAssetId).toBe(lockData.bodyAssetId);
        expect(updatedPersona?.avatarUrl).toBe(lockData.lockedFaceUrl);

        // Verify PersonaVersion snapshot created
        const versions = await prisma.personaVersion.findMany({
          where: { personaId: persona.id },
          orderBy: { versionNumber: 'desc' },
        });
        expect(versions.length).toBeGreaterThanOrEqual(1);
        expect(versions[0].changeSummary).toContain('Face card locked');

        // Verify Asset record created (face_locked)
        const faceAsset = await prisma.asset.findUnique({ where: { id: lockData.faceAssetId } });
        expect(faceAsset).not.toBeNull();
        expect(faceAsset?.kind).toBe('face_locked');
        expect(faceAsset?.parentAssetId).toBe(candidateAsset.id);
      } finally {
        await prisma.asset.deleteMany({ where: { personaId: persona.id } });
        await prisma.personaVersion.deleteMany({ where: { personaId: persona.id } });
        await prisma.persona.delete({ where: { id: persona.id } });
      }
    });
  });
});

