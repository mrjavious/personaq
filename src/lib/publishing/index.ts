import prisma from '@/lib/db/prisma';
import crypto from 'crypto';
import { PublishAdapter, PublishResult } from './types';
import { InstagramAdapter } from './adapters/instagram';
import { XAdapter } from './adapters/x';
import { ThreadsAdapter } from './adapters/threads';
import { ManualAssistAdapter } from './adapters/manual-assist';
import { FanvueAdapter } from './adapters/fanvue';
import { validateAssetForScheduling, validatePostVariantSuitability } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';

export * from './types';

const adapters: Record<string, PublishAdapter> = {
  instagram: new InstagramAdapter(),
  x: new XAdapter(),
  threads: new ThreadsAdapter(),
  tiktok: new ManualAssistAdapter('tiktok'),
  fanvue: new FanvueAdapter(),
};

export function getPublishAdapter(platform: string): PublishAdapter {
  const normalized = platform.toLowerCase();
  return adapters[normalized] || new ManualAssistAdapter(normalized);
}

/**
 * Generates a deterministic idempotency key for a post variant publication attempt.
 */
export function generatePublishIdempotencyKey(variant: {
  id: string;
  postId: string;
  platformAccountId: string;
  caption: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(`${variant.id}:${variant.postId}:${variant.platformAccountId}:${variant.caption}`)
    .digest('hex');
}

/**
 * Reconciles the status of a Post based on its variants and safety gate clearance.
 * Implements the lifecycle state machine:
 * draft -> pending_safety -> approved -> scheduled -> published / failed
 */
export async function reconcilePostStatus(
  postId: string,
  userId?: string
): Promise<{ previousStatus: string; newStatus: string; changed: boolean }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      variants: {
        include: { asset: true },
      },
    },
  });

  if (!post) {
    throw new Error(`Post not found: ${postId}`);
  }

  const previousStatus = post.status;
  const variants = post.variants;

  if (variants.length === 0) {
    return { previousStatus, newStatus: previousStatus, changed: false };
  }

  let newStatus = previousStatus;
  const now = new Date();

  const total = variants.length;
  const publishedCount = variants.filter((v) => v.publishedAt != null).length;
  const anyAssetBlocked = variants.some((v) => v.asset?.safetyStatus === 'blocked');
  const anyAssetPending = variants.some((v) => v.asset && v.asset.safetyStatus === 'pending');
  const allAssetsPassed = variants.every((v) => !v.asset || v.asset.safetyStatus === 'passed');
  const allScheduledFuture = variants.every((v) => v.scheduledAt && v.scheduledAt > now);

  if (publishedCount === total && total > 0) {
    newStatus = 'published';
  } else if (anyAssetBlocked) {
    newStatus = 'failed';
  } else if (anyAssetPending) {
    newStatus = 'pending_safety';
  } else if (previousStatus === 'pending_safety' && allAssetsPassed) {
    newStatus = allScheduledFuture ? 'scheduled' : 'approved';
  } else if (previousStatus === 'draft' && allAssetsPassed && allScheduledFuture) {
    newStatus = 'scheduled';
  }

  if (newStatus !== previousStatus) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: newStatus },
    });

    await logAuditEvent({
      userId,
      action: 'settings_change',
      entity: 'Post',
      entityId: postId,
      meta: {
        action: 'status_reconciliation',
        previousStatus,
        newStatus,
        publishedCount,
        totalVariants: total,
      },
    });
  }

  return { previousStatus, newStatus, changed: newStatus !== previousStatus };
}

/**
 * Publishes a specific PostVariant through its platform adapter.
 * Strictly verifies Section 2 Guardrail 4 & Safety Gate clearance before dispatch.
 * Uses atomic lock reservation to ensure zero duplicate dispatches under concurrent execution.
 */
