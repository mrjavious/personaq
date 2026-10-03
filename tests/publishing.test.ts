import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/db/prisma';
import { getPublishAdapter, publishVariant, reconcilePostStatus, generatePublishIdempotencyKey } from '@/lib/publishing';
import { runSchedulerWorkerTick } from '@/lib/publishing/worker';
import { isNonRetryableError, PublishingError } from '@/lib/publishing/types';
import { calculateBackoffWithJitter } from '@/lib/publishing/queue';

describe('Publishing Adapters & Queue Worker', () => {
  let personaId: string;
  let instagramAccountId: string;
  let xAccountId: string;
  let threadsAccountId: string;
  let tiktokAccountId: string;
  let fanvueAccountId: string;
  let sfwAssetId: string;
  let adultAssetId: string;

  beforeAll(async () => {
    let persona = await prisma.persona.findFirst();
    if (!persona) {
      persona = await prisma.persona.create({
        data: {
          name: 'Publishing Persona',
          adultAge: 25,
          aiDisclosureText: 'AI Persona',
          contentPillars: JSON.stringify(['Tech']),
          catchphrases: JSON.stringify(['Test']),
        },
      });
    }
    personaId = persona.id;

    let ig = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'instagram' } });
    if (!ig) {
      ig = await prisma.platformAccount.create({
        data: { personaId, platform: 'instagram', handle: '@aria_pub_ig', apiStatus: 'active' },
      });
    }
    instagramAccountId = ig.id;

    let x = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'x' } });
    if (!x) {
      x = await prisma.platformAccount.create({
        data: { personaId, platform: 'x', handle: '@aria_pub_x', apiStatus: 'active' },
      });
    }
    xAccountId = x.id;

    let thr = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'threads' } });
    if (!thr) {
      thr = await prisma.platformAccount.create({
        data: { personaId, platform: 'threads', handle: '@aria_pub_thr', apiStatus: 'active' },
      });
    }
    threadsAccountId = thr.id;

    let tt = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'tiktok' } });
    if (!tt) {
      tt = await prisma.platformAccount.create({
        data: { personaId, platform: 'tiktok', handle: '@aria_pub_tt', apiStatus: 'active' },
      });
    }
    tiktokAccountId = tt.id;

    let fv = await prisma.platformAccount.findFirst({ where: { personaId, platform: 'fanvue' } });
    if (!fv) {
      fv = await prisma.platformAccount.create({
        data: {
          personaId,
          platform: 'fanvue',
          handle: '@aria_fanvue_test',
          apiStatus: 'active',
        },
      });
    }
    fanvueAccountId = fv.id;

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
    await prisma.platformAccount.deleteMany({
      where: { handle: '@aria_fanvue_test' },
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

    it('Fanvue Adapter: should publish adult_only variant compliant with Section 2 Guardrail 4', async () => {
      const adapter = getPublishAdapter('fanvue');
      expect(adapter.platform).toBe('fanvue');

      const res = await adapter.publish({
        id: 'test_var_fv',
        postId: 'test_p_fv',
        caption: 'Exclusive adult creator post',
        hashtags: ['#exclusive'],
        aiLabelApplied: true,
        asset: {
          id: adultAssetId,
          storageKey: 'test/pub_adult.jpg',
          suitability: 'adult_only',
          safetyStatus: 'passed',
        },
        platformAccount: {
          id: fanvueAccountId,
          platform: 'fanvue',
          handle: '@aria_fanvue_test',
          apiStatus: 'active',
        },
      });

      expect(res.status).toBe('published');
      expect(res.externalId).toContain('fanvue');
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

  describe('Publishing Idempotency & Locking', () => {
    it('should return identical externalId and skip re-publishing on subsequent calls', async () => {
      const post = await prisma.post.create({
        data: {
          personaId,
          concept: 'Idempotency unit test',
          status: 'approved',
          variants: {
            create: {
              platformAccountId: xAccountId,
              assetId: sfwAssetId,
              caption: 'Idempotent post test',
              hashtags: '["#idempotency"]',
              aiLabelApplied: true,
            },
          },
        },
        include: { variants: true },
      });

      const variant = post.variants[0];

      // First publish call
      const firstResult = await publishVariant(variant.id, 'operator_1');
      expect(firstResult.status).toBe('published');
      expect(firstResult.externalId).toBeDefined();

      // Second publish call (should be idempotent)
      const secondResult = await publishVariant(variant.id, 'operator_2');
      expect(secondResult.status).toBe('published');
      expect(secondResult.externalId).toBe(firstResult.externalId);
      expect(new Date(secondResult.publishedAt).getTime()).toBe(new Date(firstResult.publishedAt).getTime());

      // Cleanup
      await prisma.postVariant.deleteMany({ where: { postId: post.id } });
      await prisma.post.delete({ where: { id: post.id } });
    });

    it('generates consistent deterministic idempotency keys', () => {
      const key1 = generatePublishIdempotencyKey({
        id: 'var_1',
        postId: 'post_1',
        platformAccountId: 'acc_1',
        caption: 'Hello World',
      });
      const key2 = generatePublishIdempotencyKey({
        id: 'var_1',
        postId: 'post_1',
        platformAccountId: 'acc_1',
        caption: 'Hello World',
      });
      const keyDifferent = generatePublishIdempotencyKey({
        id: 'var_1',
        postId: 'post_1',
        platformAccountId: 'acc_1',
        caption: 'Different Caption',
      });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(keyDifferent);
      expect(key1).toHaveLength(64); // SHA-256 hex string
    });
  });

  describe('Error Categorization & Jittered Backoff', () => {
    it('isNonRetryableError returns true for permanent errors and false for transient errors', () => {
      // Permanent errors
      expect(isNonRetryableError(new Error('Guardrail 4 violation'))).toBe(true);
      expect(isNonRetryableError(new Error('Asset did not pass safety gate'))).toBe(true);
      expect(isNonRetryableError(new Error('X post exceeds strict 280 character limit'))).toBe(true);
      expect(isNonRetryableError(new Error('Variant not found: var_123'))).toBe(true);
      expect(isNonRetryableError(new PublishingError('Client error (400)', 'x', false, 400))).toBe(true);

      // Transient errors
      expect(isNonRetryableError(new PublishingError('Server error (500)', 'x', true, 500))).toBe(false);
      expect(isNonRetryableError(new PublishingError('Rate limit exceeded', 'x', true, 429, 5000))).toBe(false);
      expect(isNonRetryableError(new Error('fetch failed: ECONNRESET'))).toBe(false);
    });

    it('calculateBackoffWithJitter calculates exponential delays with random jitter', () => {
      const delay1 = calculateBackoffWithJitter(1, 3000, 60000);
      const delay2 = calculateBackoffWithJitter(2, 3000, 60000);
      const delay3 = calculateBackoffWithJitter(3, 3000, 60000);

      // Attempt 1: base 3000 + jitter (0-1500) -> 3000-4500
      expect(delay1).toBeGreaterThanOrEqual(3000);
      expect(delay1).toBeLessThanOrEqual(4500);

      // Attempt 2: base 6000 + jitter (0-1500) -> 6000-7500
      expect(delay2).toBeGreaterThanOrEqual(6000);
      expect(delay2).toBeLessThanOrEqual(7500);

      // Attempt 3: base 12000 + jitter (0-1500) -> 12000-13500
      expect(delay3).toBeGreaterThanOrEqual(12000);
      expect(delay3).toBeLessThanOrEqual(13500);
    });
  });

  describe('Post Status Reconciliation', () => {
    it('reconciles status from approved to published when all variants are published', async () => {
      const post = await prisma.post.create({
        data: {
          personaId,
          concept: 'Status reconciliation test',
          status: 'approved',
          variants: {
            create: [
              {
                platformAccountId: instagramAccountId,
                caption: 'Reconciliation post 1',
                publishedAt: new Date(),
                externalId: 'ext_rec_1',
              },
              {
                platformAccountId: xAccountId,
                caption: 'Reconciliation post 2',
                publishedAt: new Date(),
                externalId: 'ext_rec_2',
              },
            ],
          },
        },
      });

      const result = await reconcilePostStatus(post.id);
      expect(result.newStatus).toBe('published');
      expect(result.changed).toBe(true);

      const inDb = await prisma.post.findUnique({ where: { id: post.id } });
      expect(inDb?.status).toBe('published');

      // Cleanup
      await prisma.postVariant.deleteMany({ where: { postId: post.id } });
      await prisma.post.delete({ where: { id: post.id } });
    });

    it('reconciles status to failed when an asset is blocked by safety', async () => {
      const blockedAsset = await prisma.asset.create({
        data: {
          personaId,
          storageKey: 'test/pub_blocked.jpg',
          suitability: 'sfw_safe',
          safetyStatus: 'blocked',
        },
      });

      const post = await prisma.post.create({
        data: {
          personaId,
          concept: 'Blocked safety test',
          status: 'pending_safety',
          variants: {
            create: {
              platformAccountId: instagramAccountId,
              assetId: blockedAsset.id,
              caption: 'Blocked post test',
            },
          },
        },
      });

      const result = await reconcilePostStatus(post.id);
      expect(result.newStatus).toBe('failed');

      // Cleanup
      await prisma.postVariant.deleteMany({ where: { postId: post.id } });
      await prisma.post.delete({ where: { id: post.id } });
      await prisma.asset.delete({ where: { id: blockedAsset.id } });
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
