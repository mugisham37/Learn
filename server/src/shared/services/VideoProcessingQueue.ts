/**
 * Video Processing Queue Implementation
 *
 * Implements BullMQ queue for video processing jobs with MediaConvert integration,
 * job status tracking, retry logic, and notification handling.
 *
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 * - 4.6: Notification on processing completion/failure
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

import { redis } from '../../infrastructure/cache/index.js';
import { IContentRepository } from '../../modules/content/infrastructure/repositories/IContentRepository.js';
import { ExternalServiceError, NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

import { IMediaConvertService } from './IMediaConvertService.js';

/**
 * Video processing job data interface
 */
export interface VideoProcessingJobData {
  videoAssetId: string;
  s3Bucket: string;
  s3Key: string;
  outputS3KeyPrefix: string;
  jobName: string;
  uploadedBy: string;
  originalFileName: string;
  fileSize: number;
  metadata?: Record<string, unknown>;
}

/**
 * Job completion notification data
 */
export interface JobCompletionData {
  videoAssetId: string;
  status: 'completed' | 'failed';
  outputs?: Array<{
    resolution: string;
    url: string;
    bitrate: number;
    fileSize?: number;
  }>;
  errorMessage?: string;
  processingTimeMs?: number;
}

/**
 * Video Processing Queue Configuration
 */
const QUEUE_NAME = 'video-processing';
const QUEUE_OPTIONS: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100, // Keep last 100 failed jobs
    attempts: 3, // Maximum retry attempts
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: redis,
  concurrency: 2, // Low concurrency for video processing
  maxStalledCount: 1, // Maximum stalled jobs before failing
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
};

/**
 * Video Processing Queue Implementation
 *
 * Manages video transcoding jobs using BullMQ with MediaConvert integration,
 * comprehensive error handling, and status tracking.
 */
export class VideoProcessingQueue {
  private queue: Queue<VideoProcessingJobData>;
  private worker: Worker<VideoProcessingJobData>;
  private isInitialized = false;

  constructor(
    private readonly mediaConvertService: IMediaConvertService,
    private readonly contentRepository: IContentRepository
  ) {
    this.queue = new Queue<VideoProcessingJobData>(QUEUE_NAME, QUEUE_OPTIONS);
    this.worker = new Worker<VideoProcessingJobData>(
      QUEUE_NAME,
      this.processVideoJob.bind(this),
      WORKER_OPTIONS
    );

    this.setupEventListeners();
  }

