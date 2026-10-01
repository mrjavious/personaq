import prisma from '@/lib/db/prisma';
import { PublishAdapter, PublishResult } from './types';
import { InstagramAdapter } from './adapters/instagram';
import { XAdapter } from './adapters/x';
import { ThreadsAdapter } from './adapters/threads';
import { ManualAssistAdapter } from './adapters/manual-assist';
import { validateAssetForScheduling, validatePostVariantSuitability } from '@/lib/guardrails/rules';
import { logAuditEvent } from '@/lib/audit/logger';

const adapters: Record<string, PublishAdapter> = {
  instagram: new InstagramAdapter(),
  x: new XAdapter(),
  threads: new ThreadsAdapter(),
  tiktok: new ManualAssistAdapter('tiktok'),
  fanvue: new ManualAssistAdapter('fanvue'),
};

export function getPublishAdapter(platform: string): PublishAdapter {
  const normalized = platform.toLowerCase();
  return adapters[normalized] || new ManualAssistAdapter(normalized);
}

/**
 * Publishes a specific PostVariant through its platform adapter.
 * Strictly verifies Section 2 Guardrail 4 & Safety Gate clearance before dispatch.
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

  // Idempotency check: skip if already published
  if (variant.publishedAt && variant.externalId) {
    return {
      externalId: variant.externalId,
      publishedAt: variant.publishedAt,
      status: 'published',
    };
  }

  const platform = variant.platformAccount.platform;
  const adapter = getPublishAdapter(platform);

  // 1. Guardrail 4 Suitability Verification
  if (variant.asset) {
    const suitabilityCheck = validatePostVariantSuitability(platform, variant.asset.suitability);
    if (!suitabilityCheck.valid) {
      throw new Error(suitabilityCheck.errors[0]);
    }

    // 2. Safety Gate Clearance Verification
    const safetyCheck = validateAssetForScheduling({
      safetyStatus: variant.asset.safetyStatus,
      suitability: variant.asset.suitability,
      targetPlatform: platform,
    });
    if (!safetyCheck.valid) {
      throw new Error(safetyCheck.errors[0]);
    }
  }

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
    });

    // Update variant record and post status atomically
    const [, remainingUnpublished] = await prisma.$transaction([
      prisma.postVariant.update({
        where: { id: variant.id },
        data: {
          publishedAt: result.publishedAt,
          externalId: result.externalId,
        },
      }),
      prisma.postVariant.count({
        where: {
          postId: variant.postId,
          publishedAt: null,
        },
      }),
    ]);

    if (remainingUnpublished === 0) {
      await prisma.post.update({
        where: { id: variant.postId },
        data: { status: 'published' },
      });
    }

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
      },
    });

    return result;
  } catch (error) {
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
      },
    });

    // Mark post as failed if publishing errors out
    await prisma.post.update({
      where: { id: variant.postId },
      data: { status: 'failed' },
    });

    throw error;
  }
}
