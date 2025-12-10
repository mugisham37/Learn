/**
 * Video Processing Service
 * 
 * High-level service that orchestrates video processing workflows,
 * integrating the queue, MediaConvert service, and content repository.
 * 
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 * - 4.6: Notification on processing completion/failure
 */

import { logger } from '../utils/logger.js';
import { 
  ValidationError, 
  NotFoundError, 
  ExternalServiceError 
} from '../errors/index.js';
import { VideoProcessingQueue, VideoProcessingJobData } from './VideoProcessingQueue.js';
import { IContentRepository } from '../../modules/content/infrastructure/repositories/IContentRepository.js';
import { IMediaConvertService } from './IMediaConvertService.js';

/**
 * Video upload completion parameters
 */
export interface VideoUploadCompletionParams {
  videoAssetId: string;
  s3Bucket: string;
  s3Key: string;
  uploadedBy: string;
  originalFileName: string;
  fileSize: number;
  metadata?: Record<string, any>;
}

/**
 * Processing status information
 */
export interface ProcessingStatusInfo {
  videoAssetId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  queueJobId?: string;
  mediaConvertJobId?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  outputs?: Array<{
    resolution: string;
    url: string;
    bitrate: number;
    fileSize?: number;
  }>;
}

/**
 * Video Processing Service
 * 
 * Provides high-level video processing operations with comprehensive
 * error handling, status tracking, and notification integration.
 */
export class VideoProcessingService {
  private videoQueue: VideoProcessingQueue;
  private isInitialized = false;

  constructor(
    private readonly contentRepository: IContentRepository,
    private readonly mediaConvertService: IMediaConvertService
  ) {
    this.videoQueue = new VideoProcessingQueue(
      this.mediaConvertService,
      this.contentRepository
    );
  }

