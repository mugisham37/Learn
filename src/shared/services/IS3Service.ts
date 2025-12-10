/**
 * S3 Service Interface
 * 
 * Defines the contract for S3 file operations.
 * Abstracts AWS S3 operations behind a clean interface.
 */

/**
 * File upload parameters
 */
export interface UploadFileParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * File upload result
 */
export interface UploadFileResult {
  key: string;
  url: string;
  etag: string;
}

/**
 * Presigned URL parameters
 */
export interface PresignedUrlParams {
  key: string;
  expiresIn: number; // seconds
  contentType?: string;
}

/**
 * S3 Service Interface
 * 
 * Provides methods for S3 file operations including uploads,
 * deletions, and presigned URL generation.
 */
export interface IS3Service {
  /**
   * Uploads a file to S3
   * 
   * @param params - Upload parameters
   * @returns Upload result with URL and metadata
   * @throws ExternalServiceError if S3 operation fails
   */
  uploadFile(params: UploadFileParams): Promise<UploadFileResult>;

  /**
   * Deletes a file from S3
   * 
   * @param key - S3 object key
   * @returns void
   * @throws ExternalServiceError if S3 operation fails
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Generates a presigned URL for file upload
   * 
   * @param params - Presigned URL parameters
   * @returns Presigned URL
   * @throws ExternalServiceError if S3 operation fails
   */
  generatePresignedUrl(params: PresignedUrlParams): Promise<string>;

  /**
   * Checks if a file exists in S3
   * 
   * @param key - S3 object key
   * @returns True if file exists, false otherwise
   * @throws ExternalServiceError if S3 operation fails
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Gets the public URL for a file
   * 
   * @param key - S3 object key
   * @returns Public URL
   */
  getPublicUrl(key: string): string;
}