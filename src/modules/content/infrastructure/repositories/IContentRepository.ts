/**
 * Content Repository Interface
 *
 * Defines the contract for content data access operations including
 * video assets, file assets, and processing jobs.
 *
 * Requirements:
 * - 4.1: Video upload and file metadata tracking
 * - 4.4: Video processing status tracking and completion handling
 */

import {
  VideoAsset,
  NewVideoAsset,
  FileAsset,
  NewFileAsset,
  ProcessingJob,
  NewProcessingJob,
  ProcessingStatus,
  AssetType,
} from '../../../../infrastructure/database/schema/content.schema.js';

export interface VideoAssetFilters {
  lessonId?: string;
  uploadedBy?: string;
  processingStatus?: ProcessingStatus;
  processingJobId?: string;
}

export interface FileAssetFilters {
  courseId?: string;
  lessonId?: string;
  uploadedBy?: string;
  assetType?: AssetType;
  accessLevel?: string;
  isPublic?: boolean;
}

export interface ProcessingJobFilters {
  videoAssetId?: string;
  fileAssetId?: string;
  jobType?: string;
  status?: ProcessingStatus;
  externalJobId?: string;
  priority?: number;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Content Repository Interface
 *
 * Provides data access methods for content management including
 * video assets, file assets, and processing jobs.
 */
export interface IContentRepository {
  // Video Asset Operations

  /**
   * Create a new video asset record
   * @param videoAsset - Video asset data to create
   * @returns Promise resolving to the created video asset
   */
  createVideoAsset(videoAsset: NewVideoAsset): Promise<VideoAsset>;

  /**
   * Find video asset by ID
   * @param id - Video asset ID
   * @returns Promise resolving to video asset or null if not found
   */
  findVideoAssetById(id: string): Promise<VideoAsset | null>;

  /**
   * Find video asset by S3 key
   * @param s3Bucket - S3 bucket name
   * @param s3Key - S3 object key
   * @returns Promise resolving to video asset or null if not found
   */
  findVideoAssetByS3Key(s3Bucket: string, s3Key: string): Promise<VideoAsset | null>;

  /**
   * Find video asset by processing job ID
   * @param processingJobId - External processing job ID
   * @returns Promise resolving to video asset or null if not found
   */
  findVideoAssetByProcessingJobId(processingJobId: string): Promise<VideoAsset | null>;

