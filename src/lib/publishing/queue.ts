import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { publishVariant } from './index';
import { logger } from '@/lib/logging';

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue definition
export const publishQueue = new Queue('publishing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
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

// Worker process
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
      jobId: `publish-${variantId}`, // Idempotency: same variant won't be queued twice
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
