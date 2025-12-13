/**
 * Email Queue Implementation
 * 
 * Implements BullMQ queue for email sending jobs with retry logic,
 * bounce/complaint webhook handling, and delivery status tracking.
 * 
 * Requirements:
 * - 10.2: Email template system with dynamic data population
 * - 14.2: Email queue with high concurrency and retry logic
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

import { redis } from '../../infrastructure/cache/index.js';
import { logger } from '../utils/logger.js';

import { IEmailService, EmailOptions, EmailResult, BulkEmailResult, EmailTemplateData } from './IEmailService.js';
import { ServiceFactory } from './ServiceFactory.js';

/**
 * Email job data interface
 */
export interface EmailJobData {
  type: 'single' | 'bulk';
  options?: EmailOptions;
  recipients?: string[];
  templateId?: string;
  templateData?: EmailTemplateData;
  priority?: 'normal' | 'high' | 'urgent';
  retryCount?: number;
  originalJobId?: string;
}

/**
 * Email delivery status tracking
 */
export interface EmailDeliveryStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'bounced' | 'complained';
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
  bouncedAt?: Date;
  complainedAt?: Date;
  attempts: number;
  lastAttemptAt: Date;
}

/**
 * Bounce/complaint webhook data
 */
export interface WebhookData {
  type: 'bounce' | 'complaint';
  messageId: string;
  email: string;
  reason?: string;
  timestamp: Date;
}

/**
 * Email Queue Configuration
 */
const EMAIL_QUEUE_NAME = 'email-queue';
const EMAIL_QUEUE_OPTIONS: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 5, // Retry 5 times per requirement 14.2
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
};

/**
 * Email Worker Configuration
 */
const EMAIL_WORKER_OPTIONS: WorkerOptions = {
  connection: redis,
  concurrency: 10, // High concurrency per requirement 14.2
  maxStalledCount: 1,
  stalledInterval: 30000, // 30 seconds
};

/**
 * Email Queue Implementation
 * 
 * Manages email sending jobs with BullMQ, implements retry logic,
 * tracks delivery status, and handles bounce/complaint webhooks.
 */
export class EmailQueue {
  private queue: Queue<EmailJobData>;
  private worker: Worker<EmailJobData>;
  private emailService: IEmailService;
  private deliveryStatuses: Map<string, EmailDeliveryStatus> = new Map();

