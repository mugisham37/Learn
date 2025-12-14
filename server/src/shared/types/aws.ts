/**
 * AWS Service Type Definitions
 *
 * Common type definitions for AWS services used across the application
 */

/**
 * MediaConvert webhook payload structure
 */
export interface MediaConvertWebhookPayload {
  version: string;
  id: string;
  'detail-type': string;
  source: string;
  account: string;
  time: string;
  region: string;
  detail: {
    timestamp: number;
    accountId: string;
    queue: string;
    jobId: string;
    status: 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'CANCELED' | 'ERROR';
    userMetadata?: Record<string, string>;
    outputGroupDetails?: Array<{
      outputDetails: Array<{
        outputFilePaths: string[];
        durationInMs: number;
        videoDetails?: {
          widthInPx: number;
          heightInPx: number;
        };
      }>;
    }>;
    // Error-specific properties (only present when status is ERROR)
    errorMessage?: string;
    errorCode?: number;
    warnings?: Array<{
      code: number;
      count: number;
    }>;
  };
}

/**
 * SNS message structure for MediaConvert webhooks
 */
export interface SNSMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL: string;
}

/**
 * CloudWatch metric data point
 */
export interface CloudWatchMetricDataPoint {
  timestamp: Date;
  value: number;
  unit?: string;
}

/**
 * CloudWatch metric definition
 */
export interface CloudWatchMetric {
  namespace: string;
  metricName: string;
  dimensions?: Array<{
    name: string;
    value: string;
  }>;
  unit?: string;
}

/**
 * S3 object metadata
 */
export interface S3ObjectMetadata {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * SES email sending result
 */
export interface SESEmailResult {
  messageId: string;
  success: boolean;
  error?: string;
}
