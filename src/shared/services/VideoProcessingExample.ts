/**
 * Video Processing Workflow Example
 * 
 * Example showing how to use the video processing workflow components.
 * This demonstrates the integration between the queue, service, and webhook processor.
 * 
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 * - 4.6: Notification on processing completion/failure
 */

import { logger } from '../utils/logger.js';
import { VideoProcessingManager } from './VideoProcessingManager.js';
import { IContentRepository } from '../../modules/content/infrastructure/repositories/IContentRepository.js';
import { IMediaConvertService } from './IMediaConvertService.js';

/**
 * Example usage of the video processing workflow
 */
export class VideoProcessingExample {
  private processingManager: VideoProcessingManager;

  constructor(
    contentRepository: IContentRepository,
    mediaConvertService: IMediaConvertService
  ) {
    this.processingManager = new VideoProcessingManager(
      contentRepository,
      mediaConvertService
    );
  }

  /**
   * Initialize the video processing system
   */
  async initialize(): Promise<void> {
    try {
      await this.processingManager.initialize();
      logger.info('Video processing system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize video processing system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Example: Process a video upload
   */
  async processVideoUpload(params: {
    videoAssetId: string;
    s3Bucket: string;
    s3Key: string;
    uploadedBy: string;
    originalFileName: string;
    fileSize: number;
  }): Promise<{ queueJobId: string; processingJobId?: string }> {
    try {
      logger.info('Starting video processing example', {
        videoAssetId: params.videoAssetId,
        fileName: params.originalFileName,
      });

      // Use the processing service to initiate video processing
      const result = await this.processingManager
        .getProcessingService()
        .processVideoUpload(params);

      logger.info('Video processing initiated', {
        videoAssetId: params.videoAssetId,
        queueJobId: result.queueJobId,
        processingJobId: result.processingJobId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to process video upload', {
        videoAssetId: params.videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Example: Check processing status
   */
  async checkProcessingStatus(videoAssetId: string): Promise<{
    status: string;
    progress: number;
    outputs?: Array<{
      resolution: string;
      url: string;
      bitrate: number;
    }>;
  }> {
    try {
      const statusInfo = await this.processingManager
        .getProcessingService()
        .getProcessingStatus(videoAssetId);

      logger.info('Processing status retrieved', {
        videoAssetId,
        status: statusInfo.status,
        progress: statusInfo.progress,
      });

      return {
        status: statusInfo.status,
        progress: statusInfo.progress,
        outputs: statusInfo.outputs,
      };
    } catch (error) {
      logger.error('Failed to get processing status', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Example: Handle MediaConvert webhook
   */
  async handleWebhook(webhookEvent: any): Promise<void> {
    try {
      logger.info('Processing MediaConvert webhook', {
        eventId: webhookEvent.id,
        jobId: webhookEvent.detail?.jobId,
        status: webhookEvent.detail?.status,
      });

      // Use the webhook processor to handle the event
      await this.processingManager.processWebhookEvent(webhookEvent);

      logger.info('Webhook processed successfully', {
        eventId: webhookEvent.id,
      });
    } catch (error) {
      logger.error('Failed to process webhook', {
        eventId: webhookEvent.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't re-throw to avoid webhook retry loops
    }
  }

  /**
   * Example: Get system statistics
   */
  async getSystemStats(): Promise<{
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
      const stats = await this.processingManager.getProcessingStats();

      logger.info('System statistics retrieved', {
        queueStats: stats.queue,
        assetStats: stats.assets,
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get system stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Example: Retry failed processing
   */
  async retryFailedProcessing(videoAssetId: string): Promise<{
    queueJobId: string;
    processingJobId?: string;
  }> {
    try {
      logger.info('Retrying failed video processing', { videoAssetId });

      const result = await this.processingManager
        .getProcessingService()
        .retryProcessing(videoAssetId);

      logger.info('Processing retry initiated', {
        videoAssetId,
        queueJobId: result.queueJobId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to retry processing', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Example: Cancel processing
   */
  async cancelProcessing(videoAssetId: string): Promise<void> {
    try {
      logger.info('Cancelling video processing', { videoAssetId });

      await this.processingManager
        .getProcessingService()
        .cancelProcessing(videoAssetId);

      logger.info('Processing cancelled successfully', { videoAssetId });
    } catch (error) {
      logger.error('Failed to cancel processing', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gracefully shutdown the processing system
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down video processing system...');
      await this.processingManager.shutdown();
      logger.info('Video processing system shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Example workflow demonstrating the complete video processing lifecycle
 */
export async function demonstrateVideoProcessingWorkflow(
  contentRepository: IContentRepository,
  mediaConvertService: IMediaConvertService
): Promise<void> {
  const example = new VideoProcessingExample(contentRepository, mediaConvertService);

  try {
    // 1. Initialize the system
    await example.initialize();

    // 2. Process a video upload
    const uploadResult = await example.processVideoUpload({
      videoAssetId: 'example-video-123',
      s3Bucket: 'example-bucket',
      s3Key: 'videos/example-video.mp4',
      uploadedBy: 'user-123',
      originalFileName: 'example-video.mp4',
      fileSize: 50000000, // 50MB
    });

    logger.info('Video processing started', uploadResult);

    // 3. Check processing status
    const status = await example.checkProcessingStatus('example-video-123');
    logger.info('Current processing status', status);

    // 4. Get system statistics
    const stats = await example.getSystemStats();
    logger.info('System statistics', stats);

    // 5. Example webhook handling (would normally come from AWS)
    const mockWebhookEvent = {
      version: '0',
      id: 'example-event-123',
      'detail-type': 'MediaConvert Job State Change',
      source: 'aws.mediaconvert',
      account: '123456789012',
      time: new Date().toISOString(),
      region: 'us-east-1',
      detail: {
        status: 'COMPLETE',
        jobId: 'example-mediaconvert-job-123',
        queue: 'example-queue',
        outputGroupDetails: [
          {
            outputDetails: [
              {
                outputFilePaths: ['https://example.com/output/1080p.m3u8'],
                durationInMs: 120000,
                videoDetails: {
                  widthInPx: 1920,
                  heightInPx: 1080,
                },
              },
            ],
          },
        ],
      },
    };

    await example.handleWebhook(mockWebhookEvent);

    logger.info('Video processing workflow demonstration completed successfully');
  } catch (error) {
    logger.error('Video processing workflow demonstration failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // 6. Shutdown gracefully
    await example.shutdown();
  }
}