  /**
   * Initializes the video processing service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.videoQueue.initialize();
      
      logger.info('Video processing service initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize video processing service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initiates video processing after upload completion
   */
  async processVideoUpload(params: VideoUploadCompletionParams): Promise<{
    queueJobId: string;
    processingJobId?: string;
  }> {
    try {
      logger.info('Initiating video processing', {
        videoAssetId: params.videoAssetId,
        s3Key: params.s3Key,
        fileSize: params.fileSize,
      });

      // Validate parameters
      this.validateUploadParams(params);

      // Find video asset record
      const videoAsset = await this.contentRepository.findVideoAssetById(params.videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError(`Video asset not found: ${params.videoAssetId}`);
      }

      // Generate output S3 key prefix
      const outputS3KeyPrefix = this.generateOutputS3KeyPrefix(params.s3Key);
      const jobName = this.generateJobName(params.s3Key, params.videoAssetId);

      // Create processing job record
      const processingJob = await this.contentRepository.createProcessingJob({
        videoAssetId: params.videoAssetId,
        jobType: 'video_transcode',
        externalServiceName: 'mediaconvert',
        jobConfiguration: {
          inputS3Key: params.s3Key,
          inputS3Bucket: params.s3Bucket,
          outputS3KeyPrefix,
          outputResolutions: ['1080p', '720p', '480p', '360p'],
          outputFormat: 'hls',
          thumbnailGeneration: true,
        },
        status: 'pending',
        priority: 7,
        maxAttempts: 3,
        metadata: {
          originalFileName: params.originalFileName,
          uploadedBy: params.uploadedBy,
          fileSize: params.fileSize,
        },
      });

      // Update video asset with processing job information
      await this.contentRepository.updateVideoAsset(params.videoAssetId, {
        processingJobId: processingJob.id,
        processingStatus: 'pending',
        metadata: {
          ...(videoAsset.metadata as Record<string, any> || {}),
          outputS3KeyPrefix,
          jobName,
          processingJobId: processingJob.id,
        },
      });

      // Prepare job data for queue
      const jobData: VideoProcessingJobData = {
        videoAssetId: params.videoAssetId,
        s3Bucket: params.s3Bucket,
        s3Key: params.s3Key,
        outputS3KeyPrefix,
        jobName,
        uploadedBy: params.uploadedBy,
        originalFileName: params.originalFileName,
        fileSize: params.fileSize,
        metadata: params.metadata,
      };

      // Add job to processing queue
      const queueJob = await this.videoQueue.addVideoProcessingJob(jobData);

      // Update processing job with queue job ID
      await this.contentRepository.updateProcessingJob(processingJob.id, {
        externalJobId: queueJob.id as string,
        scheduledFor: new Date(),
      });

      logger.info('Video processing initiated successfully', {
        videoAssetId: params.videoAssetId,
        queueJobId: queueJob.id,
        processingJobId: processingJob.id,
      });

      return {
        queueJobId: queueJob.id as string,
        processingJobId: processingJob.id,
      };
    } catch (error) {
      logger.error('Failed to initiate video processing', {
        videoAssetId: params.videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update video asset status to failed
      try {
        await this.contentRepository.updateVideoAssetProcessingStatus(
          params.videoAssetId,
          'failed',
          {
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      } catch (updateError) {
        logger.error('Failed to update video asset status after processing failure', {
          videoAssetId: params.videoAssetId,
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
        });
      }

      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingService',
        'Failed to initiate video processing',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets the processing status of a video
   */
  async getProcessingStatus(videoAssetId: string): Promise<ProcessingStatusInfo> {
    try {
      logger.debug('Getting video processing status', { videoAssetId });

      // Find video asset
      const videoAsset = await this.contentRepository.findVideoAssetById(videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError(`Video asset not found: ${videoAssetId}`);
      }

      // Find processing job if exists
      let processingJob = null;
      if (videoAsset.processingJobId) {
        processingJob = await this.contentRepository.findProcessingJobById(
          videoAsset.processingJobId
        );
      }

      // Get queue job status if available
      let queueJobStatus = null;
      if (processingJob?.externalJobId) {
        queueJobStatus = await this.videoQueue.getJobStatus(processingJob.externalJobId);
      }

      // Build status info
      const statusInfo: ProcessingStatusInfo = {
        videoAssetId,
        status: videoAsset.processingStatus,
        progress: queueJobStatus?.progress || 0,
        queueJobId: processingJob?.externalJobId || undefined,
        errorMessage: videoAsset.processingErrorMessage || processingJob?.errorMessage || undefined,
        startedAt: videoAsset.processingStartedAt || processingJob?.startedAt || undefined,
        completedAt: videoAsset.processingCompletedAt || processingJob?.completedAt || undefined,
      };

      // Add outputs if processing is completed
      if (videoAsset.processingStatus === 'completed' && videoAsset.availableResolutions) {
        statusInfo.outputs = Array.isArray(videoAsset.availableResolutions) 
          ? videoAsset.availableResolutions as any[]
          : [];
      }

      return statusInfo;
    } catch (error) {
      logger.error('Failed to get video processing status', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingService',
        'Failed to get processing status',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Cancels video processing if still in progress
   */
  async cancelProcessing(videoAssetId: string): Promise<void> {
    try {
      logger.info('Cancelling video processing', { videoAssetId });

      // Find video asset
      const videoAsset = await this.contentRepository.findVideoAssetById(videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError(`Video asset not found: ${videoAssetId}`);
      }

      // Check if processing can be cancelled
      if (!['pending', 'in_progress'].includes(videoAsset.processingStatus)) {
        throw new ValidationError('Processing cannot be cancelled in current status');
      }

      // Find processing job
      let processingJob = null;
      if (videoAsset.processingJobId) {
        processingJob = await this.contentRepository.findProcessingJobById(
          videoAsset.processingJobId
        );
      }

      // Cancel queue job if exists
      if (processingJob?.externalJobId) {
        try {
          await this.videoQueue.cancelJob(processingJob.externalJobId);
        } catch (error) {
          logger.warn('Failed to cancel queue job', {
            queueJobId: processingJob.externalJobId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Cancel MediaConvert job if exists
      if (processingJob?.jobConfiguration) {
        const config = processingJob.jobConfiguration as any;
        if (config.mediaConvertJobId) {
          try {
            await this.mediaConvertService.cancelJob(config.mediaConvertJobId);
          } catch (error) {
            logger.warn('Failed to cancel MediaConvert job', {
              mediaConvertJobId: config.mediaConvertJobId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }

      // Update video asset status
      await this.contentRepository.updateVideoAssetProcessingStatus(
        videoAssetId,
        'cancelled',
        {
          processingCompletedAt: new Date().toISOString(),
        }
      );

      // Update processing job status
      if (processingJob) {
        await this.contentRepository.updateProcessingJobStatus(
          processingJob.id,
          'cancelled'
        );
      }

      logger.info('Video processing cancelled successfully', { videoAssetId });
    } catch (error) {
      logger.error('Failed to cancel video processing', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingService',
        'Failed to cancel processing',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Retries failed video processing
   */
  async retryProcessing(videoAssetId: string): Promise<{
    queueJobId: string;
    processingJobId?: string;
  }> {
    try {
      logger.info('Retrying video processing', { videoAssetId });

      // Find video asset
      const videoAsset = await this.contentRepository.findVideoAssetById(videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError(`Video asset not found: ${videoAssetId}`);
      }

      // Check if processing can be retried
      if (videoAsset.processingStatus !== 'failed') {
        throw new ValidationError('Only failed processing can be retried');
      }

      // Extract original parameters from metadata
      const metadata = videoAsset.metadata as any || {};
      const params: VideoUploadCompletionParams = {
        videoAssetId,
        s3Bucket: videoAsset.s3Bucket,
        s3Key: videoAsset.s3Key,
        uploadedBy: videoAsset.uploadedBy,
        originalFileName: videoAsset.originalFileName,
        fileSize: videoAsset.originalFileSize,
        metadata: metadata,
      };

      // Reset video asset status
      await this.contentRepository.updateVideoAssetProcessingStatus(
        videoAssetId,
        'pending',
        {
          processingErrorMessage: null,
          processingStartedAt: null,
          processingCompletedAt: null,
        }
      );

      // Initiate processing again
      const result = await this.processVideoUpload(params);

      logger.info('Video processing retry initiated successfully', {
        videoAssetId,
        queueJobId: result.queueJobId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to retry video processing', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'VideoProcessingService',
        'Failed to retry processing',
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
      return await this.videoQueue.getQueueStats();
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
   * Gracefully shuts down the service
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down video processing service...');
      await this.videoQueue.shutdown();
      logger.info('Video processing service shut down successfully');
    } catch (error) {
      logger.error('Error during video processing service shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Private helper methods

  private validateUploadParams(params: VideoUploadCompletionParams): void {
    if (!params.videoAssetId) {
      throw new ValidationError('Video asset ID is required');
    }
    if (!params.s3Bucket) {
      throw new ValidationError('S3 bucket is required');
    }
    if (!params.s3Key) {
      throw new ValidationError('S3 key is required');
    }
    if (!params.uploadedBy) {
      throw new ValidationError('Uploaded by user ID is required');
    }
    if (!params.originalFileName) {
      throw new ValidationError('Original file name is required');
    }
    if (!params.fileSize || params.fileSize <= 0) {
      throw new ValidationError('Valid file size is required');
    }
  }

  private generateOutputS3KeyPrefix(inputS3Key: string): string {
    // Remove file extension and add processed prefix
    const keyWithoutExtension = inputS3Key.substring(0, inputS3Key.lastIndexOf('.'));
    return `${keyWithoutExtension}_processed`;
  }

  private generateJobName(inputS3Key: string, videoAssetId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = inputS3Key.substring(inputS3Key.lastIndexOf('/') + 1, inputS3Key.lastIndexOf('.'));
    return `video-transcode-${fileName}-${videoAssetId}-${timestamp}`;
  }
}