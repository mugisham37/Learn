/**
 * GraphQL Resolvers for Content Module
 * 
 * Implements GraphQL resolvers for content management operations including
 * video uploads, file management, streaming URLs, and content deletion
 * with proper error handling, validation, and authorization.
 * 
 * Requirements: 21.2, 21.3
 */

import { GraphQLError } from 'graphql';

import { 
  ValidationError, 
  NotFoundError, 
  AuthorizationError,
  ExternalServiceError 
} from '../../../../shared/errors/index.js';
import { 
  validateFileSize, 
  MAX_FILE_SIZES 
} from '../../../../shared/utils/validation.js';
import { IContentService } from '../../application/services/IContentService.js';
import { FileVariants, FileMetadata, AccessLevel } from '../../domain/entities/FileAsset.js';
import { VideoAsset, FileAsset, VideoResolution, StreamingUrls, VideoMetadata } from '../../domain/entities/index.js';
import { IContentRepository } from '../../infrastructure/repositories/IContentRepository.js';

/**
 * GraphQL context interface
 */
export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  contentService: IContentService;
  contentRepository: IContentRepository;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface GenerateUploadUrlInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  lessonId?: string;
  courseId?: string;
}

interface UploadCourseResourceInput {
  courseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  accessLevel?: 'PUBLIC' | 'COURSE' | 'LESSON' | 'PRIVATE';
}

/**
 * Helper function to require authentication
 */
function requireAuth(context: GraphQLContext): { id: string; email: string; role: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
  return context.user;
}

/**
 * Helper function to validate file upload parameters
 */
function validateFileUploadInput(input: GenerateUploadUrlInput): void {
  // Validate file name
  if (!input.fileName || input.fileName.trim().length === 0) {
    throw new GraphQLError('File name is required', {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
        field: 'fileName'
      }
    });
  }

  // Validate file type
  if (!input.fileType || input.fileType.trim().length === 0) {
    throw new GraphQLError('File type is required', {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
        field: 'fileType'
      }
    });
  }

  // Validate file size
  if (!input.fileSize || input.fileSize <= 0) {
    throw new GraphQLError('File size must be greater than 0', {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
        field: 'fileSize'
      }
    });
  }

  // Determine max file size based on file type
  const fileName = input.fileName.toLowerCase();
  let maxSize: number;

  if (input.fileType === 'video' || fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.avi') || fileName.endsWith('.webm')) {
    maxSize = MAX_FILE_SIZES.video;
  } else {
    maxSize = MAX_FILE_SIZES.document;
  }

  // Validate file size against limits
  const sizeValidation = validateFileSize(input.fileSize, maxSize);
  if (!sizeValidation.valid) {
    throw new GraphQLError(sizeValidation.errors.join(', '), {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
        field: 'fileSize'
      }
    });
  }
}

/**
 * GraphQL type definitions for return values
 */
interface VideoAssetGraphQL {
  id: string;
  lesson: { id: string } | null;
  uploadedBy: { id: string };
  originalFileName: string;
  originalFileSize: number;
  mimeType: string;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  processingStatus: string;
  processingJobId: string | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  processingErrorMessage: string | null;
  durationSeconds: number | null;
  originalResolution: string | null;
  originalBitrate: number | null;
  originalFrameRate: number | null;
  hlsManifestUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  availableResolutions: VideoResolution[];
  cloudfrontDistribution: string | null;
  streamingUrls: StreamingUrls;
  metadata: VideoMetadata;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  formattedDuration: string | null;
  formattedFileSize: string;
  isProcessing: boolean;
  isProcessed: boolean;
  isProcessingFailed: boolean;
  isReadyForStreaming: boolean;
  processingProgress: number;
  bestResolution: VideoResolution | null;
  hasThumbnail: boolean;
  hasPreview: boolean;
  supportsAdaptiveStreaming: boolean;
}