  constructor() {
    this.emailService = ServiceFactory.getEmailService();
    this.queue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, EMAIL_QUEUE_OPTIONS);
    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      this.processEmailJob.bind(this),
      EMAIL_WORKER_OPTIONS
    );

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for job lifecycle tracking
   */
  private setupEventListeners(): void {
    // Job started
    this.worker.on('active', (job: Job<EmailJobData>) => {
      logger.info(`Email job ${job.id} started processing`, {
        jobId: job.id,
        type: job.data.type,
        priority: job.data.priority,
      });

      this.updateDeliveryStatus(job.id!, {
        status: 'processing',
        lastAttemptAt: new Date(),
        attempts: job.attemptsMade + 1,
      });
    });

    // Job completed successfully
    this.worker.on('completed', (job: Job<EmailJobData>, result: EmailResult | BulkEmailResult) => {
      logger.info(`Email job ${job.id} completed successfully`, {
        jobId: job.id,
        type: job.data.type,
        result,
      });

      const messageId = 'messageId' in result ? result.messageId : undefined;
      this.updateDeliveryStatus(job.id!, {
        status: 'completed',
        messageId,
        deliveredAt: new Date(),
        lastAttemptAt: new Date(),
        attempts: job.attemptsMade + 1,
      });
    });

    // Job failed
    this.worker.on('failed', (job: Job<EmailJobData> | undefined, error: Error) => {
      if (!job) {
        logger.error('Email job failed without job context', { error: error.message });
        return;
      }

      logger.error(`Email job ${job.id} failed`, {
        jobId: job.id,
        type: job.data.type,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });

      this.updateDeliveryStatus(job.id!, {
        status: 'failed',
        error: error.message,
        lastAttemptAt: new Date(),
        attempts: job.attemptsMade,
      });
    });

    // Job stalled
    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`Email job ${jobId} stalled`, { jobId });
    });

    // Queue error
    this.queue.on('error', (error: Error) => {
      logger.error('Email queue error', { error: error.message });
    });

    // Worker error
    this.worker.on('error', (error: Error) => {
      logger.error('Email worker error', { error: error.message });
    });
  }

  /**
   * Process email job
   */
  private async processEmailJob(job: Job<EmailJobData>): Promise<EmailResult | BulkEmailResult> {
    const { type, options, recipients, templateId, templateData } = job.data;

    try {
      if (type === 'single' && options) {
        return await this.emailService.sendTransactional(options);
      } else if (type === 'bulk' && recipients && templateId) {
        return await this.emailService.sendBulk(
          recipients,
          templateId,
          templateData || {}
        );
      } else {
        throw new Error('Invalid email job data');
      }
    } catch (error) {
      logger.error(`Email job ${job.id} processing error`, {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: job.data,
      });
      throw error;
    }
  }

  /**
   * Queue a single email for sending
   */
  async queueEmail(
    options: EmailOptions,
    priority: 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<string> {
    const jobOptions: JobsOptions = {
      priority: this.getPriorityValue(priority),
      delay: priority === 'urgent' ? 0 : undefined,
    };

    const job = await this.queue.add(
      'send-email',
      {
        type: 'single',
        options,
        priority,
      },
      jobOptions
    );

    // Initialize delivery status
    this.initializeDeliveryStatus(job.id!, 'single');

    logger.info(`Email queued successfully`, {
      jobId: job.id,
      to: options.to,
      templateId: options.templateId,
      priority,
    });

    return job.id!;
  }

  /**
   * Queue bulk emails for sending
   */
  async queueBulkEmail(
    recipients: string[],
    templateId: string,
    templateData: EmailTemplateData,
    priority: 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<string> {
    const jobOptions: JobsOptions = {
      priority: this.getPriorityValue(priority),
      delay: priority === 'urgent' ? 0 : undefined,
    };

    const job = await this.queue.add(
      'send-bulk-email',
      {
        type: 'bulk',
        recipients,
        templateId,
        templateData,
        priority,
      },
      jobOptions
    );

    // Initialize delivery status
    this.initializeDeliveryStatus(job.id!, 'bulk');

    logger.info(`Bulk email queued successfully`, {
      jobId: job.id,
      recipientCount: recipients.length,
      templateId,
      priority,
    });

    return job.id!;
  }

  /**
   * Handle bounce webhook
   */
  async handleBounce(webhookData: WebhookData): Promise<void> {
    logger.warn('Email bounce received', {
      messageId: webhookData.messageId,
      email: webhookData.email,
      reason: webhookData.reason,
    });

    // Find job by message ID and update status
    const jobId = await this.findJobByMessageId(webhookData.messageId);
    if (jobId) {
      this.updateDeliveryStatus(jobId, {
        status: 'bounced',
        bouncedAt: webhookData.timestamp,
        error: webhookData.reason,
      });
    }

    // TODO: Implement bounce handling logic
    // - Add email to bounce list
    // - Update user notification preferences
    // - Alert administrators for high bounce rates
  }

  /**
   * Handle complaint webhook
   */
  async handleComplaint(webhookData: WebhookData): Promise<void> {
    logger.warn('Email complaint received', {
      messageId: webhookData.messageId,
      email: webhookData.email,
      reason: webhookData.reason,
    });

    // Find job by message ID and update status
    const jobId = await this.findJobByMessageId(webhookData.messageId);
    if (jobId) {
      this.updateDeliveryStatus(jobId, {
        status: 'complained',
        complainedAt: webhookData.timestamp,
        error: webhookData.reason,
      });
    }

    // TODO: Implement complaint handling logic
    // - Add email to suppression list
    // - Update user notification preferences
    // - Alert administrators for complaints
  }

  /**
   * Get delivery status for a job
   */
  getDeliveryStatus(jobId: string): EmailDeliveryStatus | null {
    return this.deliveryStatuses.get(jobId) || null;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(limit: number = 10): Promise<number> {
    const failedJobs = await this.queue.getFailed(0, limit - 1);
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
        logger.info(`Retried failed email job ${job.id}`);
      } catch (error) {
        logger.error(`Failed to retry email job ${job.id}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return retriedCount;
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 24 hours
      await this.queue.clean(24 * 60 * 60 * 1000, 100, 'completed');
      
      // Clean failed jobs older than 7 days
      await this.queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');

      logger.info('Email queue cleanup completed');
    } catch (error) {
      logger.error('Email queue cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down email queue...');
    
    try {
      await this.worker.close();
      await this.queue.close();
      logger.info('Email queue shutdown completed');
    } catch (error) {
      logger.error('Email queue shutdown error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.queue.isPaused();
      return true;
    } catch (error) {
      logger.error('Email queue health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Convert priority string to numeric value for BullMQ
   */
  private getPriorityValue(priority: 'normal' | 'high' | 'urgent'): number {
    switch (priority) {
      case 'urgent':
        return 1; // Highest priority
      case 'high':
        return 5;
      case 'normal':
      default:
        return 10; // Lowest priority
    }
  }

  /**
   * Initialize delivery status tracking
   */
  private initializeDeliveryStatus(jobId: string, _type: 'single' | 'bulk'): void {
    this.deliveryStatuses.set(jobId, {
      jobId,
      status: 'queued',
      attempts: 0,
      lastAttemptAt: new Date(),
    });
  }

  /**
   * Update delivery status
   */
  private updateDeliveryStatus(
    jobId: string,
    updates: Partial<Omit<EmailDeliveryStatus, 'jobId'>>
  ): void {
    const existing = this.deliveryStatuses.get(jobId);
    if (existing) {
      this.deliveryStatuses.set(jobId, {
        ...existing,
        ...updates,
      });
    }
  }

  /**
   * Find job ID by message ID (for webhook handling)
   * In production, this should be stored in a database or Redis
   */
  private findJobByMessageId(messageId: string): Promise<string | null> {
    // This is a simplified implementation
    // In production, you would store message ID -> job ID mapping in Redis or database
    for (const [jobId, status] of Array.from(this.deliveryStatuses.entries())) {
      if (status.messageId === messageId) {
        return Promise.resolve(jobId);
      }
    }
    return Promise.resolve(null);
  }
}

/**
 * Singleton instance of EmailQueue
 */
let emailQueueInstance: EmailQueue | null = null;

/**
 * Get the singleton EmailQueue instance
 */
export function getEmailQueue(): EmailQueue {
  if (!emailQueueInstance) {
    emailQueueInstance = new EmailQueue();
  }
  return emailQueueInstance;
}

/**
 * Initialize email queue (call this during application startup)
 */
export async function initializeEmailQueue(): Promise<EmailQueue> {
  const queue = getEmailQueue();
  
  // Perform any initialization tasks
  await queue.healthCheck();
  
  logger.info('Email queue initialized successfully');
  return queue;
}

/**
 * Shutdown email queue (call this during application shutdown)
 */
export async function shutdownEmailQueue(): Promise<void> {
  if (emailQueueInstance) {
    await emailQueueInstance.shutdown();
    emailQueueInstance = null;
  }
}