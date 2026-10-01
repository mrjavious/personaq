import prisma from '@/lib/db/prisma';
import { publishVariant } from './index';

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
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000]; // 5s, 15s, 60s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scheduling Queue Worker Tick
 * Scans for due scheduled posts (scheduledAt <= now, publishedAt is null)
 * and dispatches them through their respective platform publishing adapters.
 * Includes retry logic with exponential backoff for transient failures.
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
    take: 10, // process in batches of 10
  });

  const tickResult: WorkerTickResult = {
    processed: dueVariants.length,
    succeeded: 0,
    failed: 0,
    results: [],
  };

  for (const variant of dueVariants) {
    let success = false;
    let lastError: string | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await publishVariant(variant.id, 'scheduler_worker');
        success = true;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        // Don't retry on guardrail/safety errors (permanent failures)
        if (
          lastError.includes('Guardrail') ||
          lastError.includes('Safety') ||
          lastError.includes('not found')
        ) {
          break;
        }

        // Wait before retrying (except on last attempt)
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS_MS[attempt]);
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

  return tickResult;
}
