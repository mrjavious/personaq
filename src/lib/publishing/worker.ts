import prisma from '@/lib/db/prisma';
import { publishVariant, reconcilePostStatus } from './index';
import { isNonRetryableError, PublishingError } from './types';
import { calculateBackoffWithJitter } from './queue';

export interface WorkerTickResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    variantId: string;
    platform: string;
    success: boolean;
    error?: string;
  }>;
}

const MAX_RETRIES = 3;
const MAX_CONCURRENT_PER_ACCOUNT = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scheduling Queue Worker Tick
 * Scans for due scheduled posts (scheduledAt <= now, publishedAt is null)
 * and dispatches them through their respective platform publishing adapters.
 * Includes concurrency limiting per platform account, retry logic with exponential backoff + jitter,
 * and automated post status reconciliation.
 */
export async function runSchedulerWorkerTick(): Promise<WorkerTickResult> {
  const now = new Date();

  // Find due variants
  const dueVariants = await prisma.postVariant.findMany({
    where: {
      scheduledAt: {
        lte: now,
      },
      publishedAt: null,
      post: {
        status: { in: ['scheduled', 'approved'] },
      },
    },
    include: {
      platformAccount: true,
      asset: true,
    },
    take: 20, // process in batches of 20
  });

  const tickResult: WorkerTickResult = {
    processed: dueVariants.length,
    succeeded: 0,
    failed: 0,
    results: [],
  };

  // Group variants by platform account to prevent flooding a single account
  const accountDispatchCount = new Map<string, number>();
  const affectedPostIds = new Set<string>();

  for (const variant of dueVariants) {
    const accountId = variant.platformAccountId;
    const currentCount = accountDispatchCount.get(accountId) || 0;

    // Enforce per-account concurrency limit
    if (currentCount >= MAX_CONCURRENT_PER_ACCOUNT) {
      continue;
    }
    accountDispatchCount.set(accountId, currentCount + 1);
    affectedPostIds.add(variant.postId);

    let success = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await publishVariant(variant.id, 'scheduler_worker');
        success = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        // Check if error is permanent (non-retryable)
        if (isNonRetryableError(error)) {
          break;
        }

        // Wait before retrying (exponential backoff with jitter or Retry-After)
        if (attempt < MAX_RETRIES - 1) {
          let delayMs = calculateBackoffWithJitter(attempt + 1, 2000, 30000);
          if (error instanceof PublishingError && error.retryAfterMs) {
            delayMs = Math.max(delayMs, error.retryAfterMs);
          }
          await sleep(delayMs);
        }
      }
    }

    if (success) {
      tickResult.succeeded += 1;
      tickResult.results.push({
        variantId: variant.id,
        platform: variant.platformAccount.platform,
        success: true,
      });
    } else {
      tickResult.failed += 1;
      tickResult.results.push({
        variantId: variant.id,
        platform: variant.platformAccount.platform,
        success: false,
        error: lastError,
      });
    }
  }

  // Automated post status reconciliation for all affected posts
  for (const postId of affectedPostIds) {
    await reconcilePostStatus(postId, 'scheduler_worker').catch(() => {});
  }

  return tickResult;
}
