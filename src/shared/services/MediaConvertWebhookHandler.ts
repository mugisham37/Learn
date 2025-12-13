/**
 * MediaConvert Webhook Handler
 *
 * Handles MediaConvert job completion webhooks and updates
 * video processing status in the database.
 *
 * Requirements:
 * - 4.4: Processing completion handling
 * - 4.2: Video status updates after transcoding
 * - 4.3: Error handling for failed jobs
 */

import { FastifyRequest, FastifyReply } from 'fastify';

import { ValidationError } from '../errors/index.js';
import { MediaConvertWebhookPayload } from '../types/aws.js';
import { logger } from '../utils/logger.js';

/**
 * MediaConvert webhook event types
 */
export type MediaConvertEventType =
  | 'JOB_COMPLETE'
  | 'JOB_ERROR'
  | 'JOB_PROGRESSING'
  | 'JOB_SUBMITTED'
  | 'JOB_CANCELED';

// Using MediaConvertWebhookPayload from aws.ts types

/**
 * Processed webhook data for application use
 */
export interface ProcessedWebhookData {
  jobId: string;
  status: 'completed' | 'failed' | 'progressing' | 'submitted' | 'canceled';
  eventType: MediaConvertEventType;
  outputs?: Array<{
    resolution: string;
    url: string;
    bitrate: number;
    fileSize?: number;
    duration?: number;
    width?: number;
    height?: number;
  }>;
  errorMessage?: string;
  errorCode?: number;
  userMetadata?: Record<string, string>;
  warnings?: Array<{
    code: number;
    count: number;
  }>;
}

/**
 * Webhook handler interface for dependency injection
 */
export interface IWebhookHandler {
  handleTranscodingComplete(data: ProcessedWebhookData): Promise<void>;
}

/**
 * MediaConvert Webhook Handler
 *
 * Processes MediaConvert CloudWatch Events and updates video processing status.
 */
export class MediaConvertWebhookHandler {
  constructor(private readonly webhookHandler: IWebhookHandler) {}

  /**
   * Handles MediaConvert webhook requests
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      logger.info('Received MediaConvert webhook', {
        headers: request.headers,
        userAgent: request.headers['user-agent'],
        contentType: request.headers['content-type'],
      });

      // Validate webhook signature if configured
      if (process.env['MEDIACONVERT_WEBHOOK_SECRET']) {
        this.validateWebhookSignature(request);
      }

      // Parse and validate payload
      const payload = this.parseWebhookPayload(request.body as Record<string, unknown>);
      const processedData = this.processWebhookPayload(payload);

      logger.info('Processing MediaConvert webhook', {
        jobId: processedData.jobId,
        status: processedData.status,
        eventType: processedData.eventType,
        outputCount: processedData.outputs?.length || 0,
      });

      // Handle the webhook based on event type
      await this.handleWebhookEvent(processedData);

      // Send success response
      await reply.code(200).send({
        success: true,
        message: 'Webhook processed successfully',
        jobId: processedData.jobId,
        status: processedData.status,
      });

      logger.info('MediaConvert webhook processed successfully', {
        jobId: processedData.jobId,
        status: processedData.status,
      });
    } catch (error) {
      logger.error('Failed to process MediaConvert webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof ValidationError) {
        await reply.code(400).send({
          success: false,
          error: 'Invalid webhook payload',
          message: error.message,
        });
      } else {
        await reply.code(500).send({
          success: false,
          error: 'Internal server error',
          message: 'Failed to process webhook',
        });
      }
    }
  }

  /**
   * Validates webhook signature for security
   */
  private validateWebhookSignature(request: FastifyRequest): void {
    const signature = request.headers['x-amz-sns-signature'] as string;
    const webhookSecret = process.env['MEDIACONVERT_WEBHOOK_SECRET'];

    if (!signature) {
      throw new ValidationError('Missing webhook signature');
    }

    if (!webhookSecret) {
      throw new ValidationError('Webhook secret not configured');
    }

    // TODO: Implement proper signature validation
    // This would typically involve verifying the SNS signature
    // For now, we'll do a simple check
    if (signature.length < 10) {
      throw new ValidationError('Invalid webhook signature');
    }
  }

  /**
   * Parses and validates the webhook payload
   */
  private parseWebhookPayload(body: Record<string, unknown>): MediaConvertWebhookPayload {
    if (!body) {
      throw new ValidationError('Empty webhook payload');
    }

    // Handle SNS message wrapper
    let payload = body;
    if (body['Type'] === 'Notification' && typeof body['Message'] === 'string') {
      try {
        payload = JSON.parse(body['Message']) as Record<string, unknown>;
      } catch (error) {
        throw new ValidationError('Invalid SNS message format');
      }
    }

    // Validate required fields
    const detail = payload['detail'] as Record<string, unknown>;
    if (!detail || typeof detail['jobId'] !== 'string') {
      throw new ValidationError('Missing required field: detail.jobId');
    }

    if (!detail['status']) {
      throw new ValidationError('Missing required field: detail.status');
    }

    if (!payload['source'] || payload['source'] !== 'aws.mediaconvert') {
      throw new ValidationError('Invalid webhook source');
    }

    return payload as unknown as MediaConvertWebhookPayload;
  }