interface FileAssetGraphQL {
  id: string;
  course: { id: string } | null;
  lesson: { id: string } | null;
  uploadedBy: { id: string };
  fileName: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  assetType: string;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  isPublic: boolean;
  accessLevel: string;
  cloudfrontUrl: string | null;
  processingStatus: string;
  processingErrorMessage: string | null;
  variants: FileVariants;
  description: string | null;
  tags: string[];
  metadata: FileMetadata;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  formattedFileSize: string;
  fileExtension: string;
  displayName: string;
  isImage: boolean;
  isDocument: boolean;
  isAudio: boolean;
  isArchive: boolean;
  isProcessing: boolean;
  isProcessed: boolean;
  isProcessingFailed: boolean;
  isExpired: boolean;
  isPubliclyAccessible: boolean;
  cdnUrl: string | null;
  thumbnailUrl: string | undefined;
  previewUrl: string | undefined;
  compressedUrl: string | undefined;
  hasThumbnail: boolean;
  hasPreview: boolean;
  imageDimensions: null;
  pageCount: null;
  isSafeForPreview: boolean;
  timeUntilExpiration: number | null;
  isExpiringSoon: boolean;
  iconClass: string;
}

/**
 * Helper function to map domain entities to GraphQL types
 */
function mapVideoAssetToGraphQL(videoAsset: VideoAsset): VideoAssetGraphQL {
  return {
    id: videoAsset.id,
    lesson: videoAsset.lessonId ? { id: videoAsset.lessonId } : null,
    uploadedBy: { id: videoAsset.uploadedBy },
    originalFileName: videoAsset.originalFileName,
    originalFileSize: videoAsset.originalFileSize,
    mimeType: videoAsset.mimeType,
    s3Bucket: videoAsset.s3Bucket,
    s3Key: videoAsset.s3Key,
    s3Region: videoAsset.s3Region,
    processingStatus: videoAsset.processingStatus.toUpperCase(),
    processingJobId: videoAsset.processingJobId,
    processingStartedAt: videoAsset.processingStartedAt,
    processingCompletedAt: videoAsset.processingCompletedAt,
    processingErrorMessage: videoAsset.processingErrorMessage,
    durationSeconds: videoAsset.durationSeconds,
    originalResolution: videoAsset.originalResolution,
    originalBitrate: videoAsset.originalBitrate,
    originalFrameRate: videoAsset.originalFrameRate,
    hlsManifestUrl: videoAsset.hlsManifestUrl,
    thumbnailUrl: videoAsset.thumbnailUrl,
    previewUrl: videoAsset.previewUrl,
    availableResolutions: videoAsset.availableResolutions || [],
    cloudfrontDistribution: videoAsset.cloudfrontDistribution,
    streamingUrls: videoAsset.streamingUrls || {},
    metadata: videoAsset.metadata || {},
    createdAt: videoAsset.createdAt,
    updatedAt: videoAsset.updatedAt,
    // Computed fields
    formattedDuration: videoAsset.durationSeconds ? formatDuration(videoAsset.durationSeconds) : null,
    formattedFileSize: formatFileSize(videoAsset.originalFileSize),
    isProcessing: videoAsset.processingStatus === 'in_progress' || videoAsset.processingStatus === 'pending',
    isProcessed: videoAsset.processingStatus === 'completed',
    isProcessingFailed: videoAsset.processingStatus === 'failed',
    isReadyForStreaming: videoAsset.processingStatus === 'completed' && !!videoAsset.hlsManifestUrl,
    processingProgress: videoAsset.processingStatus === 'completed' ? 100 : 
                       videoAsset.processingStatus === 'failed' ? 0 : 50,
    bestResolution: videoAsset.availableResolutions?.[0] || null,
    hasThumbnail: !!videoAsset.thumbnailUrl,
    hasPreview: !!videoAsset.previewUrl,
    supportsAdaptiveStreaming: !!videoAsset.hlsManifestUrl
  };
}

