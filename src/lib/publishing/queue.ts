import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { publishVariant } from './index';
import { isNonRetryableError } from './types';
import { logger } from '@/lib/logging';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

/**
 * Calculates exponential backoff with randomized jitter to prevent thundering herd.
 */
export function calculateBackoffWithJitter(attempt: number, baseDelay = 3000, maxDelay = 60000): number {
  const exp = Math.min(attempt, 6);
  const base = baseDelay * Math.pow(2, exp - 1);
  const jitter = Math.floor(Math.random() * 1500);
  return Math.min(base + jitter, maxDelay);
}

// Queue definition with exponential jitter backoff
export const publishQueue = new Queue('publishing', {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: 'exponentialJitter',
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Job data types
export interface PublishJobData {
  variantId: string;
  userId?: string;
}

// Worker process with custom backoff strategy and rate limiter
export const publishWorker = new Worker<PublishJobData>(
  'publishing',
  async (job: Job<PublishJobData>) => {
    logger.info(`Processing publish job ${job.id}`, { variantId: job.data.variantId });

    const result = await publishVariant(job.data.variantId, job.data.userId);

    logger.info(`Publish job ${job.id} completed`, { variantId: job.data.variantId });
    return result;
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    settings: {
      backoffStrategy: (attemptsMade: number, _type?: string, err?: Error) => {
        if (err && isNonRetryableError(err)) {
          return -1; // Abort retries for permanent errors
        }
        return calculateBackoffWithJitter(attemptsMade);
      },
    },
  },
);

// Event handlers
publishWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`, { variantId: job.data.variantId });
});

publishWorker.on('failed', (job, error) => {
  logger.error(`Job ${job?.id} failed`, {
    variantId: job?.data.variantId,
    error: error.message,
  });
});

publishWorker.on('error', (error) => {
  logger.error('Publish worker error', { error: error.message });
});

// Helper to enqueue a publish job
export async function enqueuePublish(variantId: string, userId?: string): Promise<Job> {
  return publishQueue.add(
    'publish',
    { variantId, userId },
    {
      jobId: `publish-${variantId}`, // Strict Idempotency: same variant cannot be queued twice
    },
  );
}

// Helper to get queue status
export async function getQueueStatus() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    publishQueue.getWaitingCount(),
    publishQueue.getActiveCount(),
    publishQueue.getCompletedCount(),
    publishQueue.getFailedCount(),
    publishQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  await publishWorker.close();
  await publishQueue.close();
  connection.disconnect();
}
