import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import {
  buildFaceCardPrompt,
  computePersonaCandidateSeed,
  generateFaceCardCandidates,
  lockFaceCard,
} from '@/lib/persona/face-card';
import { setImageProvider, ImageProvider } from '@/lib/ai/image-provider';
import { VisualGenerationError } from '@/lib/persona/visual-types';

import sharp from 'sharp';
import * as safetyModule from '@/lib/safety/pipeline';

async function createValidTestImageBuffer(width = 200, height = 200) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('Phase C: Authentic Face Card Generation & Identity Anchoring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('1. buildFaceCardPrompt: identity-first, <= 700 chars, excludes name, catchphrases, boundaries, disclosure', () => {
    const persona = {
      name: 'Ananya Selvaraj',
      adultAge: 24,
      appearanceNotes: 'Natural authentic styling, subtle beauty mark on cheek',
      backstory: 'Ananya grew up in Chennai studying computer science and loves filter coffee.',
      voiceTone: 'Warm, empathetic, thoughtful with casual banter',
      boundaries: ['No explicit nudity', 'No political endorsements'],
      contentPillars: ['Tech lifestyle', 'Coding tips', 'Coffee culture'],
      aiDisclosureText: 'This persona is an AI-generated fictional creator [Disclosed AI Persona].',
    };

    const traits = {
      ethnicity: 'south_indian',
      skinTone: 'warm_olive',
      faceCard: {
        faceShape: 'oval',
        jawline: 'softly defined',
        cheekbones: 'naturally prominent',
        eyes: 'deep brown almond',
      },
      hairStyling: {
        texture: 'wavy',
        length: 'shoulder',
      },
    };

    const prompt = buildFaceCardPrompt(persona, traits);

    // Prompt constraints
    expect(prompt.length).toBeLessThanOrEqual(700);

    // Identity-first attributes MUST be present
    expect(prompt).toContain('Adult age 24');
    expect(prompt).toContain('South Indian');
    expect(prompt).toContain('warm glowing olive-caramel');
    expect(prompt).toContain('warm engaging half-smile');

    // EXCLUDED sections MUST NOT be present in image prompt
    expect(prompt).not.toContain('Ananya'); // persona name excluded
    expect(prompt).not.toContain('Chennai'); // backstory excluded
    expect(prompt).not.toContain('filter coffee');
    expect(prompt).not.toContain('No explicit nudity'); // boundaries excluded
    expect(prompt).not.toContain('Coffee culture'); // content pillars excluded
    expect(prompt).not.toContain('[Disclosed AI Persona]'); // disclosure excluded
    expect(prompt).not.toContain('two-panel'); // 2-panel sheet logic excluded
    expect(prompt).not.toContain('camisole'); // fake stock preset attire excluded
  });

  it('2. Two personas with different traits produce different prompts and distinct seeds', () => {
    const persona1 = {
      name: 'Priya Sharma',
      adultAge: 23,
      appearanceNotes: 'High cheekbones, long straight dark hair',
      voiceTone: 'Serious and focused',
    };
    const traits1 = { ethnicity: 'north_indian' };

    const persona2 = {
      name: 'Elena Vance',
      adultAge: 27,
      appearanceNotes: 'Sharp jawline, fair complexion, shoulder-length blonde waves',
      voiceTone: 'Playful and energetic',
    };
    const traits2 = { ethnicity: 'caucasian' };

    const prompt1 = buildFaceCardPrompt(persona1, traits1);
    const prompt2 = buildFaceCardPrompt(persona2, traits2);

    expect(prompt1).not.toEqual(prompt2);
    expect(prompt1).toContain('North Indian');
    expect(prompt2).toContain('Nordic / European');

    const seed1 = computePersonaCandidateSeed('persona_alpha', 1, 0);
    const seed2 = computePersonaCandidateSeed('persona_beta', 1, 0);
    expect(seed1).not.toEqual(seed2);
  });

  it('3. computePersonaCandidateSeed produces 4 distinct deterministic seeds per candidate attempt', () => {
    const personaId = 'test_persona_xyz';
    const attempt = 1;
    const seed0 = computePersonaCandidateSeed(personaId, attempt, 0);
    const seed1 = computePersonaCandidateSeed(personaId, attempt, 1);
    const seed2 = computePersonaCandidateSeed(personaId, attempt, 2);
    const seed3 = computePersonaCandidateSeed(personaId, attempt, 3);

    const seeds = [seed0, seed1, seed2, seed3];
    const uniqueSeeds = new Set(seeds);
    expect(uniqueSeeds.size).toBe(4); // All 4 candidates get distinct seeds

    // Deterministic: calling again returns the exact same seeds
    expect(computePersonaCandidateSeed(personaId, attempt, 0)).toBe(seed0);
    expect(computePersonaCandidateSeed(personaId, attempt, 1)).toBe(seed1);
  });

  it('4. Missing ethnicity blocks generation with 400 MISSING_ETHNICITY', async () => {
    const persona = await prisma.persona.create({
      data: {
        name: 'No Ethnicity Persona',
        adultAge: 25,
        backstory: 'Testing missing ethnicity validation',
        appearanceNotes: 'Modern casual look',
        voiceTone: 'Calm',
        aiDisclosureText: 'AI Persona',
      },
    });

    try {
      await expect(
        generateFaceCardCandidates({
          personaId: persona.id,
          traits: {}, // no ethnicity provided
        })
      ).rejects.toThrowError(VisualGenerationError);

      try {
        await generateFaceCardCandidates({ personaId: persona.id, traits: {} });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(VisualGenerationError);
        const visualErr = err as VisualGenerationError;
        expect(visualErr.statusCode).toBe(400);
        expect(visualErr.code).toBe('MISSING_ETHNICITY');
      }
    } finally {
      await prisma.persona.delete({ where: { id: persona.id } });
    }
  });

  it('5. Generates 4 single-portrait candidates in parallel with distinct seeds recorded in provenanceMeta', async () => {
    const validImage = await createValidTestImageBuffer();
    vi.spyOn(safetyModule, 'runSafetyGatePipeline').mockResolvedValue({
      status: 'passed',
      apparentAge: 24,
      youthLikelihood: 0.05,
      realPersonLikeness: 0.05,
      nsfwScore: 0.01,
      reasons: ['Passed all visual guardrails'],
      classifierBreakdown: {
        ageCheck: { status: 'passed', estimatedAge: 24, details: 'Adult' },
        likenessCheck: { status: 'passed', score: 0.05 },
        sfwCheck: { status: 'passed', score: 0.01, details: 'SFW' },
      },
      evaluatedAt: new Date().toISOString(),
    });

    const mockProvider: ImageProvider = {
      name: 'mock_test_provider',
      capabilities: { referenceImage: false, maxReferences: 0 },
      isAvailable: async () => true,
      generateImage: async (opts) => ({
        buffer: validImage,
        mimeType: 'image/jpeg',
        provider: 'mock_test_provider',
        model: 'flux-mock-test',
        prompt: opts.prompt,
        estimatedCost: 0,
      }),
    };
    setImageProvider(mockProvider);

    const persona = await prisma.persona.create({
      data: {
        name: 'Multi Candidate Persona',
        adultAge: 23,
        backstory: 'Testing 4 candidate parallel generation',
        appearanceNotes: 'Expressive eyes, natural hairstyle',
        voiceTone: 'Friendly',
        aiDisclosureText: 'AI Persona',
        visualModelConfig: JSON.stringify({ ethnicity: 'east_asian' }),
      },
    });

    try {
      const result = await generateFaceCardCandidates({
        personaId: persona.id,
        attempt: 1,
        candidateCount: 4,
      });

      expect(result.candidates.length).toBe(4);
      const seeds: number[] = [];

      for (let i = 0; i < result.candidates.length; i++) {
        const candidate = result.candidates[i];
        expect(candidate.kind).toBe('face_candidate');
        expect(candidate.type).toBe('image');
        expect(candidate.safetyStatus).toBe('passed');

        const meta = JSON.parse(candidate.provenanceMeta || '{}');
        expect(meta.seed).toBeDefined();
        expect(meta.candidateIndex).toBe(i);
        expect(meta.provider).toBe('mock_test_provider');
        seeds.push(meta.seed);
      }

      const uniqueSeeds = new Set(seeds);
      expect(uniqueSeeds.size).toBe(4);
    } finally {
      await prisma.asset.deleteMany({ where: { personaId: persona.id } });
      await prisma.persona.delete({ where: { id: persona.id } });
      setImageProvider(null as unknown as ImageProvider);
    }
  });

  it('6. Lock face requires candidate with passed safety status and locks directly to single face_locked portrait', async () => {
    const validImage = await createValidTestImageBuffer();
    const persona = await prisma.persona.create({
      data: {
        name: 'Safety Lock Persona',
        adultAge: 24,
        backstory: 'Testing lock safety requirement',
        appearanceNotes: 'Classic styling',
        voiceTone: 'Warm',
        aiDisclosureText: 'AI Persona',
        faceStatus: 'draft',
      },
    });

    const candidateKey = `personas/${persona.id}/candidates/portrait_unsafe.jpg`;
    const uploadRes = await storage.upload(validImage, candidateKey, 'image/jpeg');

    // Create an asset that has not passed safety
    const unsafeAsset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: candidateKey,
        url: uploadRes.url,
        type: 'image',
        kind: 'face_candidate',
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: 'blocked',
        safetyReasons: JSON.stringify(['Age verification failed']),
      },
    });

    // Create a safe asset that passed
    const safeAssetKey = `personas/${persona.id}/candidates/portrait_safe.jpg`;
    const safeUploadRes = await storage.upload(validImage, safeAssetKey, 'image/jpeg');
    const safeAsset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: safeAssetKey,
        url: safeUploadRes.url,
        type: 'image',
        kind: 'face_candidate',
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: 'passed',
        safetyReasons: JSON.stringify(['Passed']),
      },
    });

    try {
      // 1. Locking blocked asset must fail with 400
      await expect(
        lockFaceCard({
          personaId: persona.id,
          assetId: unsafeAsset.id,
        })
      ).rejects.toThrowError(VisualGenerationError);

      try {
        await lockFaceCard({ personaId: persona.id, assetId: unsafeAsset.id });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(VisualGenerationError);
        expect((err as VisualGenerationError).code).toBe('SAFETY_STATUS_NOT_PASSED');
      }

      // 2. Locking safe candidate succeeds and anchors face_locked
      const lockResult = await lockFaceCard({
        personaId: persona.id,
        assetId: safeAsset.id,
      });

      expect(lockResult.faceAsset.kind).toBe('face_locked');
      expect(lockResult.faceAsset.parentAssetId).toBe(safeAsset.id);

      const dbPersona = await prisma.persona.findUnique({ where: { id: persona.id } });
      expect(dbPersona?.faceStatus).toBe('locked');
      expect(dbPersona?.faceAssetId).toBe(lockResult.faceAsset.id);
      expect(dbPersona?.avatarUrl).toBe(lockResult.faceAsset.url);
    } finally {
      await prisma.asset.deleteMany({ where: { personaId: persona.id } });
      await prisma.personaVersion.deleteMany({ where: { personaId: persona.id } });
      await prisma.persona.delete({ where: { id: persona.id } });
    }
  });
});
