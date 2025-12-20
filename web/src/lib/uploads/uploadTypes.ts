/**
 * Upload System Types
 * 
 * Type definitions for the file upload system including progress tracking,
 * queue management, and error handling.
 */

export interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: UploadStatus;
  error?: string | undefined;
  fileName?: string | undefined;
}

export type UploadStatus = 
  | 'pending' 
  | 'uploading' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'paused';

export interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  priority?: number;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
  onComplete?: (result: UploadResult) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

export interface UploadError {
  uploadId: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | undefined;
}

export interface UploadResult {
  id: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: string;
}

export interface PresignedUploadData {
  uploadUrl: string;
  fileKey: string;
  fields: Record<string, string>;
  expiresAt: string;
}

export interface FileValidationOptions {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

export interface UploadQueueItem {
  uploadId: string;
  file: File;
  options: UploadOptions;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: UploadProgress;
  abortController?: AbortController;
  retryCount: number;
  maxRetries: number;
}

export interface UploadQueueConfig {
  maxConcurrentUploads: number;
  maxRetries: number;
  retryDelay: number;
  priorityLevels: number;
}

export interface UploadQueueStats {
  total: number;
  pending: number;
  uploading: number;
  completed: number;
  failed: number;
  cancelled: number;
}