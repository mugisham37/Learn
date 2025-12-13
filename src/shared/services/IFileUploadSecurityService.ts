/**
 * File Upload Security Service Interface
 *
 * Defines the contract for file upload security validation services.
 *
 * Requirements: 13.4
 */

/**
 * File upload context types
 */
export type FileUploadContext =
  | 'avatar'
  | 'course_thumbnail'
  | 'lesson_video'
  | 'assignment_submission'
  | 'course_resource'
  | 'video_content'
  | 'document'
  | 'general';

/**
 * File upload parameters
 */
export interface FileUploadParams {
  fileName: string;
  fileBuffer: Buffer;
  context: FileUploadContext;
  userId: string;
  declaredMimeType?: string;
  maxSizeOverride?: number;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  valid?: boolean; // Alias for backward compatibility
  errors: Array<{ field: string; message: string; fileName?: string }>;
  warnings?: Array<{ field: string; message: string }>;
  sanitizedFileName?: string;
  uniqueFileName?: string;
  detectedMimeType?: string;
  fileSize?: number;
  fileHash?: string;
}

/**
 * File Upload Security Service Interface
 */
export interface IFileUploadSecurityService {
  /**
   * Validates a file upload comprehensively
   *
   * @param params - File upload parameters
   * @returns Promise resolving to validation result
   */
  validateFileUpload(params: FileUploadParams): Promise<FileValidationResult>;

  /**
   * Gets allowed file types for a context
   *
   * @param context - File upload context
   * @returns Array of allowed MIME types
   */
  getAllowedFileTypes(context: FileUploadContext): readonly string[];

  /**
   * Gets maximum file size for a context
   *
   * @param context - File upload context
   * @returns Maximum file size in bytes
   */
  getMaxFileSize(context: FileUploadContext): number;
}