function mapFileAssetToGraphQL(fileAsset: FileAsset): FileAssetGraphQL {
  return {
    id: fileAsset.id,
    course: fileAsset.courseId ? { id: fileAsset.courseId } : null,
    lesson: fileAsset.lessonId ? { id: fileAsset.lessonId } : null,
    uploadedBy: { id: fileAsset.uploadedBy },
    fileName: fileAsset.fileName,
    originalFileName: fileAsset.originalFileName,
    fileSize: fileAsset.fileSize,
    mimeType: fileAsset.mimeType,
    assetType: fileAsset.assetType.toUpperCase(),
    s3Bucket: fileAsset.s3Bucket,
    s3Key: fileAsset.s3Key,
    s3Region: fileAsset.s3Region,
    isPublic: fileAsset.isPublic,
    accessLevel: fileAsset.accessLevel.toUpperCase(),
    cloudfrontUrl: fileAsset.cloudfrontUrl,
    processingStatus: fileAsset.processingStatus.toUpperCase(),
    processingErrorMessage: fileAsset.processingErrorMessage,
    variants: fileAsset.variants || {},
    description: fileAsset.description,
    tags: fileAsset.tags || [],
    metadata: fileAsset.metadata || {},
    expiresAt: fileAsset.expiresAt,
    createdAt: fileAsset.createdAt,
    updatedAt: fileAsset.updatedAt,
    // Computed fields
    formattedFileSize: formatFileSize(fileAsset.fileSize),
    fileExtension: getFileExtension(fileAsset.fileName),
    displayName: fileAsset.fileName,
    isImage: fileAsset.assetType === 'image',
    isDocument: fileAsset.assetType === 'document',
    isAudio: fileAsset.assetType === 'audio',
    isArchive: fileAsset.assetType === 'archive',
    isProcessing: fileAsset.processingStatus === 'in_progress' || fileAsset.processingStatus === 'pending',
    isProcessed: fileAsset.processingStatus === 'completed',
    isProcessingFailed: fileAsset.processingStatus === 'failed',
    isExpired: fileAsset.expiresAt ? new Date() > fileAsset.expiresAt : false,
    isPubliclyAccessible: fileAsset.isPublic && fileAsset.accessLevel === 'public',
    cdnUrl: fileAsset.cloudfrontUrl,
    thumbnailUrl: fileAsset.variants?.thumbnail,
    previewUrl: fileAsset.variants?.preview,
    compressedUrl: fileAsset.variants?.compressed,
    hasThumbnail: !!(fileAsset.variants?.thumbnail),
    hasPreview: !!(fileAsset.variants?.preview),
    imageDimensions: null, // Would need to be extracted from metadata
    pageCount: null, // Would need to be extracted from metadata for documents
    isSafeForPreview: fileAsset.assetType === 'image' || fileAsset.assetType === 'document',
    timeUntilExpiration: fileAsset.expiresAt ? Math.max(0, fileAsset.expiresAt.getTime() - Date.now()) : null,
    isExpiringSoon: fileAsset.expiresAt ? (fileAsset.expiresAt.getTime() - Date.now()) < 24 * 60 * 60 * 1000 : false,
    iconClass: getFileIconClass(fileAsset.assetType)
  };
}

// Helper functions
function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
}

function getFileIconClass(assetType: string): string {
  switch (assetType) {
    case 'image': return 'fa-image';
    case 'video': return 'fa-video';
    case 'audio': return 'fa-music';
    case 'document': return 'fa-file-text';
    case 'archive': return 'fa-archive';
    default: return 'fa-file';
  }
}

/**
 * GraphQL resolvers for content module
 */
