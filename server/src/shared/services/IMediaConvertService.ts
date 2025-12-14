/**
 * MediaConvert Service Interface
 *
 * Defines the contract for AWS MediaConvert operations including
 * video transcoding job creation, status monitoring, and configuration.
 *
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 */

/**
 * MediaConvert job input configuration
 */
export interface TranscodingJobInput {
  inputS3Bucket: string;
  inputS3Key: string;
  outputS3Bucket: string;
  outputS3KeyPrefix: string;
  jobName: string;
  resolutions: TranscodingResolution[];
  hlsSegmentDuration?: number;
  thumbnailGeneration?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Transcoding resolution configuration
 */
export interface TranscodingResolution {
  name: string; // '1080p', '720p', '480p', '360p'
  width: number;
  height: number;
  bitrate: number; // in bps
  maxBitrate?: number;
}

/**
 * MediaConvert job status information
 */
export interface JobStatus {
  jobId: string;
  status: 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'CANCELED' | 'ERROR';
  progress?: number; // 0-100
  errorMessage?: string;
  errorCode?: string;
  createdAt?: Date;
  completedAt?: Date;
  outputs?: TranscodingJobOutput[];
}

/**
 * Transcoding job output information
 */
export interface TranscodingJobOutput {
  resolution: string;
  outputS3Key: string;
  outputUrl: string;
  bitrate: number;
  fileSize?: number;
  duration?: number;
}

/**
 * MediaConvert job creation result
 */
export interface CreateJobResult {
  jobId: string;
  jobArn: string;
  status: string;
}

/**
 * MediaConvert Service Interface
 *
 * Provides AWS MediaConvert operations for video transcoding
 * with support for multiple resolutions and HLS streaming.
 */
export interface IMediaConvertService {
  /**
   * Creates a transcoding job for video processing
   *
   * @param input - Job configuration parameters
   * @returns Promise resolving to job creation result
   * @throws ExternalServiceError if job creation fails
   */
  createTranscodingJob(input: TranscodingJobInput): Promise<CreateJobResult>;

  /**
   * Gets the status of a transcoding job
   *
   * @param jobId - MediaConvert job ID
   * @returns Promise resolving to job status information
   * @throws NotFoundError if job not found
   * @throws ExternalServiceError if status retrieval fails
   */
  getJobStatus(jobId: string): Promise<JobStatus>;

  /**
   * Cancels a running transcoding job
   *
   * @param jobId - MediaConvert job ID
   * @returns Promise resolving when job is cancelled
   * @throws NotFoundError if job not found
   * @throws ExternalServiceError if cancellation fails
   */
  cancelJob(jobId: string): Promise<void>;

  /**
   * Lists recent transcoding jobs
   *
   * @param maxResults - Maximum number of jobs to return (default: 20)
   * @param nextToken - Pagination token for next page
   * @returns Promise resolving to job list
   * @throws ExternalServiceError if listing fails
   */
  listJobs(
    maxResults?: number,
    nextToken?: string
  ): Promise<{
    jobs: JobStatus[];
    nextToken?: string;
  }>;

  /**
   * Gets MediaConvert service endpoint for the current region
   *
   * @returns Promise resolving to service endpoint URL
   * @throws ExternalServiceError if endpoint retrieval fails
   */
  getServiceEndpoint(): Promise<string>;

  /**
   * Validates MediaConvert configuration
   *
   * @returns Promise resolving to validation result
   * @throws ExternalServiceError if configuration is invalid
   */
  validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
  }>;
}

/**
 * Default transcoding resolutions for adaptive bitrate streaming
 */
export const DEFAULT_TRANSCODING_RESOLUTIONS: TranscodingResolution[] = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    bitrate: 5000000, // 5 Mbps
    maxBitrate: 7500000, // 7.5 Mbps
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    bitrate: 3000000, // 3 Mbps
    maxBitrate: 4500000, // 4.5 Mbps
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    bitrate: 1500000, // 1.5 Mbps
    maxBitrate: 2250000, // 2.25 Mbps
  },
  {
    name: '360p',
    width: 640,
    height: 360,
    bitrate: 800000, // 800 Kbps
    maxBitrate: 1200000, // 1.2 Mbps
  },
];

/**
 * MediaConvert job template for HLS streaming
 */
export const HLS_JOB_TEMPLATE = {
  segmentDuration: 6, // seconds
  segmentControl: 'SEGMENTED_FILES',
  manifestCompression: 'NONE',
  captionLanguageSetting: 'OMIT',
  captionLanguageMappings: [],
  programDateTimePeriod: 600,
  programDateTime: 'EXCLUDE',
  timedMetadata: 'NONE',
  timedMetadataId3Frame: 'NONE',
  timedMetadataId3Period: 10,
};