  /**
   * Initializes the queue and worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test Redis connection
      await redis.ping();

      logger.info('Video processing queue initialized', {
        queueName: QUEUE_NAME,
        concurrency: WORKER_OPTIONS.concurrency,
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize video processing queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ExternalServiceError(
        'VideoProcessingQueue',
        'Failed to initialize queue',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Adds a video processing job to the queue
   */
  async addVideoProcessingJob(
    data: VideoProcessingJobData,
    options?: JobsOptions
  ): Promise<Job<VideoProcessingJobData>> {
    try {
      logger.info('Adding video processing job to queue', {
        videoAssetId: data.videoAssetId,
        s3Key: data.s3Key,
        jobName: data.jobName,
      });

      // Validate job data
      this.validateJobData(data);

      const job = await this.queue.add('process-video', data, {
        ...options,
        priority: 7, // High priority for video processing
        delay: options?.delay || 0,
        jobId: `video-${data.videoAssetId}-${Date.now()}`,
      });

      logger.info('Video processing job added successfully', {
        jobId: job.id,
        videoAssetId: data.videoAssetId,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add video processing job', {
        videoAssetId: data.videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingQueue',
        'Failed to add job to queue',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets the status of a video processing job
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: VideoProcessingJobData;
    result?: unknown;
    failedReason?: string;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        status: await job.getState(),
        progress: typeof job.progress === 'number' ? job.progress : 0,
        data: job.data,
        result: job.returnvalue as unknown,
        failedReason: job.failedReason,
        processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cancels a video processing job
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        throw new NotFoundError(`Job not found: ${jobId}`);
      }

      await job.remove();

      logger.info('Video processing job cancelled', { jobId });
    } catch (error) {
      logger.error('Failed to cancel job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingQueue',
        'Failed to cancel job',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
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
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Gracefully shuts down the queue and worker
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down video processing queue...');

      // Close worker first to stop processing new jobs
      await this.worker.close();

      // Close queue
      await this.queue.close();

      logger.info('Video processing queue shut down successfully');
    } catch (error) {
      logger.error('Error during queue shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Processes a video transcoding job
   */
  private async processVideoJob(job: Job<VideoProcessingJobData>): Promise<JobCompletionData> {
    const startTime = Date.now();
    const { videoAssetId, s3Bucket, s3Key, outputS3KeyPrefix, jobName } = job.data;

    try {
      logger.info('Processing video job', {
        jobId: job.id,
        videoAssetId,
        s3Key,
        attempt: job.attemptsMade + 1,
      });

      // Update job progress
      await job.updateProgress(10);

      // Find video asset record
      const videoAsset = await this.contentRepository.findVideoAssetById(videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError(`Video asset not found: ${videoAssetId}`);
      }

      // Update video asset status to in_progress
      await this.contentRepository.updateVideoAssetProcessingStatus(videoAssetId, 'in_progress');

      await job.updateProgress(20);

      // Create MediaConvert transcoding job
      const mediaConvertJob = await this.mediaConvertService.createTranscodingJob({
        inputS3Bucket: s3Bucket,
        inputS3Key: s3Key,
        outputS3Bucket: s3Bucket,
        outputS3KeyPrefix,
        jobName,
        resolutions: [
          {
            name: '1080p',
            width: 1920,
            height: 1080,
            bitrate: 5000000,
            maxBitrate: 7500000,
          },
          {
            name: '720p',
            width: 1280,
            height: 720,
            bitrate: 3000000,
            maxBitrate: 4500000,
          },
          {
            name: '480p',
            width: 854,
            height: 480,
            bitrate: 1500000,
            maxBitrate: 2250000,
          },
          {
            name: '360p',
            width: 640,
            height: 360,
            bitrate: 800000,
            maxBitrate: 1200000,
          },
        ],
        hlsSegmentDuration: 6,
        thumbnailGeneration: true,
        metadata: {
          videoAssetId,
          originalFileName: job.data.originalFileName,
          uploadedBy: job.data.uploadedBy,
        },
      });

      await job.updateProgress(30);

      // Update processing job record with MediaConvert job ID
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(
        mediaConvertJob.jobId
      );

      if (processingJob) {
        await this.contentRepository.updateProcessingJob(processingJob.id, {
          externalJobId: mediaConvertJob.jobId,
          status: 'in_progress',
          startedAt: new Date(),
        });
      }

      // Poll MediaConvert job status
      const completionData = await this.pollMediaConvertJob(
        mediaConvertJob.jobId,
        job,
        videoAssetId
      );

      const processingTimeMs = Date.now() - startTime;

      logger.info('Video processing job completed', {
        jobId: job.id,
        videoAssetId,
        status: completionData.status,
        processingTimeMs,
      });

      return {
        ...completionData,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      logger.error('Video processing job failed', {
        jobId: job.id,
        videoAssetId,
        attempt: job.attemptsMade + 1,
        processingTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update video asset status to failed
      await this.contentRepository.updateVideoAssetProcessingStatus(videoAssetId, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Polls MediaConvert job status until completion
   */
  private async pollMediaConvertJob(
    mediaConvertJobId: string,
    bullJob: Job<VideoProcessingJobData>,
    videoAssetId: string
  ): Promise<JobCompletionData> {
    const maxPollingTime = 30 * 60 * 1000; // 30 minutes
    const pollingInterval = 30 * 1000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollingTime) {
      try {
        const jobStatus = await this.mediaConvertService.getJobStatus(mediaConvertJobId);

        // Update progress based on MediaConvert progress
        if (jobStatus.progress !== undefined) {
          const adjustedProgress = 30 + jobStatus.progress * 0.6; // 30-90% range
          await bullJob.updateProgress(Math.round(adjustedProgress));
        }

        if (jobStatus.status === 'COMPLETE') {
          // Job completed successfully
          await bullJob.updateProgress(95);

          const outputs =
            jobStatus.outputs?.map((output) => ({
              resolution: output.resolution,
              url: output.outputUrl,
              bitrate: output.bitrate,
              fileSize: output.fileSize,
            })) || [];

          // Update video asset with completion data
          const availableResolutions = outputs.map((output) => ({
            resolution: output.resolution,
            url: output.url,
            bitrate: output.bitrate,
            fileSize: output.fileSize,
          }));

          const streamingUrls = outputs.reduce(
            (urls, output) => {
              urls[output.resolution] = output.url;
              return urls;
            },
            {} as Record<string, string>
          );

          const hlsManifestUrl =
            outputs.find((o) => o.resolution === '1080p')?.url || outputs[0]?.url;

          await this.contentRepository.updateVideoAssetProcessingStatus(videoAssetId, 'completed', {
            availableResolutions,
            streamingUrls,
            hlsManifestUrl,
            processingCompletedAt: new Date().toISOString(),
          });

          await bullJob.updateProgress(100);

          return {
            videoAssetId,
            status: 'completed',
            outputs,
          };
        } else if (jobStatus.status === 'ERROR' || jobStatus.status === 'CANCELED') {
          // Job failed or was cancelled
          const errorMessage = jobStatus.errorMessage || 'MediaConvert job failed';

          await this.contentRepository.updateVideoAssetProcessingStatus(videoAssetId, 'failed', {
            errorMessage,
            processingCompletedAt: new Date().toISOString(),
          });

          return {
            videoAssetId,
            status: 'failed',
            errorMessage,
          };
        }

        // Job still in progress, wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      } catch (error) {
        logger.error('Error polling MediaConvert job status', {
          mediaConvertJobId,
          videoAssetId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Continue polling unless it's a critical error
        if (error instanceof NotFoundError) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }

    // Timeout reached
    throw new ExternalServiceError(
      'VideoProcessingQueue',
      'MediaConvert job polling timeout',
      new Error(`Job ${mediaConvertJobId} did not complete within ${maxPollingTime}ms`)
    );
  }

  /**
   * Validates job data before processing
   */
  private validateJobData(data: VideoProcessingJobData): void {
    if (!data.videoAssetId) {
      throw new ValidationError('Video asset ID is required');
    }
    if (!data.s3Bucket) {
      throw new ValidationError('S3 bucket is required');
    }
    if (!data.s3Key) {
      throw new ValidationError('S3 key is required');
    }
    if (!data.outputS3KeyPrefix) {
      throw new ValidationError('Output S3 key prefix is required');
    }
    if (!data.jobName) {
      throw new ValidationError('Job name is required');
    }
    if (!data.uploadedBy) {
      throw new ValidationError('Uploaded by user ID is required');
    }
    if (!data.originalFileName) {
      throw new ValidationError('Original file name is required');
    }
    if (!data.fileSize || data.fileSize <= 0) {
      throw new ValidationError('Valid file size is required');
    }
  }

  /**
   * Sets up event listeners for queue and worker
   */
  private setupEventListeners(): void {
    // Queue events
    this.queue.on('error', (error) => {
      logger.error('Video processing queue error', {
        error: error.message,
      });
    });

    // Worker events
    this.worker.on('completed', (job, result: JobCompletionData) => {
      logger.info('Video processing job completed', {
        jobId: job.id,
        videoAssetId: result.videoAssetId,
        status: result.status,
        processingTimeMs: result.processingTimeMs,
      });

      // TODO: Send notification to user about completion
      void this.sendCompletionNotification(result);
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Video processing job failed', {
        jobId: job?.id,
        videoAssetId: job?.data?.videoAssetId,
        attempt: job?.attemptsMade,
        error: error.message,
      });

      // TODO: Send notification to user about failure
      if (job) {
        void this.sendFailureNotification(job.data, error.message);
      }
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Video processing job stalled', { jobId });
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug('Video processing job progress', {
        jobId: job.id,
        videoAssetId: job.data.videoAssetId,
        progress,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Video processing worker error', {
        error: error.message,
      });
    });
  }

  /**
   * Sends completion notification to user
   * TODO: Implement actual notification service integration
   */
  private sendCompletionNotification(result: JobCompletionData): void {
    try {
      // This would integrate with the notification service
      logger.info('Sending video processing completion notification', {
        videoAssetId: result.videoAssetId,
        status: result.status,
      });

      // TODO: Implement notification service call
      // await notificationService.sendNotification({
      //   type: 'video_processing_complete',
      //   recipientId: uploadedBy,
      //   data: result,
      // });
    } catch (error) {
      logger.error('Failed to send completion notification', {
        videoAssetId: result.videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sends failure notification to user
   * TODO: Implement actual notification service integration
   */
  private sendFailureNotification(
    jobData: VideoProcessingJobData,
    _errorMessage: string
  ): void {
    try {
      logger.info('Sending video processing failure notification', {
        videoAssetId: jobData.videoAssetId,
        uploadedBy: jobData.uploadedBy,
      });

      // TODO: Implement notification service call
      // await notificationService.sendNotification({
      //   type: 'video_processing_failed',
      //   recipientId: jobData.uploadedBy,
      //   data: {
      //     videoAssetId: jobData.videoAssetId,
      //     originalFileName: jobData.originalFileName,
      //     errorMessage,
      //   },
      // });
    } catch (error) {
      logger.error('Failed to send failure notification', {
        videoAssetId: jobData.videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Global instance management
let videoProcessingQueueInstance: VideoProcessingQueue | null = null;

/**
 * Get the global video processing queue instance
 */
export function getVideoProcessingQueue(): VideoProcessingQueue {
  if (!videoProcessingQueueInstance) {
    throw new Error(
      'VideoProcessingQueue not initialized. Call initializeVideoProcessingQueue first.'
    );
  }
  return videoProcessingQueueInstance;
}

/**
 * Initialize video processing queue (call this during application startup)
 */
export async function initializeVideoProcessingQueue(
  mediaConvertService: IMediaConvertService,
  contentRepository: IContentRepository
): Promise<VideoProcessingQueue> {
  if (videoProcessingQueueInstance) {
    logger.warn('VideoProcessingQueue already initialized');
    return videoProcessingQueueInstance;
  }

  videoProcessingQueueInstance = new VideoProcessingQueue(mediaConvertService, contentRepository);

  await videoProcessingQueueInstance.initialize();

  logger.info('Video processing queue initialized successfully');
  return videoProcessingQueueInstance;
}

/**
 * Shutdown video processing queue (call this during application shutdown)
 */
export async function shutdownVideoProcessingQueue(): Promise<void> {
  if (videoProcessingQueueInstance) {
    await videoProcessingQueueInstance.shutdown();
    videoProcessingQueueInstance = null;
    logger.info('Video processing queue shut down successfully');
  }
}