export const contentResolvers = {
  Query: {
    /**
     * Get video asset by ID
     */
    videoAsset: async (_parent: unknown, args: { id: string }, context: GraphQLContext): Promise<VideoAssetGraphQL | null> => {
      requireAuth(context);
      
      try {
        const videoAsset = await context.contentRepository.findVideoAssetById(args.id);
        if (!videoAsset) {
          throw new GraphQLError('Video asset not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        return mapVideoAssetToGraphQL(new VideoAsset(
          videoAsset.id,
          videoAsset.lessonId,
          videoAsset.uploadedBy,
          videoAsset.originalFileName,
          videoAsset.originalFileSize,
          videoAsset.mimeType,
          videoAsset.s3Bucket,
          videoAsset.s3Key,
          videoAsset.s3Region,
          videoAsset.processingStatus,
          videoAsset.processingJobId,
          videoAsset.processingStartedAt,
          videoAsset.processingCompletedAt,
          videoAsset.processingErrorMessage,
          videoAsset.durationSeconds,
          videoAsset.originalResolution,
          videoAsset.originalBitrate ? Number(videoAsset.originalBitrate) : null,
          videoAsset.originalFrameRate ? Number(videoAsset.originalFrameRate) : null,
          videoAsset.hlsManifestUrl,
          videoAsset.thumbnailUrl,
          videoAsset.previewUrl,
          Array.isArray(videoAsset.availableResolutions) ? videoAsset.availableResolutions as VideoResolution[] : [],
          videoAsset.cloudfrontDistribution,
          videoAsset.streamingUrls || {} as StreamingUrls,
          videoAsset.metadata || {} as VideoMetadata,
          videoAsset.createdAt,
          videoAsset.updatedAt
        ));
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to fetch video asset', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get file asset by ID
     */
    fileAsset: async (_parent: unknown, args: { id: string }, context: GraphQLContext): Promise<FileAssetGraphQL | null> => {
      requireAuth(context);
      
      try {
        const fileAsset = await context.contentRepository.findFileAssetById(args.id);
        if (!fileAsset) {
          throw new GraphQLError('File asset not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        return mapFileAssetToGraphQL(new FileAsset(
          fileAsset.id,
          fileAsset.courseId,
          fileAsset.lessonId,
          fileAsset.uploadedBy,
          fileAsset.fileName,
          fileAsset.originalFileName,
          fileAsset.fileSize,
          fileAsset.mimeType,
          fileAsset.assetType,
          fileAsset.s3Bucket,
          fileAsset.s3Key,
          fileAsset.s3Region,
          fileAsset.isPublic,
          fileAsset.accessLevel as AccessLevel,
          fileAsset.cloudfrontUrl,
          fileAsset.processingStatus,
          fileAsset.processingErrorMessage,
          (fileAsset.variants as FileVariants) || ({} as FileVariants),
          fileAsset.description,
          Array.isArray(fileAsset.tags) ? fileAsset.tags as string[] : [],
          fileAsset.metadata || {},
          fileAsset.expiresAt,
          fileAsset.createdAt,
          fileAsset.updatedAt
        ));
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to fetch file asset', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Generate streaming URL for video content
     */
    generateStreamingUrl: async (_parent: unknown, args: { lessonId: string; resolution?: string; format?: string }, context: GraphQLContext): Promise<{ streamingUrl: string; expiresAt: Date; resolution: string; format: string }> => {
      const authUser = requireAuth(context);
      
      try {
        const result = await context.contentService.generateStreamingUrl({
          lessonId: args.lessonId,
          userId: authUser.id,
          expiresIn: 3600 // 1 hour default
        });
        
        return {
          streamingUrl: result.url,
          expiresAt: result.expiresAt,
          resolution: args.resolution || 'auto',
          format: args.format || 'hls'
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Video not found for lesson', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to video content', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        throw new GraphQLError('Failed to generate streaming URL', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  },

  Mutation: {
    /**
     * Generate presigned upload URL
     */
    generateUploadUrl: async (_parent: unknown, args: { input: GenerateUploadUrlInput }, context: GraphQLContext): Promise<{ uploadUrl: string; fileKey: string; expiresIn: number; maxFileSize: number }> => {
      const authUser = requireAuth(context);
      
      try {
        // Validate input
        validateFileUploadInput(args.input);
        
        // Determine content type from file extension
        const fileName = args.input.fileName.toLowerCase();
        let contentType: string;
        
        if (args.input.fileType === 'video' || fileName.endsWith('.mp4') || fileName.endsWith('.mov') || fileName.endsWith('.avi') || fileName.endsWith('.webm')) {
          contentType = 'video/mp4';
        } else if (args.input.fileType === 'image' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.gif') || fileName.endsWith('.webp')) {
          contentType = 'image/jpeg';
        } else {
          contentType = 'application/octet-stream';
        }
        
        const result = await context.contentService.generateUploadUrl({
          userId: authUser.id,
          fileName: args.input.fileName,
          fileType: args.input.fileType,
          contentType,
          lessonId: args.input.lessonId,
          courseId: args.input.courseId
        });
        
        return {
          uploadUrl: result.uploadUrl,
          fileKey: result.s3Key,
          expiresIn: Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
          maxFileSize: args.input.fileType === 'video' ? MAX_FILE_SIZES.video : MAX_FILE_SIZES.document
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof ExternalServiceError) {
          throw new GraphQLError('Failed to generate upload URL', {
            extensions: {
              code: 'EXTERNAL_SERVICE_ERROR',
              http: { status: 502 }
            }
          });
        }
        
        throw new GraphQLError('Failed to generate upload URL', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Upload course resource (for direct file uploads)
     */
    uploadCourseResource: (_parent: unknown, _args: { input: UploadCourseResourceInput }, _context: GraphQLContext): Promise<never> => {
      // Note: This resolver would typically be used with multipart uploads
      // For now, we'll return an error indicating this should use the presigned URL flow
      throw new GraphQLError('Direct file uploads not supported. Use generateUploadUrl instead.', {
        extensions: {
          code: 'BAD_USER_INPUT',
          http: { status: 400 }
        }
      });
    },

    /**
     * Delete content by S3 key
     */
    deleteContent: async (_parent: unknown, args: { fileKey: string }, context: GraphQLContext): Promise<boolean> => {
      const authUser = requireAuth(context);
      
      try {
        await context.contentService.deleteContent({
          fileKey: args.fileKey,
          userId: authUser.id
        });
        
        return true;
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Content not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to delete this content', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof ExternalServiceError) {
          throw new GraphQLError('Failed to delete content from storage', {
            extensions: {
              code: 'EXTERNAL_SERVICE_ERROR',
              http: { status: 502 }
            }
          });
        }
        
        throw new GraphQLError('Failed to delete content', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Delete video asset by ID
     */
    deleteVideoAsset: async (_parent: unknown, args: { id: string }, context: GraphQLContext): Promise<boolean> => {
      const authUser = requireAuth(context);
      
      try {
        // Find the video asset first to get the S3 key
        const videoAsset = await context.contentRepository.findVideoAssetById(args.id);
        if (!videoAsset) {
          throw new GraphQLError('Video asset not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        // Check authorization
        if (videoAsset.uploadedBy !== authUser.id && authUser.role !== 'admin') {
          throw new GraphQLError('Access denied to delete this video', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        await context.contentService.deleteContent({
          fileKey: videoAsset.s3Key,
          userId: authUser.id
        });
        
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to delete video asset', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Delete file asset by ID
     */
    deleteFileAsset: async (_parent: unknown, args: { id: string }, context: GraphQLContext): Promise<boolean> => {
      const authUser = requireAuth(context);
      
      try {
        // Find the file asset first to get the S3 key
        const fileAsset = await context.contentRepository.findFileAssetById(args.id);
        if (!fileAsset) {
          throw new GraphQLError('File asset not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        // Check authorization
        if (fileAsset.uploadedBy !== authUser.id && authUser.role !== 'admin') {
          throw new GraphQLError('Access denied to delete this file', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        await context.contentService.deleteContent({
          fileKey: fileAsset.s3Key,
          userId: authUser.id
        });
        
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to delete file asset', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  }
};