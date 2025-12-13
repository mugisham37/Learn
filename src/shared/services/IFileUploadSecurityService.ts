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
export type FileUploadContext = 'avatar' | 'course_thumbnail' | 'lesson_video' | 'assignment_submission' | 'general';

/**
 * File upload parameters
 */
export interface FileUploadParams {
  fileName: string;
  fileBuffer: Buffer;
  context: FileUploadContext;
  userId: string;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; fileName?: string }>;
  sanitizedFileName?: string;
  detectedMimeType?: string;
  fileSize?: number;
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