  /**
   * Find video assets with filters and pagination
   * @param filters - Filter criteria
   * @param pagination - Pagination options
   * @returns Promise resolving to paginated video assets
   */
  findVideoAssets(
    filters?: VideoAssetFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<VideoAsset>>;

  /**
   * Update video asset
   * @param id - Video asset ID
   * @param updates - Partial video asset data to update
   * @returns Promise resolving to updated video asset
   */
  updateVideoAsset(id: string, updates: Partial<VideoAsset>): Promise<VideoAsset>;

  /**
   * Update video asset processing status
   * @param id - Video asset ID
   * @param status - New processing status
   * @param metadata - Optional metadata to update
   * @returns Promise resolving to updated video asset
   */
  updateVideoAssetProcessingStatus(
    id: string,
    status: ProcessingStatus,
    metadata?: Record<string, unknown>
  ): Promise<VideoAsset>;

  /**
   * Delete video asset
   * @param id - Video asset ID
   * @returns Promise resolving when deletion is complete
   */
  deleteVideoAsset(id: string): Promise<void>;

  // File Asset Operations

  /**
   * Create a new file asset record
   * @param fileAsset - File asset data to create
   * @returns Promise resolving to the created file asset
   */
  createFileAsset(fileAsset: NewFileAsset): Promise<FileAsset>;

  /**
   * Find file asset by ID
   * @param id - File asset ID
   * @returns Promise resolving to file asset or null if not found
   */
  findFileAssetById(id: string): Promise<FileAsset | null>;

  /**
   * Find file asset by S3 key
   * @param s3Bucket - S3 bucket name
   * @param s3Key - S3 object key
   * @returns Promise resolving to file asset or null if not found
   */
  findFileAssetByS3Key(s3Bucket: string, s3Key: string): Promise<FileAsset | null>;

  /**
   * Find file assets with filters and pagination
   * @param filters - Filter criteria
   * @param pagination - Pagination options
   * @returns Promise resolving to paginated file assets
   */
  findFileAssets(
    filters?: FileAssetFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<FileAsset>>;

  /**
   * Update file asset
   * @param id - File asset ID
   * @param updates - Partial file asset data to update
   * @returns Promise resolving to updated file asset
   */
  updateFileAsset(id: string, updates: Partial<FileAsset>): Promise<FileAsset>;

  /**
   * Delete file asset
   * @param id - File asset ID
   * @returns Promise resolving when deletion is complete
   */
  deleteFileAsset(id: string): Promise<void>;

  /**
   * Find expired file assets
   * @param beforeDate - Date to check expiration against
   * @returns Promise resolving to array of expired file assets
   */
  findExpiredFileAssets(beforeDate: Date): Promise<FileAsset[]>;

  // Processing Job Operations

  /**
   * Create a new processing job record
   * @param processingJob - Processing job data to create
   * @returns Promise resolving to the created processing job
   */
  createProcessingJob(processingJob: NewProcessingJob): Promise<ProcessingJob>;

  /**
   * Find processing job by ID
   * @param id - Processing job ID
   * @returns Promise resolving to processing job or null if not found
   */
  findProcessingJobById(id: string): Promise<ProcessingJob | null>;

  /**
   * Find processing job by external job ID
   * @param externalJobId - External service job ID
   * @returns Promise resolving to processing job or null if not found
   */
  findProcessingJobByExternalId(externalJobId: string): Promise<ProcessingJob | null>;

  /**
   * Find processing jobs with filters and pagination
   * @param filters - Filter criteria
   * @param pagination - Pagination options
   * @returns Promise resolving to paginated processing jobs
   */
  findProcessingJobs(
    filters?: ProcessingJobFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ProcessingJob>>;

  /**
   * Find pending processing jobs ready for execution
   * @param limit - Maximum number of jobs to return
   * @returns Promise resolving to array of pending jobs
   */
  findPendingProcessingJobs(limit?: number): Promise<ProcessingJob[]>;

  /**
   * Find failed processing jobs ready for retry
   * @param beforeDate - Date to check retry time against
   * @param limit - Maximum number of jobs to return
   * @returns Promise resolving to array of jobs ready for retry
   */
  findJobsReadyForRetry(beforeDate: Date, limit?: number): Promise<ProcessingJob[]>;

  /**
   * Update processing job
   * @param id - Processing job ID
   * @param updates - Partial processing job data to update
   * @returns Promise resolving to updated processing job
   */
  updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob>;

  /**
   * Update processing job status
   * @param id - Processing job ID
   * @param status - New processing status
   * @param progress - Optional progress percentage (0-100)
   * @param result - Optional result data
   * @param errorMessage - Optional error message if failed
   * @returns Promise resolving to updated processing job
   */
  updateProcessingJobStatus(
    id: string,
    status: ProcessingStatus,
    progress?: number,
    result?: Record<string, unknown>,
    errorMessage?: string
  ): Promise<ProcessingJob>;

  /**
   * Increment processing job attempt count and set next retry time
   * @param id - Processing job ID
   * @param nextRetryAt - Next retry timestamp
   * @returns Promise resolving to updated processing job
   */
  incrementJobAttempt(id: string, nextRetryAt: Date): Promise<ProcessingJob>;

  /**
   * Delete processing job
   * @param id - Processing job ID
   * @returns Promise resolving when deletion is complete
   */
  deleteProcessingJob(id: string): Promise<void>;

  // Bulk Operations

  /**
   * Delete multiple video assets by IDs
   * @param ids - Array of video asset IDs
   * @returns Promise resolving when deletion is complete
   */
  deleteVideoAssetsBulk(ids: string[]): Promise<void>;

  /**
   * Delete multiple file assets by IDs
   * @param ids - Array of file asset IDs
   * @returns Promise resolving when deletion is complete
   */
  deleteFileAssetsBulk(ids: string[]): Promise<void>;

  /**
   * Update multiple processing jobs status
   * @param ids - Array of processing job IDs
   * @param status - New status to set
   * @returns Promise resolving to number of updated jobs
   */
  updateProcessingJobsStatusBulk(ids: string[], status: ProcessingStatus): Promise<number>;
}
