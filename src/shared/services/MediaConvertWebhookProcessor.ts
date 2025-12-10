/**
 * MediaConvert Webhook Processor
 * 
 * Processes MediaConvert job completion webhooks and updates video processing status.
 * Integrates with the video processing workflow to handle job completion events.
 * 
 * Requirements:
 * - 4.4: Processing completion handling
 * - 4.6: Notification on processing completion/failure
 */

import { logger } from '../utils/logger.js';
import { 
  ValidationError
} from '../errors/index.js';
import { IContentRepository } from '../../modules/content/infrastructure/repositories/IContentRepository.js';

/**
 * MediaConvert webhook event data
 */
export interface MediaConvertWebhookEvent {
  version: string;
  id: string;
  'detail-type': string;
  source: string;
  account: string;
  time: string;
  region: string;
  detail: {
    status: 'COMPLETE' | 'ERROR' | 'CANCELED' | 'PROGRESSING';
    jobId: string;
    queue: string;
    userMetadata?: Record<string, string>;
    outputGroupDetails?: Array<{
      outputDetails: Array<{
        outputFilePaths: string[];
        durationInMs?: number;
        videoDetails?: {
          widthInPx: number;
          heightInPx: number;
        };
      }>;
    }>;
    errorMessage?: string;
    errorCode?: number;
  };
}

/**
 * Processed output information
 */
interface ProcessedOutput {
  resolution: string;
  url: string;
  bitrate: number;
  fileSize?: number;
  duration?: number;
}

/**
 * MediaConvert Webhook Processor
 * 
 * Handles MediaConvert job completion events and updates video processing status
 * in the database with comprehensive error handling and logging.
 */
export class MediaConvertWebhookProcessor {
  constructor(
    private readonly contentRepository: IContentRepository
  ) {}

