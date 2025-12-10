/**
 * Content Service Implementation
 * 
 * Implements content management operations for the application layer.
 * Handles video uploads, processing, streaming URLs, and file management.
 * 
 * Requirements:
 * - 4.1: Video upload with presigned URLs and S3 integration
 * - 4.4: Video processing status tracking and completion handling
 * - 4.5: Streaming URL generation with signed URLs
 */

import { randomUUID } from 'crypto';
import { extname } from 'path';
import { logger } from '../../../../shared/utils/logger.js';
import { 
  ValidationError, 
  NotFoundError, 
  AuthorizationError,
  ExternalServiceError 
} from '../../../../shared/errors/index.js';
import { IContentRepository } from '../../infrastructure/repositories/IContentRepository.js';
import { IS3Service } from '../../../../shared/services/IS3Service.js';
import { ICloudFrontService } from '../../../../shared/services/ICloudFrontService.js';
import { IMediaConvertService } from '../../../../shared/services/IMediaConvertService.js';
import { VideoProcessingService } from '../../../../shared/services/VideoProcessingService.js';
import { 
  VideoAsset as VideoAssetData, 
  FileAsset as FileAssetData, 
  ProcessingJob as ProcessingJobData,
  NewVideoAsset,
  NewFileAsset,
  AssetType 
} from '../../../../infrastructure/database/schema/content.schema.js';
import { VideoAsset, FileAsset, ProcessingJob } from '../../domain/entities/index.js';
import {
  IContentService,
  GenerateUploadUrlParams,
  PresignedUploadUrl,
  VideoUploadParams,
  TranscodingCompleteParams,
  GenerateStreamingUrlParams,
  SignedUrl,
  UploadCourseResourceParams,
  DeleteContentParams
} from './IContentService.js';

/**
 * Content Service Implementation
 * 
 * Provides application-level content management operations with
 * comprehensive error handling and logging.
 */
export class ContentService implements IContentService {
  private videoProcessingService: VideoProcessingService;

  constructor(
    private readonly contentRepository: IContentRepository,
    private readonly s3Service: IS3Service,
    private readonly cloudFrontService: ICloudFrontService,
    private readonly mediaConvertService: IMediaConvertService
  ) {
    this.videoProcessingService = new VideoProcessingService(
      this.contentRepository,
      this.mediaConvertService
    );
  }

  /**
   * Initializes the content service and video processing
   */
  async initialize(): Promise<void> {
    await this.videoProcessingService.initialize();
  }

