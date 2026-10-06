import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '@/lib/db/prisma';
import storage from '@/lib/storage';
import { generatePersonaVisual } from '@/lib/persona/visual';
import { setImageProvider, ImageProvider } from '@/lib/ai/image-provider';
import { VisualGenerationError, VisualModelOptions } from '@/lib/persona/visual-types';
import sharp from 'sharp';
import * as safetyModule from '@/lib/safety/pipeline';
import * as consistencyModule from '@/lib/persona/consistency';

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

describe('Phase D: Synthesize 5 Perspectives from Locked Face Card', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.usageLedger, 'create').mockResolvedValue({} as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Front view is NEVER regenerated; returns locked face card asset directly', async () => {
    const fakeLockedAsset = {
      id: 'asset_locked_face_123',
      personaId: 'persona_1',
      url: 'https://cdn.example.com/personas/persona_1/locked_face.jpg',
      storageKey: 'personas/persona_1/locked_face.jpg',
      type: 'image',
      kind: 'face_locked',
      aiGenerated: true,
      createdAt: new Date(),
    };

    const fakePersona = {
      id: 'persona_1',
      name: 'Ananya',
      adultAge: 23,
      faceStatus: 'locked',
      faceAssetId: 'asset_locked_face_123',
      avatarUrl: fakeLockedAsset.url,
      culturalHeritage: 'south_indian',
    };

    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue(fakePersona as never);
    vi.spyOn(prisma.asset, 'findUnique').mockResolvedValue(fakeLockedAsset as never);
    vi.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);

    const mockProvider: ImageProvider = {
      name: 'mock',
      capabilities: { referenceImage: true, maxReferences: 3 },
      isAvailable: async () => true,
      generateImage: vi.fn(),
    };
    setImageProvider(mockProvider);

    const options: VisualModelOptions = {
      ethnicity: 'south_indian',
      styleLook: 'minimal_studio',
      bodyStructure: 'hourglass',
      shotType: 'portrait',
      cameraAngle: 'front',
      isFaceLocked: true,
      lockedFaceUrl: fakeLockedAsset.url,
    };

    const result = await generatePersonaVisual({
      personaId: 'persona_1',
      options,
      personaName: 'Ananya',
      adultAge: 23,
    });

    // Provider generateImage must NOT have been called!
    expect(mockProvider.generateImage).not.toHaveBeenCalled();
    expect(result.imageUrl).toBe(fakeLockedAsset.url);
    expect(result.asset?.id).toBe(fakeLockedAsset.id);
    expect(result.modelUsed).toBe('locked-face-reference');
  });

  it('2. References are present in the provider call for perspective views (side, full_body, etc.)', async () => {
    const fakeLockedAsset = {
      id: 'asset_locked_face_123',
      personaId: 'persona_1',
      url: 'https://cdn.example.com/personas/persona_1/locked_face.jpg',
      storageKey: 'personas/persona_1/locked_face.jpg',
    };

    const fakePersona = {
      id: 'persona_1',
      name: 'Ananya',
      adultAge: 23,
      faceStatus: 'locked',
      faceAssetId: 'asset_locked_face_123',
      culturalHeritage: 'south_indian',
    };

    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue(fakePersona as never);
    vi.spyOn(prisma.asset, 'findUnique').mockResolvedValue(fakeLockedAsset as never);
    vi.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.asset, 'create').mockImplementation(async ({ data }: { data: unknown }) => ({
      id: 'asset_view_side_456',
      ...(data as Record<string, unknown>),
      createdAt: new Date(),
    } as never));
    vi.spyOn(storage, 'upload').mockResolvedValue({
      storageKey: 'personas/persona_1/visual_side.jpg',
      url: 'https://cdn.example.com/personas/persona_1/visual_side.jpg',
      bytes: 1024,
    });

    vi.spyOn(safetyModule, 'runSafetyGatePipeline').mockResolvedValue({
      passed: true,
      status: 'passed',
      reasons: [],
    } as never);

    vi.spyOn(consistencyModule, 'evaluateConsistency').mockResolvedValue({
      score: 88,
      passed: true,
      status: 'consistent',
      reasons: ['Strong facial match'],
      minThreshold: 75,
    });

    const testBuf = await createValidTestImageBuffer();
    const generateImageMock = vi.fn().mockResolvedValue({
      buffer: testBuf,
      mimeType: 'image/jpeg',
      provider: 'pollinations',
      model: 'flux.2-klein-4b',
      prompt: 'Side perspective',
      estimatedCost: 0,
      seed: 42,
    });

    const mockProvider: ImageProvider = {
      name: 'pollinations',
      capabilities: { referenceImage: true, maxReferences: 3 },
      isAvailable: async () => true,
      generateImage: generateImageMock,
    };
    setImageProvider(mockProvider);

    const refBuffer = await createValidTestImageBuffer(150, 150);
    const options: VisualModelOptions = {
      ethnicity: 'south_indian',
      styleLook: 'minimal_studio',
      bodyStructure: 'hourglass',
      shotType: 'portrait',
      cameraAngle: 'side',
      isFaceLocked: true,
      lockedFaceUrl: fakeLockedAsset.url,
    };

    const result = await generatePersonaVisual({
      personaId: 'persona_1',
      options,
      personaName: 'Ananya',
      adultAge: 23,
      referenceBuffers: [{ mimeType: 'image/jpeg', buffer: refBuffer }],
    });

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    const callArgs = generateImageMock.mock.calls[0][0];
    expect(callArgs.referenceImages).toBeDefined();
    expect(callArgs.referenceImages.length).toBe(1);
    expect(callArgs.referenceImages[0].buffer).toEqual(refBuffer);

    expect(result.asset).toBeDefined();
    expect(result.asset?.kind).toBe('view');
  });

  it('3. Non-reference provider produces PROVIDER_UNSUPPORTED (501)', async () => {
    const fakePersona = {
      id: 'persona_1',
      name: 'Ananya',
      adultAge: 23,
      faceStatus: 'locked',
      faceAssetId: 'asset_locked_face_123',
    };

    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue(fakePersona as never);

    const mockNonRefProvider: ImageProvider = {
      name: 'cloudflare',
      capabilities: { referenceImage: false, maxReferences: 0 },
      isAvailable: async () => true,
      generateImage: vi.fn(),
    };
    setImageProvider(mockNonRefProvider);

    const refBuffer = await createValidTestImageBuffer(150, 150);
    const options: VisualModelOptions = {
      ethnicity: 'south_indian',
      styleLook: 'minimal_studio',
      bodyStructure: 'hourglass',
      shotType: 'portrait',
      cameraAngle: 'side',
      isFaceLocked: true,
    };

    await expect(
      generatePersonaVisual({
        personaId: 'persona_1',
        options,
        personaName: 'Ananya',
        adultAge: 23,
        referenceBuffers: [{ mimeType: 'image/jpeg', buffer: refBuffer }],
      })
    ).rejects.toThrow(VisualGenerationError);

    try {
      await generatePersonaVisual({
        personaId: 'persona_1',
        options,
        personaName: 'Ananya',
        adultAge: 23,
        referenceBuffers: [{ mimeType: 'image/jpeg', buffer: refBuffer }],
      });
    } catch (err: unknown) {
      const e = err as VisualGenerationError;
      expect(e).toBeInstanceOf(VisualGenerationError);
      expect(e.code).toBe('PROVIDER_UNSUPPORTED');
      expect(e.statusCode).toBe(501);
    }
  });

  it('4. Low consistency score marks needs_manual_review and drifted — regenerate', async () => {
    const fakeLockedAsset = {
      id: 'asset_locked_face_123',
      personaId: 'persona_1',
      url: 'https://cdn.example.com/personas/persona_1/locked_face.jpg',
      storageKey: 'personas/persona_1/locked_face.jpg',
    };

    const fakePersona = {
      id: 'persona_1',
      name: 'Ananya',
      adultAge: 23,
      faceStatus: 'locked',
      faceAssetId: 'asset_locked_face_123',
    };

    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue(fakePersona as never);
    vi.spyOn(prisma.asset, 'findUnique').mockResolvedValue(fakeLockedAsset as never);
    vi.spyOn(prisma.asset, 'findMany').mockResolvedValue([]);

    let savedAssetData: Record<string, unknown> | null = null;
    vi.spyOn(prisma.asset, 'create').mockImplementation(async ({ data }: { data: unknown }) => {
      savedAssetData = data as Record<string, unknown>;
      return {
        id: 'asset_drifted_view',
        ...(data as Record<string, unknown>),
        createdAt: new Date(),
      } as never;
    });
    vi.spyOn(storage, 'upload').mockResolvedValue({
      storageKey: 'personas/persona_1/visual_drifted.jpg',
      url: 'https://cdn.example.com/personas/persona_1/visual_drifted.jpg',
      bytes: 1024,
    });

    vi.spyOn(safetyModule, 'runSafetyGatePipeline').mockResolvedValue({
      passed: true,
      status: 'passed',
      reasons: [],
    } as never);

    // Consistency score is low (below 75 threshold) on attempt 1 and auto-retry
    vi.spyOn(consistencyModule, 'evaluateConsistency').mockResolvedValue({
      score: 52,
      passed: false,
      status: 'drifted — regenerate',
      reasons: ['Facial structure variance exceeded tolerance'],
      minThreshold: 75,
    });

    const testBuf = await createValidTestImageBuffer();
    const generateImageMock = vi.fn().mockResolvedValue({
      buffer: testBuf,
      mimeType: 'image/jpeg',
      provider: 'pollinations',
      model: 'kontext',
      prompt: 'Full body perspective',
      estimatedCost: 0,
      seed: 99,
    });

    const mockProvider: ImageProvider = {
      name: 'pollinations',
      capabilities: { referenceImage: true, maxReferences: 3 },
      isAvailable: async () => true,
      generateImage: generateImageMock,
    };
    setImageProvider(mockProvider);

    const refBuffer = await createValidTestImageBuffer(150, 150);
    const options: VisualModelOptions = {
      ethnicity: 'south_indian',
      styleLook: 'minimal_studio',
      bodyStructure: 'hourglass',
      shotType: 'full_body',
      cameraAngle: 'full_body',
      isFaceLocked: true,
      lockedFaceUrl: fakeLockedAsset.url,
    };

    await generatePersonaVisual({
      personaId: 'persona_1',
      options,
      personaName: 'Ananya',
      adultAge: 23,
      referenceBuffers: [{ mimeType: 'image/jpeg', buffer: refBuffer }],
    });

    // Auto-retry should have been attempted once (total 2 generateImage calls)
    expect(generateImageMock).toHaveBeenCalledTimes(2);

    expect(savedAssetData).toBeDefined();
    expect(savedAssetData.kind).toBe('view');
    expect(savedAssetData.parentAssetId).toBe('asset_locked_face_123');
    expect(savedAssetData.safetyStatus).toBe('needs_manual_review');

    const meta = JSON.parse(savedAssetData.provenanceMeta);
    expect(meta.consistency.status).toBe('drifted — regenerate');
    expect(meta.consistency.passed).toBe(false);
  });
});
