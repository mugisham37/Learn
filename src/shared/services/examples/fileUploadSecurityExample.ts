/**
 * File Upload Security Service Usage Example
 * 
 * Demonstrates how to use the FileUploadSecurityService and SecureFileUploadService
 * for comprehensive file upload validation and security.
 * 
 * Requirements: 13.4
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  FileUploadSecurityService,
  SecureFileUploadService,
  ContentService,
  S3Service,
  CloudFrontService
} from '../index.js';
import { 
  createFileUploadSecurityMiddleware,
  createAvatarUploadMiddleware,
  RequestWithFileValidation
} from '../../middleware/index.js';

/**
 * Example: Setting up file upload security services
 */
export function setupFileUploadServices() {
  // Initialize core services
  const s3Service = new S3Service();
  const cloudFrontService = new CloudFrontService();
  const contentService = new ContentService(s3Service, cloudFrontService);
  
  // Initialize security services
  const fileUploadSecurityService = new FileUploadSecurityService();
  const secureFileUploadService = new SecureFileUploadService(
    contentService,
    fileUploadSecurityService
  );

  return {
    fileUploadSecurityService,
    secureFileUploadService,
    contentService,
  };
}

/**
 * Example: Using file upload security middleware in Fastify routes
 */
export function registerSecureFileUploadRoutes(fastify: FastifyInstance) {
  const { fileUploadSecurityService, secureFileUploadService } = setupFileUploadServices();

  // Example 1: Avatar upload with security validation
  fastify.post('/users/avatar', {
    preHandler: [
      // Add authentication middleware here
      createAvatarUploadMiddleware(fileUploadSecurityService)
    ]
  }, async (request: RequestWithFileValidation, reply: FastifyReply) => {
    try {
      // File validation result is available on request
      const validationResult = request.fileValidation;
      
      if (!validationResult || !validationResult.valid) {
        return reply.status(400).send({
          error: 'File validation failed',
          details: validationResult?.errors || ['Unknown validation error']
        });
      }

      // Get the uploaded file
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const fileBuffer = await file.toBuffer();

      // Generate secure upload URL
      const uploadResult = await secureFileUploadService.generateSecureUploadUrl({
        userId: 'user-123', // Get from authenticated user
        fileName: file.filename || 'avatar',
        fileBuffer,
        declaredMimeType: file.mimetype || 'application/octet-stream',
        context: 'avatar',
        isPrivate: false,
      });

      return reply.send({
        success: true,
        uploadUrl: uploadResult.uploadUrl,
        publicUrl: uploadResult.publicUrl,
        expiresAt: uploadResult.expiresAt,
        securityChecks: uploadResult.securityChecks,
        warnings: uploadResult.validationResult.warnings,
      });
    } catch (error) {
      fastify.log.error('Avatar upload failed', { error });
      return reply.status(500).send({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Example 2: Course resource upload
  fastify.post('/courses/:courseId/resources', {
    preHandler: [
      // Add authentication and authorization middleware here
      createFileUploadSecurityMiddleware(fileUploadSecurityService, {
        context: 'course_resource',
        required: true,
        fieldName: 'resource'
      })
    ]
  }, async (request: RequestWithFileValidation, reply: FastifyReply) => {
    try {
      const validationResult = request.fileValidation;
      
      if (!validationResult || !validationResult.valid) {
        return reply.status(400).send({
          error: 'File validation failed',
          details: validationResult?.errors || ['Unknown validation error']
        });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const fileBuffer = await file.toBuffer();
      const params = request.params as { courseId: string };

      // Generate secure upload URL for course resource
      const uploadResult = await secureFileUploadService.generateSecureUploadUrl({
        userId: 'educator-123', // Get from authenticated user
        fileName: file.filename || 'resource',
        fileBuffer,
        declaredMimeType: file.mimetype || 'application/octet-stream',
        context: 'course_resource',
        isPrivate: true, // Course resources are typically private
        metadata: {
          courseId: params.courseId,
          uploadedBy: 'educator-123',
        },
      });

      return reply.send({
        success: true,
        uploadUrl: uploadResult.uploadUrl,
        expiresAt: uploadResult.expiresAt,
        securityChecks: uploadResult.securityChecks,
        warnings: uploadResult.validationResult.warnings,
      });
    } catch (error) {
      fastify.log.error('Course resource upload failed', { error });
      return reply.status(500).send({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Example 3: Direct file validation without upload
  fastify.post('/files/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file provided for validation' });
      }

      const fileBuffer = await file.toBuffer();

      // Validate file without uploading
      const validationResult = await fileUploadSecurityService.validateFileUpload({
        fileName: file.filename || 'unknown',
        fileBuffer,
        declaredMimeType: file.mimetype || 'application/octet-stream',
        context: 'document',
        userId: 'user-123',
      });

      return reply.send({
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        sanitizedFileName: validationResult.sanitizedFileName,
        uniqueFileName: validationResult.uniqueFileName,
        detectedMimeType: validationResult.detectedMimeType,
        fileHash: validationResult.fileHash,
      });
    } catch (error) {
      fastify.log.error('File validation failed', { error });
      return reply.status(500).send({
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

/**
 * Example: Manual file validation in application code
 */
export async function validateFileManually() {
  const { fileUploadSecurityService } = setupFileUploadServices();

  // Example file buffer (in real usage, this would come from a file upload)
  const fileBuffer = Buffer.from('Sample file content');

  try {
    const validationResult = await fileUploadSecurityService.validateFileUpload({
      fileName: 'document.pdf',
      fileBuffer,
      declaredMimeType: 'application/pdf',
      context: 'document',
      userId: 'user-123',
    });

    if (validationResult.valid) {
      console.log('File validation passed:', {
        sanitizedFileName: validationResult.sanitizedFileName,
        uniqueFileName: validationResult.uniqueFileName,
        detectedMimeType: validationResult.detectedMimeType,
        warnings: validationResult.warnings,
      });
    } else {
      console.log('File validation failed:', {
        errors: validationResult.errors,
      });
    }

    return validationResult;
  } catch (error) {
    console.error('File validation error:', error);
    throw error;
  }
}

/**
 * Example: Getting allowed file types and sizes for different contexts
 */
export function getFileUploadLimits() {
  const fileUploadSecurityService = new FileUploadSecurityService();

  const contexts = ['avatar', 'course_resource', 'assignment_submission', 'video_content', 'document'] as const;

  const limits = contexts.map(context => ({
    context,
    allowedTypes: fileUploadSecurityService.getAllowedFileTypes(context),
    maxSize: fileUploadSecurityService.getMaxFileSize(context),
    maxSizeMB: Math.round(fileUploadSecurityService.getMaxFileSize(context) / (1024 * 1024)),
  }));

  console.log('File upload limits by context:', limits);
  return limits;
}