  /**
   * Generates a presigned URL for content upload
   */
  async generateUploadUrl(params: GenerateUploadUrlParams): Promise<PresignedUploadUrl> {
    try {
      logger.info('Generating upload URL', {
        userId: params.userId,
        fileName: params.fileName,
        fileType: params.fileType,
        lessonId: params.lessonId,
        courseId: params.courseId,
      });

      // Validate parameters
      this.validateUploadParams(params);

      // Generate unique S3 key
      const s3Key = this.generateS3Key(params.userId, params.fileName, params.fileType);
      const s3Bucket = process.env['S3_BUCKET_NAME']!;

      // Generate presigned URL (1 hour expiration)
      const expiresIn = 3600;
      const uploadUrl = await this.s3Service.generatePresignedUrl({
        key: s3Key,
        expiresIn,
        contentType: params.contentType,
      });

      const result: PresignedUploadUrl = {
        uploadUrl,
        s3Key,
        s3Bucket,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      // Create database record based on file type
      if (params.fileType === 'video') {
        const videoAsset = await this.createVideoAssetRecord({
          lessonId: params.lessonId,
          uploadedBy: params.userId,
          originalFileName: params.fileName,
          originalFileSize: 0, // Will be updated after upload
          mimeType: params.contentType,
          s3Bucket,
          s3Key,
          s3Region: process.env['S3_BUCKET_REGION'] || 'us-east-1',
          processingStatus: 'pending',
        });
        result.videoAssetId = videoAsset.id;
      } else {
        const fileAsset = await this.createFileAssetRecord({
          courseId: params.courseId,
          lessonId: params.lessonId,
          uploadedBy: params.userId,
          fileName: params.fileName,
          originalFileName: params.fileName,
          fileSize: 0, // Will be updated after upload
          mimeType: params.contentType,
          assetType: this.mapFileTypeToAssetType(params.fileType),
          s3Bucket,
          s3Key,
          s3Region: process.env['S3_BUCKET_REGION'] || 'us-east-1',
          isPublic: false,
          accessLevel: 'course',
          processingStatus: 'completed',
        });
        result.fileAssetId = fileAsset.id;
      }

      logger.info('Upload URL generated successfully', {
        userId: params.userId,
        s3Key,
        videoAssetId: result.videoAssetId,
        fileAssetId: result.fileAssetId,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate upload URL', {
        userId: params.userId,
        fileName: params.fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
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
   * Handles video upload completion and initiates processing
   */
  async handleVideoUpload(params: VideoUploadParams): Promise<ProcessingJob> {
    try {
      logger.info('Handling video upload', {
        s3Key: params.s3Key,
        uploadedBy: params.uploadedBy,
        fileSize: params.fileSize,
      });

      // Find the video asset record
      const videoAsset = await this.contentRepository.findVideoAssetByS3Key(
        params.s3Bucket,
        params.s3Key
      );

      if (!videoAsset) {
        throw new NotFoundError('Video asset not found for S3 key');
      }

      // Update video asset with actual file information
      await this.contentRepository.updateVideoAsset(videoAsset.id, {
        originalFileSize: params.fileSize,
        processingStatus: 'pending',
        metadata: {
          ...(videoAsset.metadata as Record<string, any> || {}),
          ...params.metadata,
          uploadCompletedAt: new Date().toISOString(),
        },
      });

      // Use the new video processing service to handle the workflow
      const result = await this.videoProcessingService.processVideoUpload({
        videoAssetId: videoAsset.id,
        s3Bucket: params.s3Bucket,
        s3Key: params.s3Key,
        uploadedBy: params.uploadedBy,
        originalFileName: params.originalFileName,
        fileSize: params.fileSize,
        metadata: params.metadata,
      });

      // Find the processing job that was created
      const processingJob = result.processingJobId 
        ? await this.contentRepository.findProcessingJobById(result.processingJobId)
        : null;

      if (!processingJob) {
        throw new ExternalServiceError(
          'Content Service',
          'Processing job not found after creation',
          new Error('Processing job creation failed')
        );
      }

      logger.info('Video upload handled successfully', {
        videoAssetId: videoAsset.id,
        processingJobId: processingJob.id,
        queueJobId: result.queueJobId,
      });

      return this.mapToProcessingJobEntity(processingJob);
    } catch (error) {
      logger.error('Failed to handle video upload', {
        s3Key: params.s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to handle video upload',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Handles transcoding completion webhook
   */
  async handleTranscodingComplete(params: TranscodingCompleteParams): Promise<VideoAsset> {
    try {
      logger.info('Handling transcoding completion', {
        jobId: params.jobId,
        status: params.status,
        outputCount: params.outputs?.length || 0,
      });

      // Find processing job
      const processingJob = await this.contentRepository.findProcessingJobByExternalId(params.jobId);
      if (!processingJob) {
        throw new NotFoundError(`Processing job not found: ${params.jobId}`);
      }

      // Find associated video asset
      if (!processingJob.videoAssetId) {
        throw new ValidationError('Processing job has no associated video asset');
      }

      const videoAsset = await this.contentRepository.findVideoAssetById(processingJob.videoAssetId);
      if (!videoAsset) {
        throw new NotFoundError('Video asset not found for processing job');
      }

      // Update processing job status
      await this.contentRepository.updateProcessingJobStatus(
        processingJob.id,
        params.status === 'completed' ? 'completed' : 'failed',
        params.status === 'completed' ? 100 : undefined,
        params.outputs ? { outputs: params.outputs } : undefined,
        params.errorMessage
      );

      // Update video asset based on transcoding result
      if (params.status === 'completed' && params.outputs) {
        const availableResolutions = params.outputs.map(output => ({
          resolution: output.resolution,
          url: output.url,
          bitrate: output.bitrate,
          fileSize: output.fileSize,
        }));

        const streamingUrls = params.outputs.reduce((urls, output) => {
          urls[output.resolution] = output.url;
          return urls;
        }, {} as Record<string, string>);

        // Find HLS manifest URL (usually the highest resolution or master playlist)
        const hlsManifestUrl = params.outputs.find(o => o.resolution === '1080p')?.url || 
                              params.outputs[0]?.url;

        const updatedVideoAssetData = await this.contentRepository.updateVideoAssetProcessingStatus(
          videoAsset.id,
          'completed',
          {
            availableResolutions,
            streamingUrls,
            hlsManifestUrl,
            processingCompletedAt: new Date().toISOString(),
          }
        );

        logger.info('Video transcoding completed successfully', {
          videoAssetId: videoAsset.id,
          resolutionCount: availableResolutions.length,
        });

        return this.mapToVideoAssetEntity(updatedVideoAssetData);
      } else {
        // Handle failed transcoding
        const updatedVideoAssetData = await this.contentRepository.updateVideoAssetProcessingStatus(
          videoAsset.id,
          'failed',
          {
            errorMessage: params.errorMessage,
            processingCompletedAt: new Date().toISOString(),
          }
        );

        logger.error('Video transcoding failed', {
          videoAssetId: videoAsset.id,
          errorMessage: params.errorMessage,
        });

        return this.mapToVideoAssetEntity(updatedVideoAssetData);
      }
    } catch (error) {
      logger.error('Failed to handle transcoding completion', {
        jobId: params.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to handle transcoding completion',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Generates a streaming URL for video content
   */
  async generateStreamingUrl(params: GenerateStreamingUrlParams): Promise<SignedUrl> {
    try {
      logger.info('Generating streaming URL', {
        lessonId: params.lessonId,
        userId: params.userId,
        expiresIn: params.expiresIn,
      });

      // Find video asset for the lesson
      const videoAssets = await this.contentRepository.findVideoAssets({
        lessonId: params.lessonId,
      });

      if (videoAssets.items.length === 0) {
        throw new NotFoundError('No video found for lesson');
      }

      const videoAsset = videoAssets.items[0];
      if (!videoAsset) {
        throw new NotFoundError('Video asset not found');
      }

      // Check if video processing is complete
      if (videoAsset.processingStatus !== 'completed') {
        throw new ValidationError('Video is not ready for streaming');
      }

      if (!videoAsset.hlsManifestUrl) {
        throw new ValidationError('Video streaming URL not available');
      }

      // TODO: Add authorization check - verify user has access to the lesson
      // This would typically involve checking enrollment status

      // Determine expiration time (default to lesson duration or 1 hour)
      const defaultExpiresIn = videoAsset.durationSeconds || 3600;
      const expiresIn = params.expiresIn || defaultExpiresIn;

      let streamingUrl: string;

      // Generate signed URL using CloudFront if configured, otherwise S3
      if (this.cloudFrontService.isConfigured()) {
        streamingUrl = await this.cloudFrontService.generateSignedUrl({
          url: videoAsset.hlsManifestUrl,
          expiresIn,
          ipAddress: params.ipAddress,
        });
      } else {
        // Extract S3 key from HLS manifest URL for S3 presigned URL
        const s3Key = this.extractS3KeyFromUrl(videoAsset.hlsManifestUrl);
        streamingUrl = await this.s3Service.generatePresignedUrl({
          key: s3Key,
          expiresIn,
        });
      }

      const result: SignedUrl = {
        url: streamingUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      };

      logger.info('Streaming URL generated successfully', {
        lessonId: params.lessonId,
        userId: params.userId,
        expiresAt: result.expiresAt,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate streaming URL', {
        lessonId: params.lessonId,
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
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
   * Uploads a course resource file
   */
  async uploadCourseResource(params: UploadCourseResourceParams): Promise<FileAsset> {
    try {
      logger.info('Uploading course resource', {
        courseId: params.courseId,
        lessonId: params.lessonId,
        userId: params.userId,
        fileName: params.fileName,
        fileSize: params.fileBuffer.length,
      });

      // Validate file
      this.validateFileUpload(params.fileName, params.fileBuffer, params.contentType);

      // Generate S3 key
      const s3Key = this.generateS3Key(params.userId, params.fileName, 'document');
      const s3Bucket = process.env['S3_BUCKET_NAME']!;

      // Upload to S3
      await this.s3Service.uploadFile({
        key: s3Key,
        buffer: params.fileBuffer,
        contentType: params.contentType,
        metadata: {
          uploadedBy: params.userId,
          courseId: params.courseId,
          lessonId: params.lessonId || '',
        },
      });

      // Create file asset record
      const fileAsset = await this.createFileAssetRecord({
        courseId: params.courseId,
        lessonId: params.lessonId,
        uploadedBy: params.userId,
        fileName: params.fileName,
        originalFileName: params.fileName,
        fileSize: params.fileBuffer.length,
        mimeType: params.contentType,
        assetType: this.getAssetTypeFromMimeType(params.contentType),
        s3Bucket,
        s3Key,
        s3Region: process.env['S3_BUCKET_REGION'] || 'us-east-1',
        isPublic: params.isPublic || false,
        accessLevel: 'course',
        description: params.description,
        processingStatus: 'completed',
      });

      logger.info('Course resource uploaded successfully', {
        fileAssetId: fileAsset.id,
        s3Key,
      });

      return fileAsset;
    } catch (error) {
      logger.error('Failed to upload course resource', {
        courseId: params.courseId,
        fileName: params.fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to upload course resource',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets video processing status
   */
  async getVideoProcessingStatus(videoAssetId: string): Promise<{
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    queueJobId?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
    outputs?: Array<{
      resolution: string;
      url: string;
      bitrate: number;
      fileSize?: number;
    }>;
  }> {
    try {
      logger.debug('Getting video processing status', { videoAssetId });

      const statusInfo = await this.videoProcessingService.getProcessingStatus(videoAssetId);

      return {
        status: statusInfo.status,
        progress: statusInfo.progress,
        queueJobId: statusInfo.queueJobId,
        errorMessage: statusInfo.errorMessage,
        startedAt: statusInfo.startedAt,
        completedAt: statusInfo.completedAt,
        outputs: statusInfo.outputs,
      };
    } catch (error) {
      logger.error('Failed to get video processing status', {
        videoAssetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to get processing status',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Cancels video processing
   */
  async cancelVideoProcessing(videoAssetId: string): Promise<void> {
    try {
      logger.info('Cancelling video processing', { videoAssetId });

      await this.videoProcessingService.cancelProcessing(videoAssetId);

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
        'Content Service',
        'Failed to cancel processing',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Retries failed video processing
   */
  async retryVideoProcessing(videoAssetId: string): Promise<{
    queueJobId: string;
    processingJobId?: string;
  }> {
    try {
      logger.info('Retrying video processing', { videoAssetId });

      const result = await this.videoProcessingService.retryProcessing(videoAssetId);

      logger.info('Video processing retry initiated', {
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
        'Content Service',
        'Failed to retry processing',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets video processing queue statistics
   */
  async getProcessingQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      return await this.videoProcessingService.getQueueStats();
    } catch (error) {
      logger.error('Failed to get processing queue stats', {
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
   * Gracefully shuts down the content service
   */
  async shutdown(): Promise<void> {
    try {
      await this.videoProcessingService.shutdown();
      logger.info('Content service shut down successfully');
    } catch (error) {
      logger.error('Error during content service shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Deletes content from storage and database
   */
  async deleteContent(params: DeleteContentParams): Promise<void> {
    try {
      logger.info('Deleting content', {
        fileKey: params.fileKey,
        userId: params.userId,
      });

      // Find content by S3 key (could be video or file asset)
      const s3Bucket = process.env['S3_BUCKET_NAME']!;
      
      let videoAsset = await this.contentRepository.findVideoAssetByS3Key(s3Bucket, params.fileKey);
      let fileAsset = await this.contentRepository.findFileAssetByS3Key(s3Bucket, params.fileKey);

      if (!videoAsset && !fileAsset) {
        throw new NotFoundError('Content not found');
      }

      // Check authorization - user must own the content or be admin
      const contentOwnerId = videoAsset?.uploadedBy || fileAsset?.uploadedBy;
      if (contentOwnerId !== params.userId) {
        // TODO: Add admin role check here
        throw new AuthorizationError('User does not have permission to delete this content');
      }

      // Delete from S3
      await this.s3Service.deleteFile(params.fileKey);

      // Delete from database
      if (videoAsset) {
        await this.contentRepository.deleteVideoAsset(videoAsset.id);
      }
      if (fileAsset) {
        await this.contentRepository.deleteFileAsset(fileAsset.id);
      }

      logger.info('Content deleted successfully', {
        fileKey: params.fileKey,
        userId: params.userId,
      });
    } catch (error) {
      logger.error('Failed to delete content', {
        fileKey: params.fileKey,
        userId: params.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Content Service',
        'Failed to delete content',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  // Private helper methods

  private validateUploadParams(params: GenerateUploadUrlParams): void {
    if (!params.userId) {
      throw new ValidationError('User ID is required');
    }
    if (!params.fileName) {
      throw new ValidationError('File name is required');
    }
    if (!params.fileType) {
      throw new ValidationError('File type is required');
    }
    if (!params.contentType) {
      throw new ValidationError('Content type is required');
    }

    // Validate file extension matches content type
    const fileExtension = extname(params.fileName).toLowerCase();
    if (!this.isValidFileExtension(fileExtension, params.contentType)) {
      throw new ValidationError('File extension does not match content type');
    }
  }

  private validateFileUpload(fileName: string, buffer: Buffer, contentType: string): void {
    if (!fileName) {
      throw new ValidationError('File name is required');
    }
    if (buffer.length === 0) {
      throw new ValidationError('File cannot be empty');
    }
    if (buffer.length > 100 * 1024 * 1024) { // 100MB limit
      throw new ValidationError('File size exceeds maximum limit of 100MB');
    }

    const fileExtension = extname(fileName).toLowerCase();
    if (!this.isValidFileExtension(fileExtension, contentType)) {
      throw new ValidationError('Invalid file type');
    }
  }

  private isValidFileExtension(extension: string, contentType: string): boolean {
    const validExtensions: Record<string, string[]> = {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/webm': ['.webm'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    };

    const allowedExtensions = validExtensions[contentType];
    return allowedExtensions ? allowedExtensions.includes(extension) : false;
  }

  private generateS3Key(userId: string, fileName: string, fileType: string): string {
    const timestamp = Date.now();
    const uuid = randomUUID();
    const extension = extname(fileName).toLowerCase();
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${fileType}/${userId}/${year}/${month}/${uuid}-${timestamp}-${sanitizedFileName}`;
  }

  private mapFileTypeToAssetType(fileType: string): AssetType {
    switch (fileType) {
      case 'video': return 'video';
      case 'image': return 'image';
      case 'audio': return 'audio';
      case 'archive': return 'archive';
      default: return 'document';
    }
  }

  private getAssetTypeFromMimeType(mimeType: string): AssetType {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return 'archive';
    return 'document';
  }

  private extractS3KeyFromUrl(url: string): string {
    // Extract S3 key from CloudFront or S3 URL
    const urlParts = url.split('/');
    return urlParts.slice(3).join('/'); // Remove protocol and domain
  }

  private async createVideoAssetRecord(data: Omit<NewVideoAsset, 'id' | 'createdAt' | 'updatedAt'>): Promise<VideoAsset> {
    const videoData = await this.contentRepository.createVideoAsset(data);
    return this.mapToVideoAssetEntity(videoData);
  }

  private async createFileAssetRecord(data: Omit<NewFileAsset, 'id' | 'createdAt' | 'updatedAt'>): Promise<FileAsset> {
    const fileData = await this.contentRepository.createFileAsset(data);
    return this.mapToFileAssetEntity(fileData);
  }

  // Mapper methods to convert database types to domain entities
  private mapToVideoAssetEntity(data: VideoAssetData): VideoAsset {
    return new VideoAsset(
      data.id,
      data.lessonId,
      data.uploadedBy,
      data.originalFileName,
      data.originalFileSize,
      data.mimeType,
      data.s3Bucket,
      data.s3Key,
      data.s3Region,
      data.processingStatus,
      data.processingJobId,
      data.processingStartedAt,
      data.processingCompletedAt,
      data.processingErrorMessage,
      data.durationSeconds,
      data.originalResolution,
      data.originalBitrate ? Number(data.originalBitrate) : null,
      data.originalFrameRate ? Number(data.originalFrameRate) : null,
      data.hlsManifestUrl,
      data.thumbnailUrl,
      data.previewUrl,
      Array.isArray(data.availableResolutions) ? data.availableResolutions as any[] : [],
      data.cloudfrontDistribution,
      (data.streamingUrls as any) || {},
      (data.metadata as any) || {},
      data.createdAt,
      data.updatedAt
    );
  }

  private mapToFileAssetEntity(data: FileAssetData): FileAsset {
    return new FileAsset(
      data.id,
      data.courseId,
      data.lessonId,
      data.uploadedBy,
      data.fileName,
      data.originalFileName,
      data.fileSize,
      data.mimeType,
      data.assetType,
      data.s3Bucket,
      data.s3Key,
      data.s3Region,
      data.isPublic,
      data.accessLevel as any,
      data.cloudfrontUrl,
      data.processingStatus,
      data.processingErrorMessage,
      (data.variants as any) || {},
      data.description,
      Array.isArray(data.tags) ? data.tags as string[] : [],
      (data.metadata as any) || {},
      data.expiresAt,
      data.createdAt,
      data.updatedAt
    );
  }

  private mapToProcessingJobEntity(data: ProcessingJobData): ProcessingJob {
    return new ProcessingJob(
      data.id,
      data.videoAssetId,
      data.fileAssetId,
      data.jobType as any,
      data.externalJobId,
      data.externalServiceName,
      (data.jobConfiguration as any) || {},
      data.status,
      data.progress,
      data.startedAt,
      data.completedAt,
      (data.result as any) || null,
      data.errorMessage,
      data.errorCode,
      data.attemptCount,
      data.maxAttempts,
      data.nextRetryAt,
      data.priority,
      data.scheduledFor,
      (data.metadata as any) || {},
      data.createdAt,
      data.updatedAt
    );
  }
}