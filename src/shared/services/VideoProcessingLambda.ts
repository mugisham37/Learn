/**
 * Video Processing Lambda Function
 * 
 * AWS Lambda function handler for S3 upload triggers that initiates
 * MediaConvert transcoding jobs when videos are uploaded.
 * 
 * Requirements:
 * - 4.2: MediaConvert transcoding initiation on S3 upload
 * - 4.3: Transcoding job creation with retry logic
 * - 4.4: Processing status tracking
 */

import { S3Event, S3Handler, Context } from 'aws-lambda';
import { MediaConvertService } from './MediaConvertService.js';
import { IMediaConvertService, DEFAULT_TRANSCODING_RESOLUTIONS } from './IMediaConvertService.js';
import { logger } from '../utils/logger.js';

/**
 * Lambda function configuration
 */
interface LambdaConfig {
  outputS3Bucket: string;
  mediaConvertRoleArn: string;
  mediaConvertQueueArn: string;
  webhookUrl?: string;
}

/**
 * Video processing result
 */
interface ProcessingResult {
  success: boolean;
  jobId?: string;
  error?: string;
  inputS3Key: string;
  outputS3KeyPrefix: string;
}

/**
 * Lambda function handler for video processing
 * 
 * This function is triggered by S3 upload events and initiates
 * MediaConvert transcoding jobs for video files.
 */
export const handler: S3Handler = async (event: S3Event, context: Context) => {
  logger.info('Video processing Lambda triggered', {
    requestId: context.awsRequestId,
    eventRecordCount: event.Records.length,
  });

  const results: ProcessingResult[] = [];
  const mediaConvertService: IMediaConvertService = new MediaConvertService();

  // Process each S3 record
  for (const record of event.Records) {
    try {
      const result = await processS3Record(record, mediaConvertService);
      results.push(result);
    } catch (error) {
      logger.error('Failed to process S3 record', {
        bucket: record.s3.bucket.name,
        key: record.s3.object.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        inputS3Key: record.s3.object.key,
        outputS3KeyPrefix: '',
      });
    }
  }

  // Log summary
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  logger.info('Video processing Lambda completed', {
    requestId: context.awsRequestId,
    totalRecords: results.length,
    successCount,
    failureCount,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Video processing completed',
      results,
      summary: {
        total: results.length,
        success: successCount,
        failures: failureCount,
      },
    }),
  };
};

/**
 * Processes a single S3 record
 */
