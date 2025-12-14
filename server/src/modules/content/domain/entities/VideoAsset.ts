/**
 * Video Asset Domain Entity
 *
 * Represents a video file with processing status, metadata, and streaming information.
 * Encapsulates business logic for video asset management.
 *
 * Requirements:
 * - 4.1: Video upload and processing with S3 integration
 * - 4.4: Video processing status tracking and completion handling
 */

import { ProcessingStatus } from '../../../../infrastructure/database/schema/content.schema.js';

export interface VideoResolution {
  resolution: string; // e.g., "1080p", "720p", "480p"
  url: string;
  bitrate: number; // kbps
  width: number;
  height: number;
}

export interface StreamingUrls {
  hls?: string;
  dash?: string;
  mp4?: Record<string, string>; // resolution -> url mapping
}

export interface VideoMetadata {
  codec?: string;
  container?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  subtitles?: string[];
  chapters?: Array<{
    title: string;
    startTime: number;
    endTime: number;
  }>;
  [key: string]: unknown;
}

/**
 * Video Asset Domain Entity
 *
 * Encapsulates video asset business logic and validation rules
 */
export class VideoAsset {
  constructor(
    public readonly id: string,
    public readonly lessonId: string | null,
    public readonly uploadedBy: string,
    public readonly originalFileName: string,
    public readonly originalFileSize: number,
    public readonly mimeType: string,
    public readonly s3Bucket: string,
    public readonly s3Key: string,
    public readonly s3Region: string,
    public processingStatus: ProcessingStatus,
    public readonly processingJobId: string | null = null,
    public readonly processingStartedAt: Date | null = null,
    public readonly processingCompletedAt: Date | null = null,
    public readonly processingErrorMessage: string | null = null,
    public readonly durationSeconds: number | null = null,
    public readonly originalResolution: string | null = null,
    public readonly originalBitrate: number | null = null,
    public readonly originalFrameRate: number | null = null,
    public readonly hlsManifestUrl: string | null = null,
    public readonly thumbnailUrl: string | null = null,
    public readonly previewUrl: string | null = null,
    public readonly availableResolutions: VideoResolution[] = [],
    public readonly cloudfrontDistribution: string | null = null,
    public readonly streamingUrls: StreamingUrls = {},
    public readonly metadata: VideoMetadata = {},
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validateVideoAsset();
  }

  /**
   * Validate video asset data
   */
  private validateVideoAsset(): void {
    if (!this.id) {
      throw new Error('Video asset ID is required');
    }

    if (!this.uploadedBy) {
      throw new Error('Video asset must have an uploader');
    }

    if (!this.originalFileName) {
      throw new Error('Original file name is required');
    }

    if (this.originalFileSize <= 0) {
      throw new Error('File size must be greater than 0');
    }

    if (!this.mimeType || !this.mimeType.startsWith('video/')) {
      throw new Error('Invalid video MIME type');
    }

    if (!this.s3Bucket || !this.s3Key || !this.s3Region) {
      throw new Error('S3 storage information is required');
    }
  }

  /**
   * Check if video is currently being processed
   */
  isProcessing(): boolean {
    return this.processingStatus === 'in_progress';
  }

  /**
   * Check if video processing is complete
   */
  isProcessed(): boolean {
    return this.processingStatus === 'completed';
  }

  /**
   * Check if video processing failed
   */
  isProcessingFailed(): boolean {
    return this.processingStatus === 'failed';
  }

  /**
   * Check if video is ready for streaming
   */
  isReadyForStreaming(): boolean {
    return Boolean(
      this.isProcessed() && (this.hlsManifestUrl || Object.keys(this.streamingUrls).length > 0)
    );
  }