  /**
   * Processes webhook payload into application-friendly format
   */
  private processWebhookPayload(payload: MediaConvertWebhookPayload): ProcessedWebhookData {
    const eventType = this.mapEventType(payload['detail-type']);
    const status = this.mapStatus(payload.detail.status);

    const processedData: ProcessedWebhookData = {
      jobId: payload.detail.jobId,
      status,
      eventType,
      userMetadata: payload.detail.userMetadata,
      errorMessage: payload.detail.errorMessage || undefined,
      errorCode: payload.detail.errorCode || undefined,
      warnings: payload.detail.warnings || undefined,
    };

    // Process outputs for completed jobs
    if (status === 'completed' && payload.detail.outputGroupDetails) {
      processedData.outputs = this.extractOutputs(payload.detail.outputGroupDetails);
    }

    return processedData;
  }

  /**
   * Maps MediaConvert event type to application event type
   */
  private mapEventType(detailType: string): MediaConvertEventType {
    switch (detailType) {
      case 'MediaConvert Job State Change':
        return 'JOB_COMPLETE'; // Will be refined based on status
      default:
        return 'JOB_PROGRESSING';
    }
  }

  /**
   * Maps MediaConvert status to application status
   */
  private mapStatus(status: string): ProcessedWebhookData['status'] {
    switch (status.toUpperCase()) {
      case 'COMPLETE':
        return 'completed';
      case 'ERROR':
        return 'failed';
      case 'PROGRESSING':
        return 'progressing';
      case 'SUBMITTED':
        return 'submitted';
      case 'CANCELED':
        return 'canceled';
      default:
        return 'progressing';
    }
  }

  /**
   * Extracts output information from MediaConvert job details
   */
  private extractOutputs(
    outputGroupDetails: MediaConvertWebhookPayload['detail']['outputGroupDetails']
  ): ProcessedWebhookData['outputs'] {
    const outputs: ProcessedWebhookData['outputs'] = [];

    if (!outputGroupDetails) {
      return outputs;
    }

    for (const outputGroup of outputGroupDetails) {
      for (const outputDetail of outputGroup.outputDetails) {
        for (const filePath of outputDetail.outputFilePaths) {
          // Extract resolution from file path (e.g., "_1080p.m3u8")
          const resolutionMatch = filePath.match(/_(\d+p)\.m3u8$/);
          const resolution = resolutionMatch ? resolutionMatch[1] : 'unknown';

          // Estimate bitrate based on resolution (this is approximate)
          const bitrate = this.estimateBitrateFromResolution(resolution || 'unknown');

          outputs.push({
            resolution: resolution || 'unknown',
            url: filePath,
            bitrate,
            duration: outputDetail.durationInMs,
            width: outputDetail.videoDetails?.widthInPx,
            height: outputDetail.videoDetails?.heightInPx,
          });
        }
      }
    }

    return outputs;
  }

  /**
   * Estimates bitrate from resolution (fallback when not provided)
   */
  private estimateBitrateFromResolution(resolution: string): number {
    switch (resolution) {
      case '1080p':
        return 5000000; // 5 Mbps
      case '720p':
        return 3000000; // 3 Mbps
      case '480p':
        return 1500000; // 1.5 Mbps
      case '360p':
        return 800000; // 800 Kbps
      default:
        return 2000000; // 2 Mbps default
    }
  }

  /**
   * Handles webhook events based on type and status
   */
  private async handleWebhookEvent(data: ProcessedWebhookData): Promise<void> {
    switch (data.status) {
      case 'completed':
        await this.webhookHandler.handleTranscodingComplete(data);
        break;

      case 'failed':
        await this.webhookHandler.handleTranscodingComplete(data);
        break;

      case 'progressing':
        // Optionally update progress in database
        logger.info('MediaConvert job progressing', {
          jobId: data.jobId,
          status: data.status,
        });
        break;

      case 'submitted':
        logger.info('MediaConvert job submitted', {
          jobId: data.jobId,
          status: data.status,
        });
        break;

      case 'canceled':
        logger.info('MediaConvert job canceled', {
          jobId: data.jobId,
          status: data.status,
        });
        break;

      default:
        logger.warn('Unknown MediaConvert job status', {
          jobId: data.jobId,
          status: data.status,
        });
    }
  }
}

/**
 * Creates a Fastify route handler for MediaConvert webhooks
 */
export function createWebhookRoute(
  webhookHandler: IWebhookHandler
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const handler = new MediaConvertWebhookHandler(webhookHandler);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await handler.handleWebhook(request, reply);
  };
}

/**
 * Webhook route configuration for Fastify
 */
export const webhookRouteConfig = {
  method: 'POST' as const,
  url: '/webhooks/mediaconvert',
  schema: {
    description: 'MediaConvert job completion webhook',
    tags: ['webhooks'],
    body: {
      type: 'object',
      additionalProperties: true,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          jobId: { type: 'string' },
          status: { type: 'string' },
        },
      },
      400: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      500: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};
