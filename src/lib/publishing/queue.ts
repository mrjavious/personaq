import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { publishVariant } from './index';
import { isNonRetryableError } from './types';
import { logger } from '@/lib/logging';

let redisConnection: IORedis | null = null;
let queueInstance: Queue | null = null;
let workerInstance: Worker<PublishJobData> | null = null;

/**
 * Lazy connection getter: establishes IORedis connection only when requested.
 */
export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

/**
 * Calculates exponential backoff with randomized jitter to prevent thundering herd.
 */
export function calculateBackoffWithJitter(attempt: number, baseDelay = 3000, maxDelay = 60000): number {
  const exp = Math.min(attempt, 6);
  const base = baseDelay * Math.pow(2, exp - 1);
  const jitter = Math.floor(Math.random() * 1500);
  return Math.min(base + jitter, maxDelay);
}

// Job data types
export interface PublishJobData {
  variantId: string;
  userId?: string;
}

/**
 * Lazy queue getter: instantiates Queue only when requested.
 */
export function getPublishQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue('publishing', {
      connection: getRedisConnection(),
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
  }
  return queueInstance;
}

/**
 * Explicit worker initialization function.
 * Ensures no Worker process or IORedis listener is created at module import time.
 */
export function initPublishWorker(): Worker<PublishJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  const conn = getRedisConnection();
  workerInstance = new Worker<PublishJobData>(
    'publishing',
    async (job: Job<PublishJobData>) => {
      logger.info(`Processing publish job ${job.id}`, { variantId: job.data.variantId });

      const result = await publishVariant(job.data.variantId, job.data.userId);

      logger.info(`Publish job ${job.id} completed`, { variantId: job.data.variantId });
      return result;
    },
    {
      connection: conn,
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

  workerInstance.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`, { variantId: job.data.variantId });
  });

  workerInstance.on('failed', (job, error) => {
    logger.error(`Job ${job?.id} failed`, {
      variantId: job?.data.variantId,
      error: error.message,
    });
  });

  workerInstance.on('error', (error) => {
    logger.error('Publish worker error', { error: error.message });
  });

  return workerInstance;
}

export function getPublishWorker(): Worker<PublishJobData> | null {
  return workerInstance;
}

export function isWorkerInitialized(): boolean {
  return workerInstance !== null;
}

// Transparent lazy Proxy for backward-compatibility with code importing `publishQueue` directly
export const publishQueue = new Proxy({} as Queue, {
  get(_target, prop) {
    const queue = getPublishQueue();
    const val = (queue as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(queue) : val;
  },
});

// Helper to enqueue a publish job
export async function enqueuePublish(variantId: string, userId?: string): Promise<Job> {
  return getPublishQueue().add(
    'publish',
    { variantId, userId },
    {
      jobId: `publish-${variantId}`, // Strict Idempotency: same variant cannot be queued twice
    },
  );
}

// Helper to get queue status
export async function getQueueStatus() {
  const queue = getPublishQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// Graceful shutdown
export async function closeQueue(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
  if (redisConnection) {
    redisConnection.disconnect();
    redisConnection = null;
  }
}
