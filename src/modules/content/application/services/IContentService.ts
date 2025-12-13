/**
 * Content Service Interface
 *
 * Defines the contract for content management operations in the application layer.
 * Handles video uploads, processing, streaming URLs, and file management.
 *
 * Requirements:
 * - 4.1: Video upload with presigned URLs and S3 integration
 * - 4.4: Video processing status tracking and completion handling
 * - 4.5: Streaming URL generation with signed URLs
 */

import { VideoAsset, FileAsset, ProcessingJob } from '../../domain/entities/index.js';

/**
 * Presigned upload URL parameters
 */
export interface GenerateUploadUrlParams {
  userId: string;
  fileName: string;
  fileType: string;
  contentType: string;
  lessonId?: string;
  courseId?: string;
}

/**
 * Presigned upload URL result
 */
export interface PresignedUploadUrl {
  uploadUrl: string;
  s3Key: string;
  s3Bucket: string;
  expiresAt: Date;
  videoAssetId?: string; // For video uploads
  fileAssetId?: string; // For file uploads
}

/**
 * Video upload handling parameters
 */
export interface VideoUploadParams {
  s3Key: string;
  s3Bucket: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  lessonId?: string;
  metadata?: Record<string, any>;
}

/**
 * Transcoding completion parameters
 */
export interface TranscodingCompleteParams {
  jobId: string;
  status: 'completed' | 'failed';
  outputs?: TranscodingOutput[];
  errorMessage?: string;
}

/**
 * Transcoding output information
 */
export interface TranscodingOutput {
  resolution: string;
  url: string;
  bitrate: number;
  fileSize: number;
}

/**
 * Streaming URL generation parameters
 */
export interface GenerateStreamingUrlParams {
  lessonId: string;
  userId: string;
  expiresIn?: number; // seconds, defaults based on lesson duration
  ipAddress?: string;
}

/**
 * Streaming URL result
 */
export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/**
 * Course resource upload parameters
 */
export interface UploadCourseResourceParams {
  courseId: string;
  lessonId?: string;
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * Content deletion parameters
 */
export interface DeleteContentParams {
  fileKey: string;
  userId: string;
}

/**
 * Content Service Interface
 *
 * Provides application-level content management operations including
 * video processing, file uploads, and streaming URL generation.
 */
export interface IContentService {
  /**
   * Generates a presigned URL for content upload
   *
   * @param params - Upload URL generation parameters
   * @returns Promise resolving to presigned upload URL and metadata
   * @throws ValidationError if parameters are invalid
   * @throws ExternalServiceError if S3 operation fails
   */
  generateUploadUrl(params: GenerateUploadUrlParams): Promise<PresignedUploadUrl>;

  /**
   * Handles video upload completion and initiates processing
   *
   * @param params - Video upload parameters
   * @returns Promise resolving to processing job
   * @throws ValidationError if video metadata is invalid
   * @throws ExternalServiceError if processing initiation fails
   */
  handleVideoUpload(params: VideoUploadParams): Promise<ProcessingJob>;

  /**
   * Handles transcoding completion webhook
   *
   * @param params - Transcoding completion parameters
   * @returns Promise resolving to updated video asset
   * @throws NotFoundError if processing job not found
   * @throws ExternalServiceError if update fails
   */
  handleTranscodingComplete(params: TranscodingCompleteParams): Promise<VideoAsset>;

  /**
   * Generates a streaming URL for video content
   *
   * @param params - Streaming URL generation parameters
   * @returns Promise resolving to signed streaming URL
   * @throws NotFoundError if lesson or video not found
   * @throws AuthorizationError if user lacks access
   * @throws ExternalServiceError if URL generation fails
   */
  generateStreamingUrl(params: GenerateStreamingUrlParams): Promise<SignedUrl>;

  /**
   * Uploads a course resource file
   *
   * @param params - Course resource upload parameters
   * @returns Promise resolving to created file asset
   * @throws ValidationError if file validation fails
   * @throws ExternalServiceError if upload fails
   */
  uploadCourseResource(params: UploadCourseResourceParams): Promise<FileAsset>;

  /**
   * Deletes content from storage and database
   *
   * @param params - Content deletion parameters
   * @returns Promise resolving when deletion is complete
   * @throws NotFoundError if content not found
   * @throws AuthorizationError if user lacks permission
   * @throws ExternalServiceError if deletion fails
   */
  deleteContent(params: DeleteContentParams): Promise<void>;
}
