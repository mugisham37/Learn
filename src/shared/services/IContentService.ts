/**
 * Content Service Interface
 * 
 * Defines the contract for content management operations.
 * Combines S3 storage with CloudFront CDN for optimal content delivery.
 */

/**
 * Content upload parameters
 */
export interface ContentUploadParams {
  userId: string;
  fileName: string;
  fileType: string;
  contentType: string;
  isPrivate?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Content upload result
 */
export interface ContentUploadResult {
  key: string;
  uploadUrl: string;
  publicUrl?: string;
  expiresAt: Date;
}

/**
 * Streaming URL parameters
 */
export interface StreamingUrlParams {
  s3Key: string;
  userId: string;
  expiresIn?: number; // seconds, defaults to 1 hour
  ipAddress?: string;
}

/**
 * Streaming URL result
 */
export interface StreamingUrlResult {
  url: string;
  expiresAt: Date;
}

/**
 * Content deletion parameters
 */
export interface ContentDeleteParams {
  s3Key: string;
  userId: string;
}

/**
 * Content Service Interface
 * 
 * Provides high-level content management operations combining
 * S3 storage with CloudFront CDN for optimal delivery.
 */
export interface IContentService {
  /**
   * Generates a presigned upload URL for content
   * 
   * @param params - Upload parameters
   * @returns Upload URL and metadata
   * @throws ExternalServiceError if operation fails
   */
  generateUploadUrl(params: ContentUploadParams): Promise<ContentUploadResult>;

  /**
   * Generates a streaming URL for video content
   * 
   * @param params - Streaming URL parameters
   * @returns Signed streaming URL
   * @throws ExternalServiceError if operation fails
   */
  generateStreamingUrl(params: StreamingUrlParams): Promise<StreamingUrlResult>;

  /**
   * Gets the public URL for content
   * 
   * @param s3Key - S3 object key
   * @param useCloudFront - Whether to use CloudFront URL
   * @returns Public content URL
   */
  getPublicUrl(s3Key: string, useCloudFront?: boolean): string;

  /**
   * Deletes content from storage
   * 
   * @param params - Deletion parameters
   * @returns void
   * @throws ExternalServiceError if operation fails
   */
  deleteContent(params: ContentDeleteParams): Promise<void>;

  /**
   * Checks if content exists
   * 
   * @param s3Key - S3 object key
   * @returns True if content exists, false otherwise
   * @throws ExternalServiceError if operation fails
   */
  contentExists(s3Key: string): Promise<boolean>;

  /**
   * Generates S3 key for content based on user and file info
   * 
   * @param userId - User ID
   * @param fileName - Original file name
   * @param fileType - Content type (video, image, document, etc.)
   * @returns Generated S3 key
   */
  generateContentKey(userId: string, fileName: string, fileType: string): string;
}