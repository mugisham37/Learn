/**
 * Queue Infrastructure Usage Examples
 *
 * Examples showing how to use the new BullMQ infrastructure
 * for creating typed queues and workers.
 */

import { QueueManager } from './QueueManager.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Example: Creating a typed queue for video processing
 */
export async function createVideoProcessingQueue() {
  // Get the queue manager instance
  const queueManager = QueueManager.getInstance();
  const queueFactory = queueManager.getQueueFactory();

  // Create a typed queue for video processing
  interface VideoJobData {
    videoAssetId: string;
    s3Bucket: string;
    s3Key: string;
    outputS3KeyPrefix: string;
  }

  const videoQueue = queueFactory.createQueue<VideoJobData>('videoProcessing');

  // Add a job to the queue
  await videoQueue.add('process-video', {
    videoAssetId: 'video-123',
    s3Bucket: 'my-bucket',
    s3Key: 'videos/input.mp4',
    outputS3KeyPrefix: 'videos/processed/',
  });

  logger.info('Video processing job added to queue');
  return videoQueue;
}

/**
 * Example: Creating a typed worker for video processing
 */
export async function createVideoProcessingWorker() {
  const queueManager = QueueManager.getInstance();
  const queueFactory = queueManager.getQueueFactory();

  interface VideoJobData {
    videoAssetId: string;
    s3Bucket: string;
    s3Key: string;
    outputS3KeyPrefix: string;
  }

  // Create a typed worker
  const videoWorker = queueFactory.createWorker<VideoJobData>('videoProcessing', async (job) => {
    logger.info(`Processing video job ${job.data.videoAssetId}`);

    // Simulate video processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      success: true,
      outputUrls: [`${job.data.outputS3KeyPrefix}output.m3u8`],
    };
  });

  logger.info('Video processing worker created');
  return videoWorker;
}

/**
 * Example: Creating an email queue with custom options
 */
export async function createEmailQueue() {
  const queueManager = QueueManager.getInstance();
  const queueFactory = queueManager.getQueueFactory();

  interface EmailJobData {
    to: string;
    subject: string;
    template: string;
    data: Record<string, any>;
  }

  // Create email queue with custom options
  const emailQueue = queueFactory.createQueue<EmailJobData>('emailSending', {
    defaultJobOptions: {
      priority: 10, // High priority for emails
      delay: 0, // Send immediately
    },
  });

  // Add an email job
  await emailQueue.add('send-welcome-email', {
    to: 'user@example.com',
    subject: 'Welcome!',
    template: 'welcome',
    data: { name: 'John Doe' },
  });

  return emailQueue;
}

/**
 * Example: Monitoring queue health
 */
export async function monitorQueueHealth() {
  const queueManager = QueueManager.getInstance();

  // Get overall health status
  const healthStatus = await queueManager.getHealthStatus();

  logger.info('Queue health status:', {
    healthy: healthStatus.healthy,
    queueCount: healthStatus.queues.length,
    alertCount: healthStatus.alerts.length,
  });

  // Get detailed queue statistics
  const queueFactory = queueManager.getQueueFactory();
  const stats = await queueFactory.getAllQueueStats();

  stats.forEach((stat) => {
    logger.info(`Queue ${stat.name}:`, {
      waiting: stat.waiting,
      active: stat.active,
      completed: stat.completed,
      failed: stat.failed,
      paused: stat.paused,
    });
  });

  return healthStatus;
}

/**
 * Example: Graceful shutdown
 */
export async function gracefulShutdown() {
  const queueManager = QueueManager.getInstance();

  logger.info('Starting graceful shutdown...');
  await queueManager.shutdown();
  logger.info('Graceful shutdown completed');
}
