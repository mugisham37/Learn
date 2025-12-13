/**
 * File Upload Security Middleware
 *
 * Provides middleware for validating file uploads in Fastify routes.
 * Integrates with the FileUploadSecurityService for comprehensive validation.
 *
 * Requirements: 13.4
 */

import { FastifyReply } from 'fastify';

import { ValidationError } from '../errors/index.js';
import {
  FileUploadSecurityService,
  FileUploadContext,
  FileValidationResult,
} from '../services/FileUploadSecurityService.js';
import { 
  FastifyRequestWithMultipart,
  isAuthenticatedRequest 
} from '../types/fastify.js';
import { logger } from '../utils/logger.js';

/**
 * File upload middleware options
 */
export interface FileUploadMiddlewareOptions {
  context: FileUploadContext;
  maxSizeOverride?: number;
  required?: boolean;
  fieldName?: string;
}

/**
 * Extended request with file validation result
 */
export interface RequestWithFileValidation extends FastifyRequestWithMultipart {
  user?: import('../types/index.js').UserContext;
  traceContext?: import('../types/fastify.js').TraceContext;
  sentryTransaction?: import('@sentry/node').Transaction;
  fileValidation?: FileValidationResult;
  securityService?: FileUploadSecurityService;
}

/**
 * Creates file upload security middleware
 */
export function createFileUploadSecurityMiddleware(
  securityService: FileUploadSecurityService,
  options: FileUploadMiddlewareOptions
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return async (request: RequestWithFileValidation, reply: FastifyReply): Promise<void> => {
    try {
      const userId = isAuthenticatedRequest(request) ? request.user.id : undefined;
      
      logger.info('Starting file upload security validation', {
        context: options.context,
        fieldName: options.fieldName || 'file',
        userId,
      });

      // Attach security service to request for later use
      request.securityService = securityService;

      // Check if file upload is required
      const hasFile = await checkForFile(request as FastifyRequestWithMultipart, options.fieldName || 'file');

      if (!hasFile) {
        if (options.required) {
          throw new ValidationError('File upload is required', [
            { field: options.fieldName || 'file', message: 'File upload is required' }
          ]);
        }
        // If file is not required and not present, skip validation
        return;
      }

      // Extract file data from request
      const fileData = await extractFileData(request as FastifyRequestWithMultipart, options.fieldName || 'file');

      if (!fileData) {
        throw new ValidationError('Failed to extract file data from request', [
          { field: options.fieldName || 'file', message: 'Failed to extract file data from request' }
        ]);
      }

      // Validate file using security service
      const validationResult = await securityService.validateFileUpload({
        fileName: fileData.fileName,
        fileBuffer: fileData.buffer,
        declaredMimeType: fileData.mimeType,
        context: options.context,
        userId: userId || 'anonymous',
        maxSizeOverride: options.maxSizeOverride,
      });

      // Attach validation result to request
      request.fileValidation = validationResult;

      // Check if validation passed
      if (!validationResult.valid) {
        logger.warn('File upload validation failed', {
          fileName: fileData.fileName,
          context: options.context,
          errors: validationResult.errors,
          userId,
        });

        throw new ValidationError(`File validation failed: ${validationResult.errors.join(', ')}`, [
          { field: 'file', message: `File validation failed: ${validationResult.errors.join(', ')}` }
        ]);
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        const authenticatedUserId = isAuthenticatedRequest(request) ? request.user.id : undefined;
        logger.warn('File upload validation warnings', {
          fileName: fileData.fileName,
          context: options.context,
          warnings: validationResult.warnings,
          userId: authenticatedUserId,
        });
      }

      const authenticatedUserId = isAuthenticatedRequest(request) ? request.user.id : undefined;
      logger.info('File upload security validation passed', {
        fileName: fileData.fileName,
        uniqueFileName: validationResult.uniqueFileName,
        context: options.context,
        warningCount: validationResult.warnings.length,
        userId: authenticatedUserId,
      });
    } catch (error) {
      const authenticatedUserId = isAuthenticatedRequest(request) ? request.user.id : undefined;
      logger.error('File upload security validation failed', {
        context: options.context,
        fieldName: options.fieldName || 'file',
        userId: authenticatedUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        void reply.status(400).send({
          error: 'File Validation Error',
          message: error.message,
          details: error.details,
        });
        return;
      }

      void reply.status(500).send({
        error: 'Internal Server Error',
        message: 'File upload validation failed',
      });
    }
  };
}

/**
 * File data extracted from request
 */
interface FileData {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

/**
 * Checks if request contains a file
 */
async function checkForFile(request: FastifyRequestWithMultipart, _fieldName: string): Promise<boolean> {
  // Check if request is multipart
  if (!request.isMultipart()) {
    return false;
  }

  try {
    // Try to get the file part
    const file = await request.file() as unknown;
    return !!file;
  } catch (error) {
    // If no file is found, file() throws an error
    return false;
  }
}

/**
 * Extracts file data from multipart request
 */
async function extractFileData(
  request: FastifyRequestWithMultipart,
  _fieldName: string
): Promise<FileData | null> {
  try {
    if (!request.isMultipart()) {
      return null;
    }

    const file = await request.file() as unknown;
    if (!file) {
      return null;
    }

    // Type assertion to ensure proper typing
    const typedFile = file as {
      filename: string;
      mimetype: string;
      toBuffer(): Promise<Buffer>;
    };

    // Read file buffer
    const buffer = await typedFile.toBuffer();

    return {
      fileName: typedFile.filename || 'unknown',
      buffer,
      mimeType: typedFile.mimetype || 'application/octet-stream',
      size: buffer.length,
    };
  } catch (error) {
    logger.error('Failed to extract file data from request', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Helper function to create avatar upload middleware
 */
export function createAvatarUploadMiddleware(
  securityService: FileUploadSecurityService
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return createFileUploadSecurityMiddleware(securityService, {
    context: 'avatar',
    required: true,
    fieldName: 'avatar',
  });
}

/**
 * Helper function to create course resource upload middleware
 */
export function createCourseResourceUploadMiddleware(
  securityService: FileUploadSecurityService
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return createFileUploadSecurityMiddleware(securityService, {
    context: 'course_resource',
    required: true,
    fieldName: 'file',
  });
}

/**
 * Helper function to create assignment submission upload middleware
 */
export function createAssignmentSubmissionUploadMiddleware(
  securityService: FileUploadSecurityService
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return createFileUploadSecurityMiddleware(securityService, {
    context: 'assignment_submission',
    required: true,
    fieldName: 'submission',
  });
}

/**
 * Helper function to create video content upload middleware
 */
export function createVideoContentUploadMiddleware(
  securityService: FileUploadSecurityService
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return createFileUploadSecurityMiddleware(securityService, {
    context: 'video_content',
    required: true,
    fieldName: 'video',
  });
}

/**
 * Helper function to create document upload middleware
 */
export function createDocumentUploadMiddleware(
  securityService: FileUploadSecurityService
): (request: RequestWithFileValidation, reply: FastifyReply) => Promise<void> {
  return createFileUploadSecurityMiddleware(securityService, {
    context: 'document',
    required: true,
    fieldName: 'document',
  });
}