async function processS3Record(
  record: S3Event['Records'][0],
  mediaConvertService: IMediaConvertService
): Promise<ProcessingResult> {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  logger.info('Processing S3 record', {
    bucket,
    key,
    eventName: record.eventName,
    size: record.s3.object.size,
  });

  // Check if this is a video file
  if (!isVideoFile(key)) {
    logger.info('Skipping non-video file', { key });
    return {
      success: true,
      inputS3Key: key,
      outputS3KeyPrefix: '',
    };
  }

  // Check if this is in the correct directory (e.g., video uploads)
  if (!key.startsWith('video/')) {
    logger.info('Skipping file not in video directory', { key });
    return {
      success: true,
      inputS3Key: key,
      outputS3KeyPrefix: '',
    };
  }

  // Generate output key prefix
  const outputS3KeyPrefix = generateOutputKeyPrefix(key);
  const jobName = generateJobName(key);

  // Get configuration from environment variables
  const config = getLambdaConfig();

  try {
    // Create MediaConvert transcoding job
    const jobResult = await mediaConvertService.createTranscodingJob({
      inputS3Bucket: bucket,
      inputS3Key: key,
      outputS3Bucket: config.outputS3Bucket,
      outputS3KeyPrefix,
      jobName,
      resolutions: DEFAULT_TRANSCODING_RESOLUTIONS,
      hlsSegmentDuration: 6,
      thumbnailGeneration: true,
      metadata: {
        originalBucket: bucket,
        originalKey: key,
        processedAt: new Date().toISOString(),
        lambdaRequestId: process.env['AWS_REQUEST_ID'] || '',
      },
    });

    logger.info('MediaConvert job created successfully', {
      jobId: jobResult.jobId,
      inputS3Key: key,
      outputS3KeyPrefix,
    });

    // Optionally send webhook notification
    if (config.webhookUrl) {
      await sendWebhookNotification(config.webhookUrl, {
        event: 'job_created',
        jobId: jobResult.jobId,
        inputS3Key: key,
        outputS3KeyPrefix,
        status: jobResult.status,
      });
    }

    return {
      success: true,
      jobId: jobResult.jobId,
      inputS3Key: key,
      outputS3KeyPrefix,
    };
  } catch (error) {
    logger.error('Failed to create MediaConvert job', {
      inputS3Key: key,
      outputS3KeyPrefix,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Checks if a file is a video based on its extension
 */
function isVideoFile(key: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
  const extension = key.toLowerCase().substring(key.lastIndexOf('.'));
  return videoExtensions.includes(extension);
}

/**
 * Generates output S3 key prefix for processed videos
 */
function generateOutputKeyPrefix(inputKey: string): string {
  // Remove file extension and add processed prefix
  const keyWithoutExtension = inputKey.substring(0, inputKey.lastIndexOf('.'));
  return `${keyWithoutExtension}_processed`;
}

/**
 * Generates a job name for MediaConvert
 */
function generateJobName(inputKey: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = inputKey.substring(inputKey.lastIndexOf('/') + 1, inputKey.lastIndexOf('.'));
  return `video-transcode-${fileName}-${timestamp}`;
}

/**
 * Gets Lambda configuration from environment variables
 */
function getLambdaConfig(): LambdaConfig {
  const config: LambdaConfig = {
    outputS3Bucket: process.env['OUTPUT_S3_BUCKET'] || process.env['S3_BUCKET_NAME'] || '',
    mediaConvertRoleArn: process.env['MEDIACONVERT_ROLE_ARN'] || '',
    mediaConvertQueueArn: process.env['MEDIACONVERT_QUEUE_ARN'] || '',
    webhookUrl: process.env['WEBHOOK_URL'],
  };

  // Validate required configuration
  if (!config.outputS3Bucket) {
    throw new Error('OUTPUT_S3_BUCKET or S3_BUCKET_NAME environment variable is required');
  }

  if (!config.mediaConvertRoleArn) {
    throw new Error('MEDIACONVERT_ROLE_ARN environment variable is required');
  }

  if (!config.mediaConvertQueueArn) {
    throw new Error('MEDIACONVERT_QUEUE_ARN environment variable is required');
  }

  return config;
}

/**
 * Sends webhook notification about job status
 */
async function sendWebhookNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'learning-platform-video-processor/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    logger.info('Webhook notification sent successfully', {
      webhookUrl,
      status: response.status,
    });
  } catch (error) {
    logger.error('Failed to send webhook notification', {
      webhookUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw error - webhook failure shouldn't fail the main process
  }
}

/**
 * Lambda deployment configuration
 */
export const lambdaConfig = {
  functionName: 'learning-platform-video-processor',
  runtime: 'nodejs20.x',
  handler: 'VideoProcessingLambda.handler',
  timeout: 300, // 5 minutes
  memorySize: 512,
  environment: {
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
  },
  permissions: [
    {
      service: 's3',
      actions: ['s3:GetObject'],
      resources: ['arn:aws:s3:::*/*'],
    },
    {
      service: 'mediaconvert',
      actions: ['mediaconvert:*'],
      resources: ['*'],
    },
    {
      service: 'iam',
      actions: ['iam:PassRole'],
      resources: ['arn:aws:iam::*:role/MediaConvertRole'],
    },
    {
      service: 'logs',
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['arn:aws:logs:*:*:*'],
    },
  ],
  triggers: [
    {
      type: 's3',
      bucket: '${S3_BUCKET_NAME}',
      events: ['s3:ObjectCreated:*'],
      filterPrefix: 'video/',
      filterSuffix: '',
    },
  ],
};