import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { createPostWithVariants } from '@/lib/composer/service';

describe('Post Composer & Guardrail Constraints', () => {
  let personaId: string;
  let instagramAccountId: string;
  let fanvueAccountId: string;
  let sfwAssetId: string;
  let adultAssetId: string;
  let pendingAssetId: string;

  beforeAll(async () => {
    // Fetch or create persona
    let persona = await prisma.persona.findFirst();
    if (!persona) {
      persona = await prisma.persona.create({
        data: {
          name: 'Aria Nova',
          adultAge: 25,
          backstory: 'A fictional AI artist.',
          appearanceNotes: 'Digital aesthetic.',
          voiceTone: 'Friendly and creative.',
          aiDisclosureText: 'AI persona',
          contentPillars: JSON.stringify(['Tech']),
          catchphrases: JSON.stringify(['Hello']),
        },
      });
    }
    personaId = persona.id;

    // Fetch or create accounts
    let igAcc = await prisma.platformAccount.findFirst({
      where: { personaId, platform: 'instagram' },
    });
    if (!igAcc) {
      igAcc = await prisma.platformAccount.create({
        data: { personaId, platform: 'instagram', handle: '@aria_ig_test', apiStatus: 'active' },
      });
    }
    instagramAccountId = igAcc.id;

    let fvAcc = await prisma.platformAccount.findFirst({
      where: { personaId, platform: 'fanvue' },
    });
    if (!fvAcc) {
      fvAcc = await prisma.platformAccount.create({
        data: { personaId, platform: 'fanvue', handle: '@aria_fv_test', apiStatus: 'active' },
      });
    }
    fanvueAccountId = fvAcc.id;

    // Create test assets
    const sfwAsset = await prisma.asset.create({
      data: {
        personaId,
        storageKey: 'test/sfw.jpg',
        suitability: 'sfw_safe',
        safetyStatus: 'passed',
      },
    });
    sfwAssetId = sfwAsset.id;

    const adultAsset = await prisma.asset.create({
      data: {
        personaId,
        storageKey: 'test/adult.jpg',
        suitability: 'adult_only',
        safetyStatus: 'passed',
      },
    });
    adultAssetId = adultAsset.id;

    const pendingAsset = await prisma.asset.create({
      data: {
        personaId,
        storageKey: 'test/pending.jpg',
        suitability: 'sfw_safe',
        safetyStatus: 'pending',
      },
    });
    pendingAssetId = pendingAsset.id;
  });

  afterAll(async () => {
    // Cleanup test assets
    await prisma.asset.deleteMany({
      where: { id: { in: [sfwAssetId, adultAssetId, pendingAssetId] } },
    });
  });

  it('CRITICAL GUARDRAIL 4: should reject attaching adult_only asset to Instagram', async () => {
    await expect(
      createPostWithVariants({
        personaId,
        concept: 'Adult content test',
        status: 'draft',
        variants: [
          {
            platformAccountId: instagramAccountId,
            platform: 'instagram',
            assetId: adultAssetId,
            caption: 'Test post',
            hashtags: ['#test'],
            aiLabelApplied: true,
          },
        ],
      })
    ).rejects.toThrow(/CRITICAL GUARDRAIL VIOLATION: 'adult_only' asset cannot be scheduled/);
  });

  it('should permit adult_only asset on Fanvue (18+ monetization)', async () => {
    const post = await createPostWithVariants({
      personaId,
      concept: 'Fanvue exclusive set',
      status: 'draft',
      variants: [
        {
          platformAccountId: fanvueAccountId,
          platform: 'fanvue',
          assetId: adultAssetId,
          caption: 'Fanvue exclusive digital art',
          hashtags: ['#exclusive'],
          aiLabelApplied: true,
        },
      ],
    });

    expect(post.id).toBeDefined();
    expect(post.variants).toHaveLength(1);

    // Cleanup post
    await prisma.post.delete({ where: { id: post.id } });
  });

  it('CRITICAL GUARDRAIL 5.3: should reject scheduling an asset whose safetyStatus is pending', async () => {
    await expect(
      createPostWithVariants({
        personaId,
        concept: 'Pending safety scheduling test',
        status: 'scheduled',
        variants: [
          {
            platformAccountId: instagramAccountId,
            platform: 'instagram',
            assetId: pendingAssetId,
            caption: 'Test caption',
            hashtags: [],
            aiLabelApplied: true,
          },
        ],
      })
    ).rejects.toThrow(/Safety gate status is 'pending'/);
  });

  it('should successfully create and schedule a compliant SFW post', async () => {
    const post = await createPostWithVariants({
      personaId,
      concept: 'Compliant neon portrait',
      status: 'scheduled',
      variants: [
        {
          platformAccountId: instagramAccountId,
          platform: 'instagram',
          assetId: sfwAssetId,
          caption: 'Compliant caption with #AI disclosure',
          hashtags: ['#Art'],
          aiLabelApplied: true,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
    });

    expect(post.id).toBeDefined();
    expect(post.status).toBe('scheduled');

    // Cleanup post
    await prisma.post.delete({ where: { id: post.id } });
  });
});
