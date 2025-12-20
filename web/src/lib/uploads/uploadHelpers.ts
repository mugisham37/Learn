/**
 * Upload Workflow Utilities
 * 
 * Core utilities for implementing the two-step presigned URL upload process
 * with file validation, progress tracking, and error recovery.
 */

import type {
  UploadProgress,
  UploadError,
  PresignedUploadData,
  FileValidationOptions,
  FileValidationResult,
} from './uploadTypes';

/**
 * File validation utilities
 */
export class FileValidator {
  private static readonly DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly DEFAULT_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  /**
   * Validates a file against the specified criteria
   */
  static validateFile(
    file: File,
    options: FileValidationOptions = {}
  ): FileValidationResult {
    const errors: string[] = [];
    const maxFileSize = options.maxFileSize || this.DEFAULT_MAX_FILE_SIZE;
    const allowedMimeTypes = options.allowedMimeTypes || this.DEFAULT_ALLOWED_TYPES;
    const allowedExtensions = options.allowedExtensions;

    // Check file size
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension if specified
    if (allowedExtensions) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        errors.push(`File extension .${fileExtension} is not allowed`);
      }
    }

    // Check for empty file
    if (file.size === 0) {
      errors.push('File cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets human-readable file size
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Checks if file is an image
   */
  static isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Checks if file is a video
   */
  static isVideo(file: File): boolean {
    return file.type.startsWith('video/');
  }

  /**
   * Checks if file is a document
   */
  static isDocument(file: File): boolean {
    return file.type.startsWith('application/') || file.type.startsWith('text/');
  }
}

/**
 * Upload progress calculator
 */
export class UploadProgressCalculator {
  private startTime: number;
  private lastUpdateTime: number;
  private lastLoaded: number;
  private speedSamples: number[] = [];
  private readonly maxSamples = 10;

  constructor() {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastLoaded = 0;
  }

  /**
   * Calculates upload progress with speed and time remaining
   */
  calculateProgress(
    uploadId: string,
    loaded: number,
    total: number,
    fileName?: string
  ): UploadProgress {
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastUpdateTime;
    const loadedDiff = loaded - this.lastLoaded;

    // Calculate speed (bytes per second)
    let speed = 0;
    if (timeDiff > 0) {
      const currentSpeed = loadedDiff / (timeDiff / 1000);
      this.speedSamples.push(currentSpeed);
      
      // Keep only recent samples
      if (this.speedSamples.length > this.maxSamples) {
        this.speedSamples.shift();
      }
      
      // Average speed over recent samples
      speed = this.speedSamples.reduce((sum, s) => sum + s, 0) / this.speedSamples.length;
    }

    // Calculate time remaining
    const remaining = total - loaded;
    const timeRemaining = speed > 0 ? remaining / speed : 0;

    // Calculate percentage
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;

    // Update tracking values
    this.lastUpdateTime = currentTime;
    this.lastLoaded = loaded;

    return {
      uploadId,
      loaded,
      total,
      percentage,
      speed: Math.max(0, speed),
      timeRemaining: Math.max(0, timeRemaining),
      status: loaded >= total ? 'completed' : 'uploading',
      fileName: fileName || undefined,
    };
  }

  /**
   * Resets the progress calculator
   */
  reset(): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastLoaded = 0;
    this.speedSamples = [];
  }
}

/**
 * Upload error handler
 */
export class UploadErrorHandler {
  /**
   * Creates a standardized upload error
   */
  static createError(
    uploadId: string,
    code: string,
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>
  ): UploadError {
    return {
      uploadId,
      code,
      message,
      retryable,
      details,
    };
  }

  /**
   * Determines if an error is retryable
   */
  static isRetryable(error: Error | UploadError): boolean {
    if ('retryable' in error) {
      return error.retryable;
    }

    // Network errors are generally retryable
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return true;
    }

    // Timeout errors are retryable
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504')) {
      return true;
    }

    // Client errors (4xx) are generally not retryable
    return false;
  }

  /**
   * Gets retry delay with exponential backoff
   */
  static getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
    const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Formats error message for user display
   */
  static formatErrorMessage(error: Error | UploadError): string {
    if ('code' in error) {
      switch (error.code) {
        case 'FILE_TOO_LARGE':
          return 'File is too large. Please choose a smaller file.';
        case 'INVALID_FILE_TYPE':
          return 'File type is not supported. Please choose a different file.';
        case 'NETWORK_ERROR':
          return 'Network error occurred. Please check your connection and try again.';
        case 'SERVER_ERROR':
          return 'Server error occurred. Please try again later.';
        case 'UPLOAD_CANCELLED':
          return 'Upload was cancelled.';
        case 'UPLOAD_TIMEOUT':
          return 'Upload timed out. Please try again.';
        default:
          return error.message || 'An unknown error occurred during upload.';
      }
    }

    return error.message || 'An unknown error occurred during upload.';
  }
}

/**
 * Utility functions for upload operations
 */
export class UploadUtils {
  /**
   * Generates a unique upload ID
   */
  static generateUploadId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Creates FormData for S3 upload
   */
  static createUploadFormData(
    file: File,
    presignedData: PresignedUploadData
  ): FormData {
    const formData = new FormData();

    // Add presigned URL fields first
    Object.entries(presignedData.fields || {}).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Add the file last (required by S3)
    formData.append('file', file);

    return formData;
  }

  /**
   * Checks if presigned URL is expired
   */
  static isPresignedUrlExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Formats upload speed for display
   */
  static formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Formats time remaining for display
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds === 0 || !isFinite(seconds)) return 'Unknown';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Debounces progress updates to prevent excessive re-renders
   */
  static debounceProgressUpdate(
    callback: (progress: UploadProgress) => void,
    delay: number = 100
  ): (progress: UploadProgress) => void {
    let timeoutId: NodeJS.Timeout;
    let lastProgress: UploadProgress;

    return (progress: UploadProgress) => {
      lastProgress = progress;
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback(lastProgress);
      }, delay);
    };
  }
}