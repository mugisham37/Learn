/**
 * Processing Job Domain Entity
 *
 * Represents an asynchronous processing job for video transcoding and file processing.
 * Encapsulates business logic for job management, retry logic, and status tracking.
 *
 * Requirements:
 * - 4.2: MediaConvert job tracking
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 */

import { ProcessingStatus } from '../../../../infrastructure/database/schema/content.schema.js';

export type JobType =
  | 'video_transcode'
  | 'image_process'
  | 'document_convert'
  | 'audio_process'
  | 'thumbnail_generate';

export interface JobConfiguration {
  // Video transcoding configuration
  outputFormats?: string[]; // ['hls', 'mp4', 'webm']
  resolutions?: string[]; // ['1080p', '720p', '480p', '360p']
  bitrates?: Record<string, number>; // resolution -> bitrate mapping

  // Image processing configuration
  thumbnailSizes?: Array<{ width: number; height: number; quality?: number }>;
  compressionQuality?: number;

  // Document processing configuration
  extractText?: boolean;
  generateThumbnails?: boolean;

  // Audio processing configuration
  audioFormats?: string[]; // ['mp3', 'aac', 'ogg']
  audioBitrates?: number[];

  // General configuration
  priority?: number;
  timeout?: number; // seconds
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number; // seconds
  };

  [key: string]: any;
}

export interface JobResult {
  // Video transcoding results
  hlsManifestUrl?: string;
  mp4Urls?: Record<string, string>; // resolution -> url
  thumbnailUrl?: string;
  previewUrl?: string;
  durationSeconds?: number;

  // Image processing results
  thumbnails?: Array<{ size: string; url: string }>;
  compressedUrl?: string;

  // Document processing results
  extractedText?: string;
  pageCount?: number;
  documentThumbnails?: string[];

  // Audio processing results
  audioUrls?: Record<string, string>; // format -> url
  waveformData?: number[];

  // General results
  outputFiles?: Array<{
    type: string;
    url: string;
    size: number;
    format: string;
  }>;

  [key: string]: any;
}

/**
 * Processing Job Domain Entity
 *
 * Encapsulates processing job business logic and state management
 */
export class ProcessingJob {
  constructor(
    public readonly id: string,
    public readonly videoAssetId: string | null,
    public readonly fileAssetId: string | null,
    public readonly jobType: JobType,
    public readonly externalJobId: string | null = null,
    public readonly externalServiceName: string | null = null,
    public readonly jobConfiguration: JobConfiguration,
    public readonly status: ProcessingStatus = 'pending',
    public readonly progress: number = 0,
    public readonly startedAt: Date | null = null,
    public readonly completedAt: Date | null = null,
    public readonly result: JobResult | null = null,
    public readonly errorMessage: string | null = null,
    public readonly errorCode: string | null = null,
    public readonly attemptCount: number = 0,
    public readonly maxAttempts: number = 3,
    public readonly nextRetryAt: Date | null = null,
    public readonly priority: number = 5,
    public readonly scheduledFor: Date | null = null,
    public readonly metadata: Record<string, any> = {},
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validateProcessingJob();
  }

