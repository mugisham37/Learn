/**
 * S3 Service Implementation
 * 
 * Implements S3 file operations using AWS SDK v3.
 * Handles file uploads, deletions, and presigned URL generation.
 */

import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  PutObjectCommandInput 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config/index.js';
import { secrets } from '../utils/secureConfig.js';
import { ExternalServiceError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { 
  IS3Service, 
  UploadFileParams, 
  UploadFileResult, 
  PresignedUrlParams 
} from './IS3Service.js';

/**
 * S3 Service Implementation
 * 
 * Provides S3 file operations with error handling and logging.
 */
export class S3Service implements IS3Service {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const awsConfig = secrets.getAwsConfig();
    this.client = new S3Client({
      region: config.s3.bucketRegion,
      credentials: awsConfig.accessKeyId && awsConfig.secretAccessKey ? {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      } : undefined, // Use default credential chain if not provided
    });
    this.bucketName = config.s3.bucketName;

    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }
  }

  /**
   * Uploads a file to S3
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    try {
      logger.info('Uploading file to S3', {
        key: params.key,
        contentType: params.contentType,
        size: params.buffer.length,
      });

      const putObjectParams: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
        Metadata: params.metadata,
      };

      const command = new PutObjectCommand(putObjectParams);
      const result = await this.client.send(command);

      const uploadResult: UploadFileResult = {
        key: params.key,
        url: this.getPublicUrl(params.key),
        etag: result.ETag || '',
      };

      logger.info('File uploaded successfully to S3', {
        key: params.key,
        etag: result.ETag,
      });

      return uploadResult;
    } catch (error) {
      logger.error('Failed to upload file to S3', {
        key: params.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'AWS S3',
        `Failed to upload file: ${params.key}`,
        error instanceof Error ? error : new Error('Unknown S3 error')
      );
    }
  }

  /**
   * Deletes a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      logger.info('Deleting file from S3', { key });

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);

      logger.info('File deleted successfully from S3', { key });
    } catch (error) {
      logger.error('Failed to delete file from S3', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'AWS S3',
        `Failed to delete file: ${key}`,
        error instanceof Error ? error : new Error('Unknown S3 error')
      );
    }
  }

  /**
   * Generates a presigned URL for file upload
   */
  async generatePresignedUrl(params: PresignedUrlParams): Promise<string> {
    try {
      logger.info('Generating presigned URL', {
        key: params.key,
        expiresIn: params.expiresIn,
      });

      const putObjectParams: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: params.key,
        ContentType: params.contentType,
      };

      const command = new PutObjectCommand(putObjectParams);
      const presignedUrl = await getSignedUrl(this.client, command, {
        expiresIn: params.expiresIn,
      });

      logger.info('Presigned URL generated successfully', {
        key: params.key,
      });

      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned URL', {
        key: params.key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'AWS S3',
        `Failed to generate presigned URL for: ${params.key}`,
        error instanceof Error ? error : new Error('Unknown S3 error')
      );
    }
  }

  /**
   * Checks if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }

      logger.error('Failed to check file existence in S3', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'AWS S3',
        `Failed to check file existence: ${key}`,
        error instanceof Error ? error : new Error('Unknown S3 error')
      );
    }
  }

  /**
   * Gets the public URL for a file
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${config.s3.bucketRegion}.amazonaws.com/${key}`;
  }
}