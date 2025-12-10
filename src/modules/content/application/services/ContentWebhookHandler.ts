/**
 * Content Webhook Handler
 * 
 * Implements webhook handling for MediaConvert job completion
 * and updates video processing status in the content module.
 * 
 * Requirements:
 * - 4.4: Processing completion handling
 * - 4.2: Video status updates after transcoding
 * - 4.3: Error handling for failed jobs
 */

import { logger } from '../../../../shared/utils/logger.js';

import { IContentRepository } from '../../infrastructure/repositories/IContentRepository.js';
import { 
  IWebhookHandler, 
  ProcessedWebhookData 
} from '../../../../shared/services/MediaConvertWebhookHandler.js';
import { 
  IContentService,
  TranscodingCompleteParams 
} from './IContentService.js';

/**
 * Content Webhook Handler Implementation
 * 
 * Handles MediaConvert webhook events and updates video processing
 * status in the content module database.
 */
export class ContentWebhookHandler implements IWebhookHandler {
  constructor(
    private readonly contentRepository: IContentRepository,
    private readonly contentService: IContentService
  ) {}

  /**
   * Handles transcoding completion webhook
   */
  async handleTranscodingComplete(data: ProcessedWebhookData): Promise<void> {
    try {
      logger.info('Handling transcoding completion webhook', {
        jobId: data.jobId,
        status: data.status,
        outputCount: data.outputs?.length || 0,
      });

      // Find processing job by external job ID
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(data.jobId);
      if (!processingJob) {
        logger.warn('Processing job not found for MediaConvert job', {
          jobId: data.jobId,
        });
        return;
      }

      // Convert webhook data to ContentService format
      const transcodingParams: TranscodingCompleteParams = {
        jobId: data.jobId,
        status: data.status === 'completed' ? 'completed' : 'failed',
        outputs: data.outputs?.map(output => ({
          resolution: output.resolution,
          url: output.url,
          bitrate: output.bitrate,
          fileSize: output.fileSize || 0,
        })),
        errorMessage: data.errorMessage,
      };

      // Use ContentService to handle the completion
      await this.contentService.handleTranscodingComplete(transcodingParams);

      // Log additional webhook metadata if available
      if (data.userMetadata) {
        logger.info('Processing job metadata', {
          jobId: data.jobId,
          metadata: data.userMetadata,
        });
      }

      // Log warnings if present
      if (data.warnings && data.warnings.length > 0) {
        logger.warn('MediaConvert job completed with warnings', {
          jobId: data.jobId,
          warnings: data.warnings,
        });
      }

      logger.info('Transcoding completion webhook handled successfully', {
        jobId: data.jobId,
        status: data.status,
        processingJobId: processingJob.id,
      });
    } catch (error) {
      logger.error('Failed to handle transcoding completion webhook', {
        jobId: data.jobId,
        status: data.status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't throw error - we don't want to fail the webhook response
      // The job status will remain in processing state and can be retried
    }
  }

  /**
   * Handles job progress updates (optional)
   */
  async handleJobProgress(data: ProcessedWebhookData): Promise<void> {
    try {
      if (data.status !== 'progressing') {
        return;
      }

      logger.debug('Handling job progress update', {
        jobId: data.jobId,
        status: data.status,
      });

      // Find processing job
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(data.jobId);
      if (!processingJob) {
        return;
      }

      // Update progress if available
      // Note: MediaConvert doesn't always provide progress percentage in webhooks
      // This would be more useful with polling the MediaConvert API
      await this.contentRepository.updateProcessingJobStatus(
        processingJob.id,
        'in_progress',
        undefined, // progress not available in webhook
        {
          lastProgressUpdate: new Date().toISOString(),
        }
      );

      logger.debug('Job progress updated', {
        jobId: data.jobId,
        processingJobId: processingJob.id,
      });
    } catch (error) {
      logger.error('Failed to handle job progress update', {
        jobId: data.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles job cancellation
   */
  async handleJobCancellation(data: ProcessedWebhookData): Promise<void> {
    try {
      if (data.status !== 'canceled') {
        return;
      }

      logger.info('Handling job cancellation', {
        jobId: data.jobId,
      });

      // Find processing job
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(data.jobId);
      if (!processingJob) {
        return;
      }

      // Update processing job status
      await this.contentRepository.updateProcessingJobStatus(
        processingJob.id,
        'cancelled',
        0,
        {
          canceledAt: new Date().toISOString(),
        }
      );

      // Update video asset status if applicable
      if (processingJob.videoAssetId) {
        await this.contentRepository.updateVideoAssetProcessingStatus(
          processingJob.videoAssetId,
          'cancelled',
          {
            processingCompletedAt: new Date().toISOString(),
            canceledAt: new Date().toISOString(),
          }
        );
      }

      logger.info('Job cancellation handled', {
        jobId: data.jobId,
        processingJobId: processingJob.id,
      });
    } catch (error) {
      logger.error('Failed to handle job cancellation', {
        jobId: data.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles job submission confirmation
   */
  async handleJobSubmission(data: ProcessedWebhookData): Promise<void> {
    try {
      if (data.status !== 'submitted') {
        return;
      }

      logger.info('Handling job submission confirmation', {
        jobId: data.jobId,
      });

      // Find processing job
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(data.jobId);
      if (!processingJob) {
        return;
      }

      // Update processing job status
      await this.contentRepository.updateProcessingJobStatus(
        processingJob.id,
        'pending',
        0,
        {
          submittedAt: new Date().toISOString(),
        }
      );

      logger.info('Job submission confirmed', {
        jobId: data.jobId,
        processingJobId: processingJob.id,
      });
    } catch (error) {
      logger.error('Failed to handle job submission', {
        jobId: data.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}