  /**
   * Validate processing job data
   */
  private validateProcessingJob(): void {
    if (!this.id) {
      throw new Error('Processing job ID is required');
    }

    if (!this.videoAssetId && !this.fileAssetId) {
      throw new Error('Processing job must be associated with either a video asset or file asset');
    }

    if (this.videoAssetId && this.fileAssetId) {
      throw new Error('Processing job cannot be associated with both video asset and file asset');
    }

    if (!this.jobType) {
      throw new Error('Job type is required');
    }

    if (this.progress < 0 || this.progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    if (this.priority < 1 || this.priority > 10) {
      throw new Error('Priority must be between 1 and 10');
    }

    if (this.attemptCount < 0) {
      throw new Error('Attempt count cannot be negative');
    }

    if (this.maxAttempts < 1) {
      throw new Error('Max attempts must be at least 1');
    }
  }

  /**
   * Check if job is pending
   */
  isPending(): boolean {
    return this.status === 'pending';
  }

  /**
   * Check if job is in progress
   */
  isInProgress(): boolean {
    return this.status === 'in_progress';
  }

  /**
   * Check if job is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Check if job has failed
   */
  isFailed(): boolean {
    return this.status === 'failed';
  }

  /**
   * Check if job is cancelled
   */
  isCancelled(): boolean {
    return this.status === 'cancelled';
  }

  /**
   * Check if job is in a final state (completed, failed, or cancelled)
   */
  isFinal(): boolean {
    return this.isCompleted() || this.isFailed() || this.isCancelled();
  }

  /**
   * Check if job can be retried
   */
  canRetry(): boolean {
    return this.isFailed() && this.attemptCount < this.maxAttempts;
  }

  /**
   * Check if job is ready for retry
   */
  isReadyForRetry(): boolean {
    return this.canRetry() && this.nextRetryAt !== null && this.nextRetryAt <= new Date();
  }

  /**
   * Check if job is scheduled for future execution
   */
  isScheduled(): boolean {
    return this.scheduledFor !== null && this.scheduledFor > new Date();
  }

  /**
   * Check if job is ready to execute
   */
  isReadyToExecute(): boolean {
    return this.isPending() && (this.scheduledFor === null || this.scheduledFor <= new Date());
  }

  /**
   * Get job duration if completed
   */
  getDuration(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  /**
   * Get formatted job duration
   */
  getFormattedDuration(): string | null {
    const duration = this.getDuration();
    if (!duration) return null;

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get time until next retry
   */
  getTimeUntilRetry(): number | null {
    if (!this.nextRetryAt) return null;
    return Math.max(0, this.nextRetryAt.getTime() - Date.now());
  }

  /**
   * Get time until scheduled execution
   */
  getTimeUntilScheduled(): number | null {
    if (!this.scheduledFor) return null;
    return Math.max(0, this.scheduledFor.getTime() - Date.now());
  }

  /**
   * Calculate next retry time using exponential backoff
   */
  calculateNextRetryTime(): Date {
    const retryPolicy = this.jobConfiguration.retryPolicy || {
      maxAttempts: this.maxAttempts,
      backoffMultiplier: 2,
      initialDelay: 60, // 1 minute
    };

    const delay =
      retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, this.attemptCount);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter

    return new Date(Date.now() + (delay + jitter) * 1000);
  }

  /**
   * Get estimated completion time based on progress and elapsed time
   */
  getEstimatedCompletionTime(): Date | null {
    if (!this.isInProgress() || !this.startedAt || this.progress === 0) return null;

    const elapsed = Date.now() - this.startedAt.getTime();
    const estimatedTotal = (elapsed / this.progress) * 100;
    const remaining = estimatedTotal - elapsed;

    return new Date(Date.now() + remaining);
  }

  /**
   * Check if job has exceeded timeout
   */
  hasExceededTimeout(): boolean {
    if (!this.isInProgress() || !this.startedAt) return false;

    const timeout = this.jobConfiguration.timeout || 3600; // Default 1 hour
    const elapsed = (Date.now() - this.startedAt.getTime()) / 1000;

    return elapsed > timeout;
  }

  /**
   * Get job priority description
   */
  getPriorityDescription(): string {
    if (this.priority >= 9) return 'Critical';
    if (this.priority >= 7) return 'High';
    if (this.priority >= 4) return 'Normal';
    if (this.priority >= 2) return 'Low';
    return 'Very Low';
  }

  /**
   * Check if job is high priority
   */
  isHighPriority(): boolean {
    return this.priority >= 7;
  }

  /**
   * Get job type description
   */
  getJobTypeDescription(): string {
    switch (this.jobType) {
      case 'video_transcode':
        return 'Video Transcoding';
      case 'image_process':
        return 'Image Processing';
      case 'document_convert':
        return 'Document Conversion';
      case 'audio_process':
        return 'Audio Processing';
      case 'thumbnail_generate':
        return 'Thumbnail Generation';
      default:
        return 'Unknown Job Type';
    }
  }

  /**
   * Create a copy with updated status
   */
  withStatus(
    status: ProcessingStatus,
    progress?: number,
    result?: JobResult,
    errorMessage?: string,
    errorCode?: string
  ): ProcessingJob {
    const now = new Date();

    return new ProcessingJob(
      this.id,
      this.videoAssetId,
      this.fileAssetId,
      this.jobType,
      this.externalJobId,
      this.externalServiceName,
      this.jobConfiguration,
      status,
      progress !== undefined ? progress : this.progress,
      status === 'in_progress' && !this.startedAt ? now : this.startedAt,
      status === 'completed' || status === 'failed' || status === 'cancelled'
        ? now
        : this.completedAt,
      result || this.result,
      errorMessage || this.errorMessage,
      errorCode || this.errorCode,
      this.attemptCount,
      this.maxAttempts,
      this.nextRetryAt,
      this.priority,
      this.scheduledFor,
      this.metadata,
      this.createdAt,
      now
    );
  }

  /**
   * Create a copy with incremented attempt count
   */
  withIncrementedAttempt(nextRetryAt?: Date): ProcessingJob {
    return new ProcessingJob(
      this.id,
      this.videoAssetId,
      this.fileAssetId,
      this.jobType,
      this.externalJobId,
      this.externalServiceName,
      this.jobConfiguration,
      this.status,
      this.progress,
      this.startedAt,
      this.completedAt,
      this.result,
      this.errorMessage,
      this.errorCode,
      this.attemptCount + 1,
      this.maxAttempts,
      nextRetryAt || this.calculateNextRetryTime(),
      this.priority,
      this.scheduledFor,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a copy with external job ID
   */
  withExternalJobId(externalJobId: string, externalServiceName?: string): ProcessingJob {
    return new ProcessingJob(
      this.id,
      this.videoAssetId,
      this.fileAssetId,
      this.jobType,
      externalJobId,
      externalServiceName || this.externalServiceName,
      this.jobConfiguration,
      this.status,
      this.progress,
      this.startedAt,
      this.completedAt,
      this.result,
      this.errorMessage,
      this.errorCode,
      this.attemptCount,
      this.maxAttempts,
      this.nextRetryAt,
      this.priority,
      this.scheduledFor,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }
}