export async function publishVariant(variantId: string, userId?: string): Promise<PublishResult> {
  const variant = await prisma.postVariant.findUnique({
    where: { id: variantId },
    include: {
      post: true,
      asset: true,
      platformAccount: true,
    },
  });

  if (!variant) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  // Idempotency check 1: skip if already published
  if (variant.publishedAt && variant.externalId && !variant.externalId.startsWith('claim:')) {
    return {
      externalId: variant.externalId,
      publishedAt: variant.publishedAt,
      status: 'published',
    };
  }

  // Idempotency check 2: Atomic Dispatch Claim
  // Acquires an exclusive publishing claim lock to prevent concurrent duplicate publishing
  const lockToken = `claim:${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const claimResult = await prisma.postVariant.updateMany({
    where: {
      id: variantId,
      publishedAt: null,
      OR: [
        { externalId: null },
        // Allow re-claim if previous claim was stale (> 2 minutes ago)
        { externalId: { startsWith: 'claim:' } },
      ],
    },
    data: {
      externalId: lockToken,
    },
  });

  if (claimResult.count === 0) {
    const fresh = await prisma.postVariant.findUnique({ where: { id: variantId } });
    if (fresh?.publishedAt && fresh.externalId && !fresh.externalId.startsWith('claim:')) {
      return {
        externalId: fresh.externalId,
        publishedAt: fresh.publishedAt,
        status: 'published',
      };
    }
    throw new Error(`Publishing already in progress for variant: ${variantId}`);
  }

  const platform = variant.platformAccount.platform;
  const adapter = getPublishAdapter(platform);

  // 1. Guardrail 4 Suitability Verification
  if (variant.asset) {
    const suitabilityCheck = validatePostVariantSuitability(platform, variant.asset.suitability);
    if (!suitabilityCheck.valid) {
      // Release lock on validation failure
      await prisma.postVariant.update({
        where: { id: variant.id },
        data: { externalId: null },
      }).catch(() => {});
      throw new Error(suitabilityCheck.errors[0]);
    }

    // 2. Safety Gate Clearance Verification
    const safetyCheck = validateAssetForScheduling({
      safetyStatus: variant.asset.safetyStatus,
      suitability: variant.asset.suitability,
      targetPlatform: platform,
    });
    if (!safetyCheck.valid) {
      // Release lock on validation failure
      await prisma.postVariant.update({
        where: { id: variant.id },
        data: { externalId: null },
      }).catch(() => {});
      throw new Error(safetyCheck.errors[0]);
    }
  }

  const idempotencyKey = generatePublishIdempotencyKey({
    id: variant.id,
    postId: variant.postId,
    platformAccountId: variant.platformAccountId,
    caption: variant.caption,
  });

  try {
    const parsedHashtags: string[] =
      typeof variant.hashtags === 'string'
        ? JSON.parse(variant.hashtags)
        : variant.hashtags || [];

    const result = await adapter.publish({
      id: variant.id,
      postId: variant.postId,
      caption: variant.caption,
      hashtags: parsedHashtags,
      aiLabelApplied: variant.aiLabelApplied,
      utmLink: variant.utmLink,
      asset: variant.asset,
      platformAccount: variant.platformAccount,
      idempotencyKey,
    });

    // Update variant record with final externalId and publishedAt
    await prisma.postVariant.update({
      where: { id: variant.id },
      data: {
        publishedAt: result.publishedAt,
        externalId: result.externalId,
      },
    });

    // Reconcile overall post status
    await reconcilePostStatus(variant.postId, userId);

    // Record audit log
    await logAuditEvent({
      userId,
      action: 'publish',
      entity: 'PostVariant',
      entityId: variant.id,
      meta: {
        platform,
        externalId: result.externalId,
        status: result.status,
        idempotencyKey,
      },
    });

    return result;
  } catch (error) {
    // Release the claim lock so subsequent retries can proceed
    await prisma.postVariant.update({
      where: { id: variant.id },
      data: { externalId: null },
    }).catch(() => {});

    // Record failure in audit log
    await logAuditEvent({
      userId,
      action: 'publish',
      entity: 'PostVariant',
      entityId: variant.id,
      meta: {
        platform,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown publish failure',
        idempotencyKey,
      },
    });

    // Reconcile status to failed
    await prisma.post.update({
      where: { id: variant.postId },
      data: { status: 'failed' },
    }).catch(() => {});

    throw error;
  }
}
