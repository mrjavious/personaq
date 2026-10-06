import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import * as guards from '@/lib/auth/guards';
import sharp from 'sharp';
import { lockFaceCard, buildFaceCardPrompt } from '@/lib/persona/face-card';
import { POST as generateVisualPost, GET as generateVisualGet } from '@/app/api/persona/generate-visual/route';
import { POST as generateContentPost, GET as generateContentGet } from '@/app/api/persona/generate-content/route';
import { POST as lockFaceRoute } from '@/app/api/persona/face-card/lock/route';
import { GoogleGenAI } from '@google/genai';

vi.mock('@google/genai');

describe('Phase 1: Face Card Identity Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(guards, 'requireAuth').mockResolvedValue({
      userId: 'test-user-1',
      email: 'owner@personaq.test',
      role: 'owner',
      twoFactorAuthenticated: true,
    });
    vi.spyOn(guards, 'requirePermission').mockResolvedValue({
      userId: 'test-user-1',
      email: 'owner@personaq.test',
      role: 'owner',
      twoFactorAuthenticated: true,
    });
  });

  async function createTestImageBuffer(width = 200, height = 100): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('1. buildFaceCardPrompt specifies single front-facing portrait identity-first <= 700 chars', () => {
    const prompt = buildFaceCardPrompt({
      name: 'Maya Lin',
      adultAge: 25,
      appearanceNotes: 'Warm caramel skin, dark expressive eyes, high cheekbones.',
      voiceTone: 'Warm & articulate',
    });

    expect(prompt.length).toBeLessThanOrEqual(700);
    expect(prompt).toContain('Adult age 25');
    expect(prompt).toContain('Warm caramel skin');
    expect(prompt).toContain('front-facing studio portrait');
    expect(prompt).toContain('85mm lens');
    expect(prompt).toContain('no text');
    expect(prompt).not.toContain('two-panel');
    expect(prompt).not.toContain('Left Panel');
    expect(prompt).not.toContain('Right Panel');
  });

  it('2. Lock fails for another personas asset (403 FORBIDDEN_ASSET)', async () => {
    const personaA = await prisma.persona.create({
      data: {
        name: 'Persona Alpha',
        adultAge: 24,
        backstory: 'Alpha story',
        appearanceNotes: 'Alpha appearance',
        voiceTone: 'Calm',
        aiDisclosureText: 'AI Persona',
      },
    });

    const personaB = await prisma.persona.create({
      data: {
        name: 'Persona Beta',
        adultAge: 25,
        backstory: 'Beta story',
        appearanceNotes: 'Beta appearance',
        voiceTone: 'Confident',
        aiDisclosureText: 'AI Persona',
      },
    });

    const sheetBuffer = await createTestImageBuffer();
    const candidateKeyB = `personas/${personaB.id}/candidates/sheet_beta.jpg`;
    const uploadRes = await storage.upload(sheetBuffer, candidateKeyB, 'image/jpeg');

    const assetB = await prisma.asset.create({
      data: {
        personaId: personaB.id,
        storageKey: candidateKeyB,
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
      // Persona A tries to lock Persona B's asset -> must fail with 403
      await expect(
        lockFaceCard({
          personaId: personaA.id,
          assetId: assetB.id,
        })
      ).rejects.toThrow(/does not belong to this persona/i);

      // Also test via API route
      const req = new Request('http://localhost:3000/api/persona/face-card/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: personaA.id,
          assetId: assetB.id,
        }),
      });

      const res = await lockFaceRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('does not belong to this persona');
    } finally {
      await prisma.asset.deleteMany({ where: { personaId: { in: [personaA.id, personaB.id] } } });
      await prisma.persona.deleteMany({ where: { id: { in: [personaA.id, personaB.id] } } });
    }
  });

  it('3. Views and content generation return 409 before face is locked', async () => {
    const unlockedPersona = await prisma.persona.create({
      data: {
        name: 'Unlocked Persona',
        adultAge: 23,
        backstory: 'Waiting for face lock',
        appearanceNotes: 'Natural features',
        voiceTone: 'Gentle',
        aiDisclosureText: 'AI Persona',
        faceStatus: 'none',
      },
    });

    try {
      // POST /api/persona/generate-visual -> 409
      const genVisualReq = new Request('http://localhost:3000/api/persona/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: unlockedPersona.id,
          cameraAngle: 'side',
        }),
      });
      const genVisualRes = await generateVisualPost(genVisualReq);
      expect(genVisualRes.status).toBe(409);
      const visualData = await genVisualRes.json();
      expect(visualData.code).toBe('FACE_NOT_LOCKED');

      // GET /api/persona/generate-visual -> 409
      const getVisualReq = new Request(`http://localhost:3000/api/persona/generate-visual?personaId=${unlockedPersona.id}`);
      const getVisualRes = await generateVisualGet(getVisualReq);
      expect(getVisualRes.status).toBe(409);
      const getVisualData = await getVisualRes.json();
      expect(getVisualData.code).toBe('FACE_NOT_LOCKED');

      // POST /api/persona/generate-content -> 409
      const genContentReq = new Request('http://localhost:3000/api/persona/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: unlockedPersona.id,
          prompt: 'Coffee shop morning portrait',
        }),
      });
      const genContentRes = await generateContentPost(genContentReq);
      expect(genContentRes.status).toBe(409);
      const contentData = await genContentRes.json();
      expect(contentData.code).toBe('FACE_NOT_LOCKED');

      // GET /api/persona/generate-content -> 409
      const getContentReq = new Request(`http://localhost:3000/api/persona/generate-content?personaId=${unlockedPersona.id}`);
      const getContentRes = await generateContentGet(getContentReq);
      expect(getContentRes.status).toBe(409);
      const getContentData = await getContentRes.json();
      expect(getContentData.code).toBe('FACE_NOT_LOCKED');
    } finally {
      await prisma.persona.delete({ where: { id: unlockedPersona.id } });
    }
  });

  it('4. Chosen portrait candidate locks directly to face_locked and retires previous', async () => {
    const persona = await prisma.persona.create({
      data: {
        name: 'Portrait Verification Persona',
        adultAge: 26,
        backstory: 'Portrait lock test',
        appearanceNotes: 'Symmetrical features',
        voiceTone: 'Professional',
        aiDisclosureText: 'AI Persona',
        faceStatus: 'draft',
      },
    });

    const sheetBuffer = await createTestImageBuffer(400, 400);
    const candidateKey = `personas/${persona.id}/candidates/portrait_1.jpg`;
    const uploadRes = await storage.upload(sheetBuffer, candidateKey, 'image/jpeg');

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
      const lockResult = await lockFaceCard({
        personaId: persona.id,
        assetId: candidateAsset.id,
      });

      expect(lockResult.faceAsset.kind).toBe('face_locked');
      expect(lockResult.faceAsset.parentAssetId).toBe(candidateAsset.id);

      const dbPersona = await prisma.persona.findUnique({ where: { id: persona.id } });
      expect(dbPersona?.faceStatus).toBe('locked');
      expect(dbPersona?.faceAssetId).toBe(lockResult.faceAsset.id);

      // Now lock a second candidate to test retirement of previous locked assets
      const sheetBuffer2 = await createTestImageBuffer(400, 400);
      const candidateKey2 = `personas/${persona.id}/candidates/portrait_2.jpg`;
      const uploadRes2 = await storage.upload(sheetBuffer2, candidateKey2, 'image/jpeg');
      const candidateAsset2 = await prisma.asset.create({
        data: {
          personaId: persona.id,
          storageKey: candidateKey2,
          url: uploadRes2.url,
          type: 'image',
          kind: 'face_candidate',
          suitability: 'sfw_safe',
          aiGenerated: true,
          safetyStatus: 'passed',
          safetyReasons: JSON.stringify(['Passed']),
        },
      });

      const lockResult2 = await lockFaceCard({
        personaId: persona.id,
        assetId: candidateAsset2.id,
      });

      // Previous faceAsset should now be marked face_retired
      const previousFace = await prisma.asset.findUnique({ where: { id: lockResult.faceAsset.id } });
      expect(previousFace?.kind).toBe('face_retired');

      // New asset is locked
      expect(lockResult2.faceAsset.kind).toBe('face_locked');
    } finally {
      await prisma.asset.deleteMany({ where: { personaId: persona.id } });
      await prisma.personaVersion.deleteMany({ where: { personaId: persona.id } });
      await prisma.persona.delete({ where: { id: persona.id } });
    }
  });

  it('5. Reference bytes are present in Gemini request and regenerating a view leaves faceAssetId unchanged', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key-12345';

    const persona = await prisma.persona.create({
      data: {
        name: 'Reference Check Persona',
        adultAge: 27,
        backstory: 'Ref test',
        appearanceNotes: 'Striking features',
        voiceTone: 'Vibrant',
        aiDisclosureText: 'AI Persona',
        faceStatus: 'locked',
      },
    });

    const faceBuf = await createTestImageBuffer(100, 100);
    const bodyBuf = await createTestImageBuffer(100, 100);

    const faceKey = `personas/${persona.id}/face_locked.jpg`;
    const bodyKey = `personas/${persona.id}/body_locked.jpg`;
    const [faceUpload, bodyUpload] = await Promise.all([
      storage.upload(faceBuf, faceKey, 'image/jpeg'),
      storage.upload(bodyBuf, bodyKey, 'image/jpeg'),
    ]);

    const faceAsset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: faceKey,
        url: faceUpload.url,
        type: 'image',
        kind: 'face_locked',
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: 'passed',
        safetyReasons: JSON.stringify(['Passed']),
      },
    });

    const bodyAsset = await prisma.asset.create({
      data: {
        personaId: persona.id,
        storageKey: bodyKey,
        url: bodyUpload.url,
        type: 'image',
        kind: 'body_locked',
        suitability: 'sfw_safe',
        aiGenerated: true,
        safetyStatus: 'passed',
        safetyReasons: JSON.stringify(['Passed']),
      },
    });

    await prisma.persona.update({
      where: { id: persona.id },
      data: {
        faceAssetId: faceAsset.id,
        bodyAssetId: bodyAsset.id,
        avatarUrl: faceAsset.url,
      },
    });

    // Mock Gemini client to capture contents
    let capturedContents: unknown = null;
    const dummyReturnBuf = await createTestImageBuffer(100, 100);
    const mockGenerateContent = vi.fn().mockImplementation(async (params: { contents: unknown }) => {
      capturedContents = params.contents;
      if (
        Array.isArray(params.contents) &&
        params.contents.some((c: unknown) => typeof c === 'string' && c.includes('compliance and safety classifier'))
      ) {
        return {
          text: JSON.stringify({
            adultAppearing: true,
            estimatedAge: 25,
            youthLikelihood: 0.02,
            nudityLevel: 'none',
            nsfwScore: 0.01,
            realPersonResemblance: false,
            resemblanceScore: 0.03,
            hasTextOrLogos: false,
            confidence: 0.95,
          }),
        };
      }

      return {
        text: JSON.stringify({
          adultAppearing: true,
          estimatedAge: 25,
          youthLikelihood: 0.02,
          nudityLevel: 'none',
          nsfwScore: 0.01,
          realPersonResemblance: false,
          resemblanceScore: 0.03,
          hasTextOrLogos: false,
          confidence: 0.95,
        }),
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: dummyReturnBuf.toString('base64'),
                  },
                },
              ],
            },
          },
        ],
      };
    });

    (GoogleGenAI as unknown as { prototype: { models: { generateContent: typeof mockGenerateContent } } }).prototype.models = {
      generateContent: mockGenerateContent,
    };

    try {
      const postReq = new Request('http://localhost:3000/api/persona/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: persona.id,
          cameraAngle: 'side',
        }),
      });

      const res = await generateVisualPost(postReq);
      expect(res.status).toBe(200);

      // Verify reference parts in capturedContents
      expect(Array.isArray(capturedContents)).toBe(true);
      const contentsArray = capturedContents as Array<{ inlineData?: { data: string; mimeType: string } } | string>;
      const inlineDataParts = contentsArray.filter((c) => typeof c === 'object' && c?.inlineData);
      expect(inlineDataParts.length).toBeGreaterThanOrEqual(1);

      // Verify that regenerating a view leaves persona.faceAssetId unchanged
      const personaAfter = await prisma.persona.findUnique({ where: { id: persona.id } });
      expect(personaAfter?.faceAssetId).toBe(faceAsset.id);
      expect(personaAfter?.faceStatus).toBe('locked');

      // Verify view asset was saved with parentAssetId = faceAsset.id
      const viewAsset = await prisma.asset.findFirst({
        where: { personaId: persona.id, kind: 'view' },
      });
      expect(viewAsset).not.toBeNull();
      expect(viewAsset?.parentAssetId).toBe(faceAsset.id);
    } finally {
      await prisma.asset.deleteMany({ where: { personaId: persona.id } });
      await prisma.persona.delete({ where: { id: persona.id } });
    }
  });
});