  /**
   * Processes a MediaConvert webhook event
   */
  async processWebhookEvent(event: MediaConvertWebhookEvent): Promise<void> {
    try {
      logger.info('Processing MediaConvert webhook event', {
        eventId: event.id,
        jobId: event.detail.jobId,
        status: event.detail.status,
        source: event.source,
      });

      // Validate event
      this.validateWebhookEvent(event);

      // Only process job completion events
      if (event['detail-type'] !== 'MediaConvert Job State Change') {
        logger.debug('Ignoring non-job-state-change event', {
          eventType: event['detail-type'],
        });
        return;
      }

      const { jobId, status, userMetadata, outputGroupDetails, errorMessage } = event.detail;

      // Find processing job by MediaConvert job ID
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(jobId);
      if (!processingJob) {
        logger.warn('Processing job not found for MediaConvert job', { jobId });
        return;
      }

      // Find associated video asset
      if (!processingJob.videoAssetId) {
        logger.error('Processing job has no associated video asset', {
          processingJobId: processingJob.id,
          jobId,
        });
        return;
      }

      const videoAsset = await this.contentRepository.findVideoAssetById(
        processingJob.videoAssetId
      );
      if (!videoAsset) {
        logger.error('Video asset not found for processing job', {
          videoAssetId: processingJob.videoAssetId,
          processingJobId: processingJob.id,
        });
        return;
      }

      // Process based on job status
      switch (status) {
        case 'COMPLETE':
          await this.handleJobCompletion(
            processingJob.id,
            videoAsset.id,
            outputGroupDetails,
            userMetadata
          );
          break;

        case 'ERROR':
        case 'CANCELED':
          await this.handleJobFailure(
            processingJob.id,
            videoAsset.id,
            status,
            errorMessage
          );
          break;

        case 'PROGRESSING':
          await this.handleJobProgress(processingJob.id, videoAsset.id);
          break;

        default:
          logger.warn('Unknown MediaConvert job status', { status, jobId });
      }

      logger.info('MediaConvert webhook event processed successfully', {
        eventId: event.id,
        jobId,
        status,
        videoAssetId: videoAsset.id,
      });
    } catch (error) {
      logger.error('Failed to process MediaConvert webhook event', {
        eventId: event.id,
        jobId: event.detail?.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't throw error to avoid webhook retry loops
      // The error is logged for monitoring and debugging
    }
  }

  /**
   * Handles successful job completion
   */
  private async handleJobCompletion(
    processingJobId: string,
    videoAssetId: string,
    outputGroupDetails?: MediaConvertWebhookEvent['detail']['outputGroupDetails'],
    userMetadata?: Record<string, string>
  ): Promise<void> {
    try {
      logger.info('Handling MediaConvert job completion', {
        processingJobId,
        videoAssetId,
      });

      // Parse outputs from MediaConvert response
      const outputs = this.parseOutputDetails(outputGroupDetails);

      // Prepare video asset update data
      const availableResolutions = outputs.map(output => ({
        resolution: output.resolution,
        url: output.url,
        bitrate: output.bitrate,
        fileSize: output.fileSize,
        duration: output.duration,
      }));

      const streamingUrls = outputs.reduce((urls, output) => {
        urls[output.resolution] = output.url;
        return urls;
      }, {} as Record<string, string>);

      // Find HLS manifest URL (usually the highest resolution or master playlist)
      const hlsManifestUrl = outputs.find(o => o.resolution === '1080p')?.url || 
                            outputs[0]?.url;

      // Update video asset with completion data
      await this.contentRepository.updateVideoAssetProcessingStatus(
        videoAssetId,
        'completed',
        {
          availableResolutions,
          streamingUrls,
          hlsManifestUrl,
          processingCompletedAt: new Date().toISOString(),
          ...(outputs.length > 0 && outputs[0]?.duration && {
            durationSeconds: Math.round(outputs[0].duration / 1000),
          }),
        }
      );

      // Update processing job status
      await this.contentRepository.updateProcessingJobStatus(
        processingJobId,
        'completed',
        100,
        {
          outputs,
          completedAt: new Date().toISOString(),
          userMetadata,
        }
      );

      logger.info('Video processing completed successfully', {
        videoAssetId,
        processingJobId,
        outputCount: outputs.length,
      });

      // TODO: Send completion notification to user
      // This would integrate with the notification service when implemented
    } catch (error) {
      logger.error('Failed to handle job completion', {
        processingJobId,
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update status to failed if completion handling fails
      await this.handleJobFailure(
        processingJobId,
        videoAssetId,
        'ERROR',
        `Completion handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handles job failure or cancellation
   */
  private async handleJobFailure(
    processingJobId: string,
    videoAssetId: string,
    status: 'ERROR' | 'CANCELED',
    errorMessage?: string
  ): Promise<void> {
    try {
      logger.info('Handling MediaConvert job failure', {
        processingJobId,
        videoAssetId,
        status,
        errorMessage,
      });

      const processingStatus = status === 'CANCELED' ? 'cancelled' : 'failed';
      const finalErrorMessage = errorMessage || `MediaConvert job ${status.toLowerCase()}`;

      // Update video asset status
      await this.contentRepository.updateVideoAssetProcessingStatus(
        videoAssetId,
        processingStatus,
        {
          errorMessage: finalErrorMessage,
          processingCompletedAt: new Date().toISOString(),
        }
      );

      // Update processing job status
      await this.contentRepository.updateProcessingJobStatus(
        processingJobId,
        processingStatus,
        undefined,
        undefined,
        finalErrorMessage
      );

      logger.info('Video processing failure handled', {
        videoAssetId,
        processingJobId,
        status: processingStatus,
      });

      // TODO: Send failure notification to user
      // This would integrate with the notification service when implemented
    } catch (error) {
      logger.error('Failed to handle job failure', {
        processingJobId,
        videoAssetId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles job progress updates
   */
  private async handleJobProgress(
    processingJobId: string,
    videoAssetId: string
  ): Promise<void> {
    try {
      logger.debug('Handling MediaConvert job progress', {
        processingJobId,
        videoAssetId,
      });

      // Update video asset status to in_progress if not already
      const videoAsset = await this.contentRepository.findVideoAssetById(videoAssetId);
      if (videoAsset && videoAsset.processingStatus === 'pending') {
        await this.contentRepository.updateVideoAssetProcessingStatus(
          videoAssetId,
          'in_progress'
        );
      }

      // Update processing job status
      const processingJob = await this.contentRepository.findProcessingJobById(processingJobId);
      if (processingJob && processingJob.status === 'pending') {
        await this.contentRepository.updateProcessingJobStatus(
          processingJobId,
          'in_progress'
        );
      }
    } catch (error) {
      logger.error('Failed to handle job progress', {
        processingJobId,
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Parses MediaConvert output details into structured format
   */
  private parseOutputDetails(
    outputGroupDetails?: MediaConvertWebhookEvent['detail']['outputGroupDetails']
  ): ProcessedOutput[] {
    const outputs: ProcessedOutput[] = [];

    if (!outputGroupDetails || outputGroupDetails.length === 0) {
      return outputs;
    }

    for (const group of outputGroupDetails) {
      if (!group.outputDetails) continue;

      for (const output of group.outputDetails) {
        if (!output.outputFilePaths || output.outputFilePaths.length === 0) continue;

        // Extract resolution from video details or file path
        let resolution = 'unknown';
        if (output.videoDetails) {
          const { widthInPx, heightInPx } = output.videoDetails;
          resolution = this.determineResolutionFromDimensions(widthInPx, heightInPx);
        }

        // Use the first output file path (usually the manifest for HLS)
        const url = output.outputFilePaths[0];
        if (!url) continue;

        // Estimate bitrate based on resolution (fallback values)
        const bitrate = this.estimateBitrateFromResolution(resolution);

        outputs.push({
          resolution,
          url,
          bitrate,
          duration: output.durationInMs,
        });
      }
    }

    return outputs;
  }

  /**
   * Determines resolution name from pixel dimensions
   */
  private determineResolutionFromDimensions(width: number, height: number): string {
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return `${width}x${height}`;
  }

  /**
   * Estimates bitrate from resolution name
   */
  private estimateBitrateFromResolution(resolution: string): number {
    switch (resolution) {
      case '1080p': return 5000000; // 5 Mbps
      case '720p': return 3000000;  // 3 Mbps
      case '480p': return 1500000;  // 1.5 Mbps
      case '360p': return 800000;   // 800 Kbps
      default: return 2000000;      // 2 Mbps default
    }
  }

  /**
   * Validates webhook event structure
   */
  private validateWebhookEvent(event: MediaConvertWebhookEvent): void {
    if (!event.detail) {
      throw new ValidationError('Webhook event missing detail');
    }

    if (!event.detail.jobId) {
      throw new ValidationError('Webhook event missing job ID');
    }

    if (!event.detail.status) {
      throw new ValidationError('Webhook event missing status');
    }

    if (event.source !== 'aws.mediaconvert') {
      throw new ValidationError('Invalid webhook event source');
    }
  }
}