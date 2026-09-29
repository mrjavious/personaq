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

/**
 * Scheduling Queue Worker Tick
 * Scans for due scheduled posts (scheduledAt <= now, publishedAt is null)
 * and dispatches them through their respective platform publishing adapters.
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
    try {
      await publishVariant(variant.id, 'scheduler_worker');
      tickResult.succeeded += 1;
      tickResult.results.push({
        variantId: variant.id,
        platform: variant.platformAccount.platform,
        success: true,
      });
    } catch (error) {
      tickResult.failed += 1;
      tickResult.results.push({
        variantId: variant.id,
        platform: variant.platformAccount.platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return tickResult;
}