  /**
   * Get video duration in human-readable format
   */
  getFormattedDuration(): string | null {
    if (!this.durationSeconds) return null;

    const hours = Math.floor(this.durationSeconds / 3600);
    const minutes = Math.floor((this.durationSeconds % 3600) / 60);
    const seconds = this.durationSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get file size in human-readable format
   */
  getFormattedFileSize(): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.originalFileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get the best available resolution for streaming
   */
  getBestResolution(): VideoResolution | null {
    if (this.availableResolutions.length === 0) return null;

    // Sort by resolution height (descending) and return the highest
    return this.availableResolutions.sort((a, b) => b.height - a.height)[0] || null;
  }

  /**
   * Get resolution by quality preference
   */
  getResolutionByQuality(preferredQuality: string): VideoResolution | null {
    return this.availableResolutions.find((res) => res.resolution === preferredQuality) || null;
  }

  /**
   * Check if video has thumbnail
   */
  hasThumbnail(): boolean {
    return !!this.thumbnailUrl;
  }

  /**
   * Check if video has preview
   */
  hasPreview(): boolean {
    return !!this.previewUrl;
  }

  /**
   * Get processing progress percentage
   */
  getProcessingProgress(): number {
    if (this.processingStatus === 'completed') return 100;
    if (this.processingStatus === 'failed' || this.processingStatus === 'cancelled') return 0;
    if (this.processingStatus === 'pending') return 0;

    // For in_progress, we'd need to get this from the processing job
    // This is a placeholder - actual progress would come from external service
    return 50;
  }

  /**
   * Get S3 object URL (not for streaming, for management)
   */
  getS3Url(): string {
    return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${this.s3Key}`;
  }

  /**
   * Check if video supports adaptive bitrate streaming
   */
  supportsAdaptiveStreaming(): boolean {
    return Boolean(this.hlsManifestUrl) || Boolean(this.streamingUrls.hls);
  }

  /**
   * Get estimated processing time based on file size and duration
   */
  getEstimatedProcessingTime(): number | null {
    if (!this.durationSeconds) return null;

    // Rough estimate: 1 minute of video takes 2-5 minutes to process
    // depending on resolution and complexity
    const baseTime = this.durationSeconds * 3; // 3x real-time as baseline
    const sizeMultiplier = Math.log10(this.originalFileSize / (1024 * 1024)) / 2; // Size factor

    return Math.max(60, baseTime * (1 + sizeMultiplier)); // Minimum 1 minute
  }

  /**
   * Create a copy with updated processing status
   */
  withProcessingStatus(
    status: ProcessingStatus,
    errorMessage?: string,
    completedAt?: Date
  ): VideoAsset {
    return new VideoAsset(
      this.id,
      this.lessonId,
      this.uploadedBy,
      this.originalFileName,
      this.originalFileSize,
      this.mimeType,
      this.s3Bucket,
      this.s3Key,
      this.s3Region,
      status,
      this.processingJobId,
      this.processingStartedAt,
      completedAt || this.processingCompletedAt,
      errorMessage || this.processingErrorMessage,
      this.durationSeconds,
      this.originalResolution,
      this.originalBitrate,
      this.originalFrameRate,
      this.hlsManifestUrl,
      this.thumbnailUrl,
      this.previewUrl,
      this.availableResolutions,
      this.cloudfrontDistribution,
      this.streamingUrls,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a copy with processing results
   */
  withProcessingResults(results: {
    hlsManifestUrl?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    availableResolutions?: VideoResolution[];
    streamingUrls?: StreamingUrls;
    durationSeconds?: number;
    metadata?: VideoMetadata;
  }): VideoAsset {
    return new VideoAsset(
      this.id,
      this.lessonId,
      this.uploadedBy,
      this.originalFileName,
      this.originalFileSize,
      this.mimeType,
      this.s3Bucket,
      this.s3Key,
      this.s3Region,
      this.processingStatus,
      this.processingJobId,
      this.processingStartedAt,
      this.processingCompletedAt,
      this.processingErrorMessage,
      results.durationSeconds || this.durationSeconds,
      this.originalResolution,
      this.originalBitrate,
      this.originalFrameRate,
      results.hlsManifestUrl || this.hlsManifestUrl,
      results.thumbnailUrl || this.thumbnailUrl,
      results.previewUrl || this.previewUrl,
      results.availableResolutions || this.availableResolutions,
      this.cloudfrontDistribution,
      results.streamingUrls || this.streamingUrls,
      { ...this.metadata, ...results.metadata },
      this.createdAt,
      new Date()
    );
  }
}
