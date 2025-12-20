/**
 * Upload System - Main Export
 * 
 * Comprehensive file upload system with presigned URL workflow,
 * progress tracking, queue management, and error recovery.
 */

// Provider and context
export { UploadProvider, useUploadContext } from './provider';

// Types
export type {
  UploadProgress,
  UploadStatus,
  UploadOptions,
  UploadError,
  UploadResult,
  PresignedUploadData,
  FileValidationOptions,
  FileValidationResult,
  UploadQueueItem,
  UploadQueueConfig,
  UploadQueueStats,
} from './uploadTypes';

// Utilities
export {
  FileValidator,
  UploadProgressCalculator,
  UploadErrorHandler,
  UploadUtils,
} from './uploadHelpers';

// Queue Management
export { UploadQueue } from './uploadQueue';

// React Hooks
export {
  useFileUpload,
  useVideoUpload,
  useUploadQueue,
  useUploadProgress,
} from './uploadHooks';

// Re-export commonly used types for convenience
export type { UploadQueueConfig as QueueConfig } from './uploadTypes';
export type { FileValidationOptions as ValidationOptions } from './uploadTypes';