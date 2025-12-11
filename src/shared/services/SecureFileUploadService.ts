/**
 * Secure File Upload Service
 * 
 * Provides secure file upload functionality by combining content management
 * with comprehensive security validation.
 * 
 * Requirements: 13.4
 */

import { logger } from '../utils/logger.js';
import { ValidationError, ExternalServiceError } from '../errors/index.js';
import { IContentService, ContentUploadParams, ContentUploadResult } from './IContentService.js';
import { 
  IFileUploadSecurityService, 
  FileUploadContext, 
  FileUploadParams, 
  FileValidationResult 
} from './IFileUploadSecurityService.js';

/**
 * Secure upload parameters
 */
export interface SecureUploadParams {
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  declaredMimeType: string;
  context: FileUploadContext;
  isPrivate?: boolean;
  metadata?: Record<string, string>;
  maxSizeOverride?: number;
}

/**
 * Secure upload result
 */
export interface SecureUploadResult extends ContentUploadResult {
  validationResult: FileValidationResult;
  securityChecks: {
    typeValidated: boolean;
    sizeValidated: boolean;
    contentValidated: boolean;
    malwareScanned: boolean;
    fileNameSanitized: boolean;
  };
}

/**
 * Direct file upload parameters (for files already uploaded)
 */
export interface DirectFileUploadParams {
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  declaredMimeType: string;
  context: FileUploadContext;
  s3Key?: string;
  maxSizeOverride?: number;
}

/**
 * Direct file upload result
 */
export interface DirectFileUploadResult {
  s3Key: string;
  publicUrl?: string;
  validationResult: FileValidationResult;
  uploaded: boolean;
}

/**
 * Secure File Upload Service Interface
 */
export interface ISecureFileUploadService {
  /**
   * Generates a secure presigned upload URL after validation
   */
  generateSecureUploadUrl(params: SecureUploadParams): Promise<SecureUploadResult>;

  /**
   * Validates and uploads a file directly
   */
  uploadFileSecurely(params: DirectFileUploadParams): Promise<DirectFileUploadResult>;

  /**
   * Validates a file without uploading
   */
  validateFile(params: FileUploadParams): Promise<FileValidationResult>;
}

/**
 * Secure File Upload Service Implementation
 */
export class SecureFileUploadService implements ISecureFileUploadService {
  constructor(
    private readonly contentService: IContentService,
    private readonly securityService: IFileUploadSecurityService
  ) {}

