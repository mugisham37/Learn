/**
 * Video Processing Manager
 *
 * Central manager for video processing operations that coordinates between
 * the queue, webhook processing, and status tracking.
 *
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 * - 4.6: Notification on processing completion/failure
 */

import { logger } from '../utils/logger.js';
import { VideoProcessingService } from './VideoProcessingService.js';
import {
  MediaConvertWebhookProcessor,
  MediaConvertWebhookEvent,
} from './MediaConvertWebhookProcessor.js';
import { IContentRepository } from '../../modules/content/infrastructure/repositories/IContentRepository.js';
import { IMediaConvertService } from './IMediaConvertService.js';

/**
 * Video Processing Manager
 *
 * Provides a unified interface for all video processing operations
 * including upload handling, status tracking, and webhook processing.
 */
export class VideoProcessingManager {
  private videoProcessingService: VideoProcessingService;
  private webhookProcessor: MediaConvertWebhookProcessor;
  private isInitialized = false;

  constructor(
    private readonly contentRepository: IContentRepository,
    private readonly mediaConvertService: IMediaConvertService
  ) {
    this.videoProcessingService = new VideoProcessingService(
      this.contentRepository,
      this.mediaConvertService
    );
    this.webhookProcessor = new MediaConvertWebhookProcessor(this.contentRepository);
  }

  /**
   * Initializes the video processing manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.videoProcessingService.initialize();

      logger.info('Video processing manager initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize video processing manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gets the video processing service instance
   */
  getProcessingService(): VideoProcessingService {
    return this.videoProcessingService;
  }

  /**
   * Gets the webhook processor instance
   */
  getWebhookProcessor(): MediaConvertWebhookProcessor {
    return this.webhookProcessor;
  }

  /**
   * Processes a MediaConvert webhook event
   */
  async processWebhookEvent(event: MediaConvertWebhookEvent): Promise<void> {
    try {
      await this.webhookProcessor.processWebhookEvent(event);
    } catch (error) {
      logger.error('Failed to process webhook event', {
        eventId: event.id,
        jobId: event.detail?.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't re-throw to avoid webhook retry loops
    }
  }

  /**
   * Gets comprehensive processing statistics
   */
  async getProcessingStats(): Promise<{
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    assets: {
      pending: number;
      inProgress: number;
      completed: number;
      failed: number;
    };
  }> {
    try {
      const [queueStats, assetStats] = await Promise.all([
        this.videoProcessingService.getQueueStats(),
        this.getVideoAssetStats(),
      ]);

      return {
        queue: queueStats,
        assets: assetStats,
      };
    } catch (error) {
      logger.error('Failed to get processing stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        queue: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        assets: {
          pending: 0,
          inProgress: 0,
          completed: 0,
          failed: 0,
        },
      };
    }
  }

  /**
   * Gracefully shuts down the video processing manager
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down video processing manager...');
      await this.videoProcessingService.shutdown();
      logger.info('Video processing manager shut down successfully');
    } catch (error) {
      logger.error('Error during video processing manager shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets video asset statistics by processing status
   */
  private async getVideoAssetStats(): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, inProgress, completed, failed] = await Promise.all([
        this.contentRepository.findVideoAssets({ processingStatus: 'pending' }),
        this.contentRepository.findVideoAssets({ processingStatus: 'in_progress' }),
        this.contentRepository.findVideoAssets({ processingStatus: 'completed' }),
        this.contentRepository.findVideoAssets({ processingStatus: 'failed' }),
      ]);

      return {
        pending: pending.total,
        inProgress: inProgress.total,
        completed: completed.total,
        failed: failed.total,
      };
    } catch (error) {
      logger.error('Failed to get video asset stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
      };
    }
  }
}
