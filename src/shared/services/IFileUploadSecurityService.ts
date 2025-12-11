/**
 * File Upload Security Service Interface
 * 
 * Defines the contract for file upload security validation services.
 * 
 * Requirements: 13.4
 */

import { 
  FileUploadContext, 
  FileValidationResult, 
  FileUploadParams 
} from './FileUploadSecurityService.js';

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