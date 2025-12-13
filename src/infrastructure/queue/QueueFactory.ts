/**
 * Queue Factory Implementation
 *
 * Factory for creating typed BullMQ queues and workers with standardized
 * configuration, monitoring, and error handling.
 */

import { Queue, Worker, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

import { logger } from '../../shared/utils/logger.js';
import { redis } from '../cache/index.js';

import { QUEUE_CONFIGURATIONS, DEFAULT_QUEUE_OPTIONS, DEFAULT_WORKER_OPTIONS } from './config.js';
import {
  TypedQueue,
  TypedWorker,
  QueueFactoryOptions,
  QueueEventListener,
  QueueStats,
} from './types.js';

/**
 * Queue Factory for creating typed queues and workers
 *
 * Provides centralized queue creation with standardized configuration,
 * monitoring, event handling, and graceful shutdown capabilities.
 */
export class QueueFactory {
  private static instance: QueueFactory;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private eventListeners = new Map<string, QueueEventListener>();
  private wrappedQueues = new Map<string, TypedQueue<unknown>>();

  private constructor(private options: QueueFactoryOptions) {}

  /**
   * Get singleton instance of QueueFactory
   */
  public static getInstance(options?: QueueFactoryOptions): QueueFactory {
    if (!QueueFactory.instance) {
      if (!options) {
        throw new Error('QueueFactory options required for first initialization');
      }
      QueueFactory.instance = new QueueFactory(options);
    }
    return QueueFactory.instance;
  }

  /**
   * Create a typed queue with predefined configuration
   */
  public createQueue<T = Record<string, unknown>>(
    configKey: keyof typeof QUEUE_CONFIGURATIONS,
    customOptions?: Partial<QueueOptions>
  ): TypedQueue<T> {
    const config = QUEUE_CONFIGURATIONS[configKey];
    const queueName = config.name;

    if (this.queues.has(queueName)) {
      return this.wrappedQueues.get(queueName)! as TypedQueue<T>;
    }

    const queueOptions: QueueOptions = {
      connection: redis,
      ...DEFAULT_QUEUE_OPTIONS,
      defaultJobOptions: {
        ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
        attempts: config.maxRetries,
        removeOnComplete: config.removeOnComplete,
        removeOnFail: config.removeOnFail,
        backoff: {
          type: 'exponential',
          delay: config.backoffDelay,
        },
      },
      ...this.options.defaultOptions?.queue,
      ...customOptions,
    };

    const queue = new Queue(queueName, queueOptions);
    this.queues.set(queueName, queue);

    // Set up event listeners
    this.setupQueueEventListeners(queue);

    logger.info(`Created queue: ${queueName}`, {
      concurrency: config.concurrency,
      maxRetries: config.maxRetries,
      backoffDelay: config.backoffDelay,
    });

    const wrappedQueue = this.wrapQueue<T>(queue);
    this.wrappedQueues.set(queueName, wrappedQueue);

    return wrappedQueue;
  }

  /**
   * Create a typed worker with predefined configuration
   */
  public createWorker<T = Record<string, unknown>>(
    configKey: keyof typeof QUEUE_CONFIGURATIONS,
    processor: (job: { data: T }) => Promise<unknown>,
    customOptions?: Partial<WorkerOptions>
  ): TypedWorker<T> {
    const config = QUEUE_CONFIGURATIONS[configKey];
    const queueName = config.name;

    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue ${queueName} already exists`);
    }

    const workerOptions: WorkerOptions = {
      connection: redis,
      concurrency: config.concurrency,
      ...DEFAULT_WORKER_OPTIONS,
      ...this.options.defaultOptions?.worker,
      maxStalledCount: config.maxStalledCount,
      stalledInterval: config.stalledInterval,
      ...customOptions,
    };

    const worker = new Worker(queueName, processor, workerOptions);
    this.workers.set(queueName, worker);

    // Set up worker event listeners
    this.setupWorkerEventListeners(worker);

    logger.info(`Created worker: ${queueName}`, {
      concurrency: config.concurrency,
      stalledInterval: config.stalledInterval,
    });

    return this.wrapWorker<T>(worker);
  }

  /**
   * Register event listener for a queue
   */
  public registerEventListener(queueName: string, listener: QueueEventListener): void {
    this.eventListeners.set(queueName, listener);
    logger.info(`Registered event listener for queue: ${queueName}`);
  }

  /**
   * Get statistics for all queues
   */
  public async getAllQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];

    for (const [name, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
        ]);

        stats.push({
          name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused(),
        });
      } catch (error) {
        logger.error(`Failed to get stats for queue ${name}:`, error);
        stats.push({
          name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        });
      }
    }

    return stats;
  }

  /**
   * Retry failed jobs in a specific queue
   */
  public async retryFailedJobs(
    queueName: string,
    jobId?: string,
    _maxRetries?: number
  ): Promise<{ retriedCount: number }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    try {
      let retriedCount = 0;

      if (jobId) {
        // Retry specific job
        const job = await queue.getJob(jobId);
        if (job && await job.isFailed()) {
          await job.retry();
          retriedCount = 1;
          logger.info(`Retried job ${jobId} in queue ${queueName}`);
        }
      } else {
        // Retry all failed jobs
        const failedJobs = await queue.getFailed();
        for (const job of failedJobs) {
          try {
            await job.retry();
            retriedCount++;
          } catch (error) {
            logger.error(`Failed to retry job ${job.id}:`, error);
          }
        }
        logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
      }

      return { retriedCount };
    } catch (error) {
      logger.error(`Failed to retry jobs in queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Manage queue operations (pause, resume, clear, drain)
   */
  public async manageQueue(
    queueName: string,
    action: string,
    jobStatus?: string
  ): Promise<{ success: boolean; message: string }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    try {
      switch (action.toLowerCase()) {
        case 'pause':
          await queue.pause();
          logger.info(`Paused queue ${queueName}`);
          return { success: true, message: `Queue ${queueName} paused successfully` };

        case 'resume':
          await queue.resume();
          logger.info(`Resumed queue ${queueName}`);
          return { success: true, message: `Queue ${queueName} resumed successfully` };

        case 'clear':
          if (jobStatus) {
            // Clear specific job status - use valid BullMQ status types
            const validStatuses = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] as const;
            type ValidStatus = typeof validStatuses[number];
            
            const statusMap: Record<string, ValidStatus> = {
              waiting: 'waiting',
              active: 'active',
              completed: 'completed',
              failed: 'failed',
              delayed: 'delayed',
              paused: 'paused',
            };
            
            const status = statusMap[jobStatus.toLowerCase()];
            if (status) {
              await queue.clean(0, 0, status);
              logger.info(`Cleared ${jobStatus} jobs from queue ${queueName}`);
              return {
                success: true,
                message: `Cleared ${jobStatus} jobs from queue ${queueName}`,
              };
            } else {
              throw new Error(`Invalid job status: ${jobStatus}. Valid statuses: ${validStatuses.join(', ')}`);
            }
          } else {
            // Clear all jobs
            await Promise.all([
              queue.clean(0, 0, 'completed'),
              queue.clean(0, 0, 'failed'),
              queue.clean(0, 0, 'waiting'),
              queue.clean(0, 0, 'active'),
            ]);
            logger.info(`Cleared all jobs from queue ${queueName}`);
            return { success: true, message: `Cleared all jobs from queue ${queueName}` };
          }

        case 'drain':
          await queue.drain();
          logger.info(`Drained queue ${queueName}`);
          return { success: true, message: `Queue ${queueName} drained successfully` };

        default:
          throw new Error(`Invalid queue action: ${action}`);
      }
    } catch (error) {
      logger.error(`Failed to ${action} queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed job information
   */
  public async getJobDetails(queueName: string, jobId: string): Promise<Record<string, unknown>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job '${jobId}' not found in queue '${queueName}'`);
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as Record<string, unknown>,
      opts: job.opts,
      progress: job.progress,
      delay: job.delay,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue as Record<string, unknown>,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  public async shutdown(): Promise<void> {
    logger.info('Starting graceful shutdown of all queues and workers...');

    const shutdownPromises: Promise<void>[] = [];

    // Close all workers first
    for (const [name, worker] of this.workers) {
      shutdownPromises.push(
        worker.close().catch((error) => {
          logger.error(`Error closing worker ${name}:`, error);
        })
      );
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      shutdownPromises.push(
        queue.close().catch((error) => {
          logger.error(`Error closing queue ${name}:`, error);
        })
      );
    }

    await Promise.all(shutdownPromises);

    this.queues.clear();
    this.workers.clear();
    this.eventListeners.clear();
    this.wrappedQueues.clear();

    logger.info('Graceful shutdown completed');
  }

  /**
   * Wrap a BullMQ queue with typed interface
   */
  private wrapQueue<T>(queue: Queue): TypedQueue<T> {
    return {
      async add(name: string, data: T, options?: JobsOptions): Promise<void> {
        await queue.add(name, data, options);
      },

      async getStats(): Promise<QueueStats> {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed(),
        ]);

        return {
          name: queue.name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused(),
        };
      },

      async pause(): Promise<void> {
        await queue.pause();
      },

      resume(): void {
        void queue.resume();
      },

      async clean(grace: number, status: string): Promise<void> {
        // Validate status is a valid BullMQ clean status
        const validStatuses = ['completed', 'waiting', 'active', 'delayed', 'failed', 'paused'] as const;
        if (!validStatuses.includes(status as typeof validStatuses[number])) {
          throw new Error(`Invalid clean status: ${status}. Valid statuses: ${validStatuses.join(', ')}`);
        }
        await queue.clean(grace, 0, status as 'completed' | 'waiting' | 'active' | 'delayed' | 'failed' | 'paused');
      },

      async close(): Promise<void> {
        await queue.close();
      },
    };
  }

  /**
   * Wrap a BullMQ worker with typed interface
   */
  private wrapWorker<T>(worker: Worker): TypedWorker<T> {
    return {
      process(_processor: (job: { data: T }) => Promise<unknown>): void {
        // Worker processor is already set in constructor
      },

      async close(): Promise<void> {
        await worker.close();
      },

      async pause(): Promise<void> {
        await worker.pause();
      },

      resume(): void {
        worker.resume();
      },
    };
  }

  /**
   * Set up event listeners for queue monitoring
   */
  private setupQueueEventListeners(queue: Queue): void {
    queue.on('error', (error) => {
      logger.error(`Queue ${queue.name} error:`, error);
    });

    queue.on('waiting', (job) => {
      logger.debug(`Job ${job.id} waiting in queue ${queue.name}`);
    });

    queue.on('stalled', (job) => {
      const jobId = job?.id || 'unknown';
      logger.warn(`Job ${jobId} stalled in queue ${queue.name}`);

      const listener = this.eventListeners.get(queue.name);
      if (listener?.onJobStalled) {
        const result = listener.onJobStalled({
          jobId,
          queueName: queue.name,
          jobData: job?.data || null,
          timestamp: new Date(),
        });
        
        if (result && typeof result.catch === 'function') {
          result.catch((error: Error) => {
            logger.error(`Error in stalled event listener:`, error);
          });
        }
      }
    });
  }

  /**
   * Set up event listeners for worker monitoring
   */
  private setupWorkerEventListeners(worker: Worker): void {
    worker.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed in queue ${worker.name}`, {
        processingTime: Date.now() - job.processedOn!,
      });

      const listener = this.eventListeners.get(worker.name);
      if (listener?.onJobCompleted) {
        const listenerResult = listener.onJobCompleted({
          jobId: job.id!,
          queueName: worker.name,
          jobData: job.data as Record<string, unknown>,
          timestamp: new Date(),
          result: result as Record<string, unknown>,
        });
        
        if (listenerResult && typeof listenerResult.catch === 'function') {
          listenerResult.catch((error: Error) => {
            logger.error(`Error in completed event listener:`, error);
          });
        }
      }
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed in queue ${worker.name}:`, error);

      const listener = this.eventListeners.get(worker.name);
      if (listener?.onJobFailed) {
        const listenerResult = listener.onJobFailed({
          jobId: job?.id || 'unknown',
          queueName: worker.name,
          jobData: job?.data as Record<string, unknown>,
          timestamp: new Date(),
          error,
        });
        
        if (listenerResult && typeof listenerResult.catch === 'function') {
          listenerResult.catch((listenerError: Error) => {
            logger.error(`Error in failed event listener:`, listenerError);
          });
        }
      }
    });

    worker.on('progress', (job, progress) => {
      const progressValue = typeof progress === 'number' ? progress : 0;
      logger.debug(`Job ${job.id} progress in queue ${worker.name}: ${progressValue}%`);

      const listener = this.eventListeners.get(worker.name);
      if (listener?.onJobProgress) {
        const listenerResult = listener.onJobProgress({
          jobId: job.id!,
          queueName: worker.name,
          jobData: job.data as Record<string, unknown>,
          timestamp: new Date(),
          progress: progressValue,
        });
        
        if (listenerResult && typeof listenerResult.catch === 'function') {
          listenerResult.catch((error: Error) => {
            logger.error(`Error in progress event listener:`, error);
          });
        }
      }
    });

    worker.on('error', (error) => {
      logger.error(`Worker ${worker.name} error:`, error);
    });
  }
}
