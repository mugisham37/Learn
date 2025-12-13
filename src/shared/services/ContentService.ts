/**
 * Content Service Implementation
 *
 * Implements content management operations combining S3 storage
 * with CloudFront CDN for optimal content delivery.
 */

import { randomUUID } from 'crypto';

import { ExternalServiceError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

import { ICloudFrontService } from './ICloudFrontService.js';
import {
  IContentService,
  ContentUploadParams,
  ContentUploadResult,
  StreamingUrlParams,
  StreamingUrlResult,
  ContentDeleteParams,
} from './IContentService.js';
import { IS3Service } from './IS3Service.js';

/**
 * Content Service Implementation
 *
 * Provides high-level content management operations with
 * S3 storage and CloudFront CDN integration.
 */
export class ContentService implements IContentService {
  constructor(
    private readonly s3Service: IS3Service,
    private readonly cloudFrontService: ICloudFrontService
  ) {}

  /**
   * Generates a presigned upload URL for content
   */
  async generateUploadUrl(params: ContentUploadParams): Promise<ContentUploadResult> {
    try {
      logger.info('Generating content upload URL', {
        userId: params.userId,
        fileName: params.fileName,
        fileType: params.fileType,
        isPrivate: params.isPrivate,
      });

      // Generate unique S3 key
      const s3Key = this.generateContentKey(params.userId, params.fileName, params.fileType);

      // Generate presigned URL for upload (1 hour expiration)
      const expiresIn = 3600; // 1 hour
      const uploadUrl = await this.s3Service.generatePresignedUrl({
        key: s3Key,
        expiresIn,
        contentType: params.contentType,
      });

      const result: ContentUploadResult = {
        key: s3Key,
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      // Add public URL if content is not private
      if (!params.isPrivate) {
        result.publicUrl = this.getPublicUrl(s3Key, true);
      }

      logger.info('Content upload URL generated successfully', {
        userId: params.userId,
        s3Key,
        hasPublicUrl: !!result.publicUrl,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate content upload URL', {
        userId: params.userId,
        fileName: params.fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to generate upload URL',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Generates a streaming URL for video content
   */
  async generateStreamingUrl(params: StreamingUrlParams): Promise<StreamingUrlResult> {
    try {
      logger.info('Generating streaming URL', {
        s3Key: params.s3Key,
        userId: params.userId,
        expiresIn: params.expiresIn,
        hasIpRestriction: !!params.ipAddress,
      });

      const expiresIn = params.expiresIn || 3600; // Default 1 hour
      const cloudFrontUrl = this.cloudFrontService.getCloudFrontUrl(params.s3Key);

      let streamingUrl: string;

      // Use CloudFront signed URL if configured, otherwise use S3 presigned URL
      if (this.cloudFrontService.isConfigured()) {
        streamingUrl = await this.cloudFrontService.generateSignedUrl({
          url: cloudFrontUrl,
          expiresIn,
          ipAddress: params.ipAddress,
        });
      } else {
        logger.warn('CloudFront not configured, falling back to S3 presigned URL', {
          s3Key: params.s3Key,
        });

        streamingUrl = await this.s3Service.generatePresignedUrl({
          key: params.s3Key,
          expiresIn,
        });
      }

      const result: StreamingUrlResult = {
        url: streamingUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      logger.info('Streaming URL generated successfully', {
        s3Key: params.s3Key,
        userId: params.userId,
        expiresAt: result.expiresAt,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate streaming URL', {
        s3Key: params.s3Key,
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to generate streaming URL',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets the public URL for content
   */
  getPublicUrl(s3Key: string, useCloudFront = true): string {
    if (useCloudFront && this.cloudFrontService.isConfigured()) {
      return this.cloudFrontService.getCloudFrontUrl(s3Key);
    }

    return this.s3Service.getPublicUrl(s3Key);
  }

  /**
   * Deletes content from storage
   */
  async deleteContent(params: ContentDeleteParams): Promise<void> {
    try {
      logger.info('Deleting content', {
        s3Key: params.s3Key,
        userId: params.userId,
      });

      await this.s3Service.deleteFile(params.s3Key);

      logger.info('Content deleted successfully', {
        s3Key: params.s3Key,
        userId: params.userId,
      });
    } catch (error) {
      logger.error('Failed to delete content', {
        s3Key: params.s3Key,
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to delete content',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Checks if content exists
   */
  async contentExists(s3Key: string): Promise<boolean> {
    try {
      return await this.s3Service.fileExists(s3Key);
    } catch (error) {
      logger.error('Failed to check content existence', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to check content existence',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Generates S3 key for content based on user and file info
   */
  generateContentKey(userId: string, fileName: string, fileType: string): string {
    const timestamp = Date.now();
    const uuid = randomUUID();
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();

    // Structure: fileType/userId/year/month/uuid-timestamp-filename
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${fileType}/${userId}/${year}/${month}/${uuid}-${timestamp}-${sanitizedFileName}`;
  }
}
