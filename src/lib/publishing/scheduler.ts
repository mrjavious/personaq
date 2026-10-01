import { publishQueue } from './queue';
import { logger } from '@/lib/logging';

/**
 * Enqueues all due scheduled posts for publishing.
 * This function is designed to be called by a cron job or scheduled task.
 */
export async function schedulePendingPublishes(): Promise<{
  enqueued: number;
  errors: number;
}> {
  const now = new Date();

  // Find due variants
  const { prisma } = await import('@/lib/db');
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
    },
    take: 50,
  });

  let enqueued = 0;
  let errors = 0;

  for (const variant of dueVariants) {
    try {
      await publishQueue.add(
        'publish',
        { variantId: variant.id },
        {
          jobId: `publish-${variant.id}`,
          removeOnComplete: true,
        },
      );
      enqueued++;
    } catch (error) {
      // Job may already exist (idempotency)
      if (error instanceof Error && error.message.includes('already exists')) {
        // Already queued, skip
      } else {
        logger.error('Failed to enqueue publish job', {
          variantId: variant.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        errors++;
      }
    }
  }

  logger.info('Scheduled pending publishes', { enqueued, errors, total: dueVariants.length });
  return { enqueued, errors };
}