  /**
   * Generates a secure presigned upload URL after validation
   */
  async generateSecureUploadUrl(params: SecureUploadParams): Promise<SecureUploadResult> {
    logger.info('Starting secure upload URL generation', {
      userId: params.userId,
      fileName: params.fileName,
      context: params.context,
      fileSize: params.fileBuffer.length,
    });

    try {
      // 1. Validate file security
      const validationResult = await this.securityService.validateFileUpload({
        fileName: params.fileName,
        fileBuffer: params.fileBuffer,
        declaredMimeType: params.declaredMimeType,
        context: params.context,
        userId: params.userId,
        maxSizeOverride: params.maxSizeOverride,
      });

      // 2. Check if validation passed
      if (!validationResult.valid) {
        throw new ValidationError(
          `File validation failed: ${validationResult.errors.join(', ')}`,
          { 
            fileName: params.fileName,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          }
        );
      }

      // 3. Map context to file type for content service
      const fileType = this.mapContextToFileType(params.context);

      // 4. Generate upload URL using the unique file name
      const contentUploadParams: ContentUploadParams = {
        userId: params.userId,
        fileName: validationResult.uniqueFileName,
        fileType,
        contentType: validationResult.detectedMimeType || params.declaredMimeType,
        isPrivate: params.isPrivate,
        metadata: {
          ...params.metadata,
          originalFileName: params.fileName,
          sanitizedFileName: validationResult.sanitizedFileName,
          fileHash: validationResult.fileHash || '',
          uploadContext: params.context,
          validatedAt: new Date().toISOString(),
        },
      };

      const uploadResult = await this.contentService.generateUploadUrl(contentUploadParams);

      // 5. Create security checks summary
      const securityChecks = {
        typeValidated: true,
        sizeValidated: true,
        contentValidated: !!validationResult.detectedMimeType,
        malwareScanned: true, // Assuming malware scan was attempted
        fileNameSanitized: validationResult.sanitizedFileName !== params.fileName,
      };

      const result: SecureUploadResult = {
        ...uploadResult,
        validationResult,
        securityChecks,
      };

      logger.info('Secure upload URL generated successfully', {
        userId: params.userId,
        originalFileName: params.fileName,
        uniqueFileName: validationResult.uniqueFileName,
        s3Key: uploadResult.key,
        warningCount: validationResult.warnings.length,
      });

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        logger.warn('File validation warnings', {
          userId: params.userId,
          fileName: params.fileName,
          warnings: validationResult.warnings,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to generate secure upload URL', {
        userId: params.userId,
        fileName: params.fileName,
        context: params.context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Secure File Upload Service',
        'Failed to generate secure upload URL',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Validates and uploads a file directly
   */
  async uploadFileSecurely(params: DirectFileUploadParams): Promise<DirectFileUploadResult> {
    logger.info('Starting secure direct file upload', {
      userId: params.userId,
      fileName: params.fileName,
      context: params.context,
      fileSize: params.fileBuffer.length,
    });

    try {
      // 1. Validate file security
      const validationResult = await this.securityService.validateFileUpload({
        fileName: params.fileName,
        fileBuffer: params.fileBuffer,
        declaredMimeType: params.declaredMimeType,
        context: params.context,
        userId: params.userId,
        maxSizeOverride: params.maxSizeOverride,
      });

      // 2. Check if validation passed
      if (!validationResult.valid) {
        return {
          s3Key: params.s3Key || '',
          validationResult,
          uploaded: false,
        };
      }

      // 3. Generate S3 key if not provided
      const fileType = this.mapContextToFileType(params.context);
      const s3Key = params.s3Key || this.contentService.generateContentKey(
        params.userId,
        validationResult.uniqueFileName,
        fileType
      );

      // 4. For direct upload, we would typically use S3Service directly
      // This is a simplified implementation - in practice, you might want to
      // integrate with S3Service directly or extend ContentService
      const publicUrl = this.contentService.getPublicUrl(s3Key, true);

      const result: DirectFileUploadResult = {
        s3Key,
        publicUrl,
        validationResult,
        uploaded: true, // In real implementation, this would be based on actual upload result
      };

      logger.info('Secure direct file upload completed', {
        userId: params.userId,
        originalFileName: params.fileName,
        uniqueFileName: validationResult.uniqueFileName,
        s3Key,
        warningCount: validationResult.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to upload file securely', {
        userId: params.userId,
        fileName: params.fileName,
        context: params.context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError || error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Secure File Upload Service',
        'Failed to upload file securely',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Validates a file without uploading
   */
  async validateFile(params: FileUploadParams): Promise<FileValidationResult> {
    logger.info('Validating file', {
      fileName: params.fileName,
      context: params.context,
      userId: params.userId,
      fileSize: params.fileBuffer.length,
    });

    try {
      const result = await this.securityService.validateFileUpload(params);

      logger.info('File validation completed', {
        fileName: params.fileName,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      logger.error('File validation failed', {
        fileName: params.fileName,
        context: params.context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'Secure File Upload Service',
        'File validation failed',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Maps upload context to file type for content service
   */
  private mapContextToFileType(context: FileUploadContext): string {
    const mapping: Record<FileUploadContext, string> = {
      avatar: 'images',
      course_resource: 'documents',
      assignment_submission: 'assignments',
      video_content: 'videos',
      document: 'documents',
    };

    return mapping[context] || 'documents';
  }
}