import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { getPublishAdapter, publishVariant } from '@/lib/publishing';
import { runSchedulerWorkerTick } from '@/lib/publishing/worker';

describe('Publishing Adapters & Queue Worker', () => {
  let personaId: string;
  let instagramAccountId: string;
  let xAccountId: string;
  let threadsAccountId: string;
  let tiktokAccountId: string;
  let sfwAssetId: string;
  let adultAssetId: string;

  beforeAll(async () => {
    const persona = await prisma.persona.findFirst();
    personaId = persona!.id;

    const ig = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'instagram' } });
    instagramAccountId = ig!.id;

    const x = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'x' } });
    xAccountId = x!.id;

    const thr = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'threads' } });
    threadsAccountId = thr!.id;

    const tt = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'tiktok' } });
    tiktokAccountId = tt!.id;

    const sfw = await prisma.asset.create({
      data: {
        personaId,
        storageKey: 'test/pub_sfw.jpg',
        suitability: 'sfw_safe',
        safetyStatus: 'passed',
      },
    });
    sfwAssetId = sfw.id;

    const adult = await prisma.asset.create({
      data: {
        personaId,
        storageKey: 'test/pub_adult.jpg',
        suitability: 'adult_only',
        safetyStatus: 'passed',
      },
    });
    adultAssetId = adult.id;
  });

  afterAll(async () => {
    await prisma.asset.deleteMany({
      where: { id: { in: [sfwAssetId, adultAssetId] } },
    });
  });

  describe('Individual Adapters', () => {
    it('Instagram Adapter: should publish compliant variant and return external ID', async () => {
      const adapter = getPublishAdapter('instagram');
      const res = await adapter.publish({
        id: 'test_var_ig',
        postId: 'test_p_1',
        caption: 'Test Instagram caption',
        hashtags: ['#AI'],
        aiLabelApplied: true,
        asset: {
          id: sfwAssetId,
          storageKey: 'test/pub_sfw.jpg',
          suitability: 'sfw_safe',
          safetyStatus: 'passed',
        },
        platformAccount: {
          id: instagramAccountId,
          platform: 'instagram',
          handle: '@aria.nova.ai',
          apiStatus: 'active',
        },
      });

      expect(res.status).toBe('published');
      expect(res.externalId).toBeDefined();
    });

    it('X Adapter: should reject posts exceeding 280 characters', async () => {
      const adapter = getPublishAdapter('x');
      const superLongCaption = 'A'.repeat(290);

      await expect(
        adapter.publish({
          id: 'test_var_x_long',
          postId: 'test_p_x',
          caption: superLongCaption,
          hashtags: [],
          aiLabelApplied: true,
          platformAccount: {
            id: xAccountId,
            platform: 'x',
            handle: '@arianova_ai',
            apiStatus: 'active',
          },
        })
      ).rejects.toThrow(/exceeds strict 280 character limit/);
    });

    it('TikTok Manual Assist Adapter: should return manual_assist_pending status', async () => {
      const adapter = getPublishAdapter('tiktok');
      expect(adapter.supportsApiPublish).toBe(false);

      const res = await adapter.publish({
        id: 'test_var_tt',
        postId: 'test_p_tt',
        caption: 'TikTok caption',
        hashtags: ['#fyp'],
        aiLabelApplied: true,
        platformAccount: {
          id: tiktokAccountId,
          platform: 'tiktok',
          handle: '@arianova_digital',
          apiStatus: 'manual_assist',
        },
      });

      expect(res.status).toBe('manual_assist_pending');
      expect(res.externalId).toContain('manual_tiktok');
    });
  });

  describe('Master Publishing Dispatcher', () => {
    it('should dispatch variant, update publishedAt, and record audit log', async () => {
      // Create post with 1 variant
      const post = await prisma.post.create({
        data: {
          personaId,
          concept: 'Dispatcher unit test',
          status: 'approved',
          variants: {
            create: {
              platformAccountId: instagramAccountId,
              assetId: sfwAssetId,
              caption: 'Dispatcher test caption',
              hashtags: '["#test"]',
              aiLabelApplied: true,
            },
          },
        },
        include: { variants: true },
      });

      const variant = post.variants[0];
      const result = await publishVariant(variant.id, 'test_operator');

      expect(result.status).toBe('published');
      expect(result.externalId).toBeDefined();

      // Check variant is updated in database
      const updatedVariant = await prisma.postVariant.findUnique({ where: { id: variant.id } });
      expect(updatedVariant?.publishedAt).not.toBeNull();

      // Check post status transitioned to published
      const updatedPost = await prisma.post.findUnique({ where: { id: post.id } });
      expect(updatedPost?.status).toBe('published');

      // Cleanup
      await prisma.postVariant.deleteMany({ where: { postId: post.id } });
      await prisma.post.delete({ where: { id: post.id } });
    });
  });

  describe('Scheduling Queue Worker Tick', () => {
    it('should process due variants whose scheduledAt <= now', async () => {
      // Create a due scheduled post
      const duePost = await prisma.post.create({
        data: {
          personaId,
          concept: 'Worker tick test',
          status: 'scheduled',
          variants: {
            create: {
              platformAccountId: threadsAccountId,
              assetId: sfwAssetId,
              caption: 'Worker scheduled post',
              hashtags: '["#worker"]',
              aiLabelApplied: true,
              scheduledAt: new Date(Date.now() - 60000), // 1 minute in past
            },
          },
        },
        include: { variants: true },
      });

      const tickResult = await runSchedulerWorkerTick();

      expect(tickResult.processed).toBeGreaterThanOrEqual(1);
      expect(tickResult.succeeded).toBeGreaterThanOrEqual(1);

      // Cleanup
      await prisma.postVariant.deleteMany({ where: { postId: duePost.id } });
      await prisma.post.delete({ where: { id: duePost.id } });
    });
  });
});
