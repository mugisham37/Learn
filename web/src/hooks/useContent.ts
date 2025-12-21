/**
 * Content Management Hooks
 * 
 * React hooks for content-related operations including file uploads,
 * video processing, streaming URLs, and upload progress tracking.
 * 
 * This module provides comprehensive content management capabilities
 * with full backend integration for S3 uploads, MediaConvert processing,
 * and CloudFront streaming.
 */

import { useMutation, useQuery, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useCallback } from 'react';
import type {
  VideoProcessingStatus,
  StreamingUrl,
} from '../types';
import type {
  GetStreamingUrlResponse,
  GetVideoAssetResponse,
  GetFileAssetResponse,
  GetVideoProcessingStatusResponse,
} from '../types/graphql-responses';
import {
  useFileUpload as useFileUploadCore,
  useVideoUpload as useVideoUploadCore,
  useUploadProgress as useUploadProgressCore,
  type UploadProgress as CoreUploadProgress,
  type UploadOptions as CoreUploadOptions,
} from '../lib/uploads';

// GraphQL Queries and Mutations
const GET_STREAMING_URL = gql`
  query GetStreamingUrl($lessonId: ID!, $resolution: String, $format: String) {
    generateStreamingUrl(lessonId: $lessonId, resolution: $resolution, format: $format) {
      streamingUrl
      expiresAt
      resolution
      format
    }
  }
`;

const GET_VIDEO_ASSET = gql`
  query GetVideoAsset($id: ID!) {
    videoAsset(id: $id) {
      id
      lesson {
        id
      }
      uploadedBy {
        id
      }
      originalFileName
      originalFileSize
      mimeType
      s3Bucket
      s3Key
      s3Region
      processingStatus
      processingJobId
      processingStartedAt
      processingCompletedAt
      processingErrorMessage
      durationSeconds
      originalResolution
      originalBitrate
      originalFrameRate
      hlsManifestUrl
      thumbnailUrl
      previewUrl
      availableResolutions {
        resolution
        url
        bitrate
        width
        height
      }
      cloudfrontDistribution
      streamingUrls {
        hls
        dash
        mp4
      }
      metadata
      createdAt
      updatedAt
      formattedDuration
      formattedFileSize
      isProcessing
      isProcessed
      isProcessingFailed
      isReadyForStreaming
      processingProgress
      bestResolution {
        resolution
        url
        bitrate
        width
        height
      }
      hasThumbnail
      hasPreview
      supportsAdaptiveStreaming
    }
  }
`;

const GET_FILE_ASSET = gql`
  query GetFileAsset($id: ID!) {
    fileAsset(id: $id) {
      id
      course {
        id
      }
      lesson {
        id
      }
      uploadedBy {
        id
      }
      fileName
      originalFileName
      fileSize
      mimeType
      assetType
      s3Bucket
      s3Key
      s3Region
      isPublic
      accessLevel
      cloudfrontUrl
      processingStatus
      processingErrorMessage
      variants {
        thumbnail
        compressed
        preview
      }
      description
      tags
      metadata
      expiresAt
      createdAt
      updatedAt
      formattedFileSize
      fileExtension
      displayName
      isImage
      isDocument
      isAudio
      isArchive
      isProcessing
      isProcessed
      isProcessingFailed
      isExpired
      isPubliclyAccessible
      cdnUrl
      thumbnailUrl
      previewUrl
      compressedUrl
      hasThumbnail
      hasPreview
      imageDimensions {
        width
        height
      }
      pageCount
      isSafeForPreview
      timeUntilExpiration
      isExpiringSoon
      iconClass
    }
  }
`;

const GET_VIDEO_PROCESSING_STATUS = gql`
  query GetVideoProcessingStatus($videoAssetId: ID!) {
    videoProcessingStatus(videoAssetId: $videoAssetId) {
      id
      videoAsset {
        id
      }
      jobType
      externalJobId
      externalServiceName
      status
      progress
      startedAt
      completedAt
      result
      errorMessage
      errorCode
      attemptCount
      maxAttempts
      nextRetryAt
      priority
      scheduledFor
      metadata
      createdAt
      updatedAt
      isPending
      isInProgress
      isCompleted
      isFailed
      isCancelled
      isFinal
      canRetry
      isReadyForRetry
      isScheduled
      isReadyToExecute
      duration
      formattedDuration
      timeUntilRetry
      timeUntilScheduled
      estimatedCompletionTime
      hasExceededTimeout
      priorityDescription
      isHighPriority
      jobTypeDescription
    }
  }
`;

const DELETE_CONTENT = gql`
  mutation DeleteContent($fileKey: String!) {
    deleteContent(fileKey: $fileKey)
  }
`;

const DELETE_VIDEO_ASSET = gql`
  mutation DeleteVideoAsset($id: ID!) {
    deleteVideoAsset(id: $id)
  }
`;

const DELETE_FILE_ASSET = gql`
  mutation DeleteFileAsset($id: ID!) {
    deleteFileAsset(id: $id)
  }
`;

const RETRY_PROCESSING_JOB = gql`
  mutation RetryProcessingJob($id: ID!) {
    retryProcessingJob(id: $id) {
      id
      status
      progress
      nextRetryAt
      attemptCount
    }
  }
`;

const CANCEL_PROCESSING_JOB = gql`
  mutation CancelProcessingJob($id: ID!) {
    cancelProcessingJob(id: $id) {
      id
      status
    }
  }
`;

// Subscription for real-time video processing updates
const VIDEO_PROCESSING_UPDATES = gql`
  subscription VideoProcessingUpdates($videoAssetId: ID!) {
    videoProcessingUpdates(videoAssetId: $videoAssetId) {
      id
      videoAssetId
      status
      progress
      errorMessage
      completedAt
    }
  }
`;

// Legacy types for backward compatibility
interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string | undefined;
  fileName?: string | undefined;
}

interface UploadOptions {
  courseId?: string | undefined;
  lessonId?: string | undefined;
  onProgress?: (progress: UploadProgress) => void | undefined;
  onError?: (error: Error) => void | undefined;
  onComplete?: (result: unknown) => void | undefined;
}

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any;
  refetch: () => Promise<void>;
  fetchMore?: (options: { variables: any }) => Promise<void>;
}

interface FileUploadResult {
  uploadFile: (file: File, options?: UploadOptions) => Promise<unknown>;
  uploadProgress: UploadProgress | null;
  cancelUpload: () => void;
  loading: boolean;
  error: unknown;
}

interface VideoUploadResult {
  uploadVideo: (file: File, lessonId: string, options?: UploadOptions) => Promise<unknown>;
  uploadProgress: UploadProgress | null;
  processingStatus: VideoProcessingStatus | null;
  cancelUpload: () => void;
  loading: boolean;
  error: unknown;
}

interface AssetManagementResult {
  deleteAsset: (assetId: string, assetType?: 'video' | 'file') => Promise<boolean>;
  deleteContent: (fileKey: string) => Promise<boolean>;
  retryProcessing: (jobId: string) => Promise<void>;
  cancelProcessing: (jobId: string) => Promise<void>;
  loading: boolean;
  error: any;
}

/**
 * Hook for general file uploads using the two-step presigned URL workflow
 * 
 * Integrates with backend S3 presigned URL generation and file completion
 * 
 * @returns File upload utilities with progress tracking
 * 
 * @example
 * ```tsx
 * function FileUploadComponent() {
 *   const { uploadFile, uploadProgress, cancelUpload, loading, error } = useFileUpload();
 *   
 *   const handleFileSelect = async (file: File) => {
 *     try {
 *       const result = await uploadFile(file, {
 *         courseId: 'course-123',
 *         onProgress: (progress) => {
 *           console.log(`Upload progress: ${progress.percentage}%`);
 *         },
 *         onComplete: (result) => {
 *           console.log('Upload completed:', result);
 *         }
 *       });
 *     } catch (err) {
 *       console.error('Upload failed:', err);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <input type="file" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
 *       {uploadProgress && (
 *         <div>
 *           <div>Progress: {uploadProgress.percentage}%</div>
 *           <div>Speed: {UploadUtils.formatSpeed(uploadProgress.speed)}</div>
 *           <button onClick={cancelUpload}>Cancel</button>
 *         </div>
 *       )}
 *       {error && <div>Error: {UploadErrorHandler.formatErrorMessage(error)}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload(): FileUploadResult {
  // Delegate to the new upload system which now integrates with real backend
  const coreUpload = useFileUploadCore();
  
  // Map the interface to maintain backward compatibility
  const mapProgress = (progress: CoreUploadProgress | null): UploadProgress | null => {
    if (!progress) return null;
    
    return {
      uploadId: progress.uploadId,
      loaded: progress.loaded,
      total: progress.total,
      percentage: progress.percentage,
      speed: progress.speed,
      timeRemaining: progress.timeRemaining,
      status: progress.status === 'failed' ? 'error' : 
              progress.status === 'processing' ? 'uploading' :
              progress.status as 'pending' | 'uploading' | 'completed' | 'cancelled',
      error: progress.error,
      fileName: progress.fileName,
    };
  };

  const uploadFile = useCallback(async (file: File, options: UploadOptions = {}) => {
    const coreOptions: CoreUploadOptions = {
      ...(options.courseId && { courseId: options.courseId }),
      ...(options.lessonId && { lessonId: options.lessonId }),
      ...(options.onProgress && {
        onProgress: (progress) => {
          const mappedProgress = mapProgress(progress);
          if (mappedProgress) options.onProgress!(mappedProgress);
        }
      }),
      ...(options.onError && {
        onError: (error) => {
          options.onError!(new Error(error.message));
        }
      }),
      ...(options.onComplete && { onComplete: options.onComplete }),
    };
    
    return coreUpload.uploadFile(file, coreOptions);
  }, [coreUpload]);
  
  return {
    uploadFile,
    uploadProgress: mapProgress(coreUpload.uploadProgress),
    cancelUpload: coreUpload.cancelUpload,
    loading: coreUpload.loading,
    error: coreUpload.error,
  };
}

/**
 * Hook for video uploads with processing status monitoring
 * 
 * Integrates with backend MediaConvert processing pipeline
 * 
 * @returns Video upload utilities with processing status tracking
 * 
 * @example
 * ```tsx
 * function VideoUploadComponent() {
 *   const { uploadVideo, uploadProgress, processingStatus, loading, error } = useVideoUpload();
 *   
 *   const handleVideoUpload = async (file: File, lessonId: string) => {
 *     try {
 *       const result = await uploadVideo(file, lessonId, {
 *         onProgress: (progress) => {
 *           console.log(`Upload progress: ${progress.percentage}%`);
 *         }
 *       });
 *       console.log('Video upload completed:', result);
 *     } catch (err) {
 *       console.error('Video upload failed:', err);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <input 
 *         type="file" 
 *         accept="video/*"
 *         onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0], 'lesson-123')} 
 *       />
 *       {uploadProgress && (
 *         <div>Upload Progress: {uploadProgress.percentage}%</div>
 *       )}
 *       {processingStatus && (
 *         <div>Processing: {processingStatus.status}</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoUpload(): VideoUploadResult {
  // Delegate to the new upload system which now integrates with real backend
  const coreUpload = useVideoUploadCore();
  
  // Map the interface to maintain backward compatibility
  const mapProgress = (progress: CoreUploadProgress | null): UploadProgress | null => {
    if (!progress) return null;
    
    return {
      uploadId: progress.uploadId,
      loaded: progress.loaded,
      total: progress.total,
      percentage: progress.percentage,
      speed: progress.speed,
      timeRemaining: progress.timeRemaining,
      status: progress.status === 'failed' ? 'error' : 
              progress.status === 'processing' ? 'uploading' :
              progress.status as 'pending' | 'uploading' | 'completed' | 'cancelled',
      error: progress.error,
      fileName: progress.fileName,
    };
  };

  const uploadVideo = useCallback(async (file: File, lessonId: string, options: UploadOptions = {}) => {
    const coreOptions: CoreUploadOptions = {
      ...(options.courseId && { courseId: options.courseId }),
      lessonId,
      ...(options.onProgress && {
        onProgress: (progress) => {
          const mappedProgress = mapProgress(progress);
          if (mappedProgress) options.onProgress!(mappedProgress);
        }
      }),
      ...(options.onError && {
        onError: (error) => {
          options.onError!(new Error(error.message));
        }
      }),
      ...(options.onComplete && { onComplete: options.onComplete }),
    };
    
    return coreUpload.uploadVideo(file, lessonId, coreOptions);
  }, [coreUpload]);
  
  return {
    uploadVideo,
    uploadProgress: mapProgress(coreUpload.uploadProgress),
    processingStatus: coreUpload.processingStatus as VideoProcessingStatus | null,
    cancelUpload: coreUpload.cancelUpload,
    loading: coreUpload.loading,
    error: coreUpload.error,
  };
}

/**
 * Hook for getting signed streaming URLs for video content
 * 
 * Integrates with backend CloudFront streaming URL generation
 * 
 * @returns Query function for getting streaming URLs
 * 
 * @example
 * ```tsx
 * function VideoPlayer({ lessonId }: { lessonId: string }) {
 *   const { data: streamingUrl, loading, error, refetch } = useStreamingUrl(lessonId, '720p');
 *   
 *   if (loading) return <div>Loading video...</div>;
 *   if (error) return <div>Error loading video</div>;
 *   
 *   return streamingUrl ? <video src={streamingUrl.streamingUrl} controls /> : null;
 * }
 * ```
 */
export function useStreamingUrl(
  lessonId: string, 
  resolution?: string, 
  format?: string
): QueryResult<StreamingUrl> {
  const { data, loading, error, refetch } = useQuery<GetStreamingUrlResponse>(GET_STREAMING_URL, {
    variables: { lessonId, resolution, format },
    errorPolicy: 'all',
    skip: !lessonId,
  });

  const refetchStreamingUrl = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: data?.generateStreamingUrl,
    loading,
    error,
    refetch: refetchStreamingUrl,
  };
}

/**
 * Hook for tracking upload progress across multiple uploads
 * 
 * Delegates to the comprehensive upload progress system
 * 
 * @returns Upload progress tracking utilities
 * 
 * @example
 * ```tsx
 * function MultiFileUpload() {
 *   const { addUpload, removeUpload, getUpload, getAllUploads } = useUploadProgress();
 *   
 *   const handleMultipleFiles = (files: FileList) => {
 *     Array.from(files).forEach(async (file) => {
 *       const uploadId = UploadUtils.generateUploadId();
 *       
 *       addUpload(uploadId, {
 *         uploadId,
 *         loaded: 0,
 *         total: file.size,
 *         percentage: 0,
 *         speed: 0,
 *         timeRemaining: 0,
 *         status: 'pending',
 *         fileName: file.name
 *       });
 *       
 *       // Upload file with progress updates
 *       // ... upload logic
 *     });
 *   };
 *   
 *   const allUploads = getAllUploads();
 *   
 *   return (
 *     <div>
 *       {allUploads.map(upload => (
 *         <div key={upload.uploadId}>
 *           {upload.fileName}: {upload.percentage}% - {upload.status}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUploadProgress() {
  // Delegate to the new upload system
  return useUploadProgressCore();
}

/**
 * Hook for getting video asset details by ID
 * 
 * @param videoAssetId - The ID of the video asset
 * @returns Video asset data with loading and error states
 * 
 * @example
 * ```tsx
 * function VideoAssetDetails({ assetId }: { assetId: string }) {
 *   const { data: videoAsset, loading, error, refetch } = useVideoAsset(assetId);
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!videoAsset) return <div>Video not found</div>;
 *   
 *   return (
 *     <div>
 *       <h3>{videoAsset.originalFileName}</h3>
 *       <p>Status: {videoAsset.processingStatus}</p>
 *       <p>Duration: {videoAsset.formattedDuration}</p>
 *       <p>Size: {videoAsset.formattedFileSize}</p>
 *       {videoAsset.isReadyForStreaming && (
 *         <video src={videoAsset.streamingUrls.hls} controls />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoAsset(videoAssetId: string): QueryResult<GetVideoAssetResponse['videoAsset']> {
  const { data, loading, error, refetch } = useQuery<GetVideoAssetResponse>(GET_VIDEO_ASSET, {
    variables: { id: videoAssetId },
    errorPolicy: 'all',
    skip: !videoAssetId,
  });

  const refetchAsset = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: data?.videoAsset,
    loading,
    error,
    refetch: refetchAsset,
  };
}

/**
 * Hook for getting file asset details by ID
 * 
 * @param fileAssetId - The ID of the file asset
 * @returns File asset data with loading and error states
 * 
 * @example
 * ```tsx
 * function FileAssetDetails({ assetId }: { assetId: string }) {
 *   const { data: fileAsset, loading, error, refetch } = useFileAsset(assetId);
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!fileAsset) return <div>File not found</div>;
 *   
 *   return (
 *     <div>
 *       <h3>{fileAsset.fileName}</h3>
 *       <p>Type: {fileAsset.assetType}</p>
 *       <p>Size: {fileAsset.formattedFileSize}</p>
 *       <p>Access: {fileAsset.accessLevel}</p>
 *       {fileAsset.thumbnailUrl && (
 *         <img src={fileAsset.thumbnailUrl} alt="Thumbnail" />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileAsset(fileAssetId: string): QueryResult<GetFileAssetResponse['fileAsset']> {
  const { data, loading, error, refetch } = useQuery<GetFileAssetResponse>(GET_FILE_ASSET, {
    variables: { id: fileAssetId },
    errorPolicy: 'all',
    skip: !fileAssetId,
  });

  const refetchAsset = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: data?.fileAsset,
    loading,
    error,
    refetch: refetchAsset,
  };
}

/**
 * Hook for managing asset operations (delete, retry processing, etc.)
 * 
 * @returns Asset management utilities
 * 
 * @example
 * ```tsx
 * function AssetManager({ assetId, assetType }: { assetId: string; assetType: 'video' | 'file' }) {
 *   const { deleteAsset, retryProcessing, loading, error } = useAssetManagement();
 *   
 *   const handleDelete = async () => {
 *     try {
 *       await deleteAsset(assetId);
 *       console.log('Asset deleted successfully');
 *     } catch (err) {
 *       console.error('Failed to delete asset:', err);
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       <button onClick={handleDelete} disabled={loading}>
 *         Delete Asset
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssetManagement(): AssetManagementResult {
  const [deleteVideoAssetMutation, { loading: deleteVideoLoading, error: deleteVideoError }] = 
    useMutation<{ deleteVideoAsset: boolean }>(DELETE_VIDEO_ASSET);
  const [deleteFileAssetMutation, { loading: deleteFileLoading, error: deleteFileError }] = 
    useMutation<{ deleteFileAsset: boolean }>(DELETE_FILE_ASSET);
  const [deleteContentMutation, { loading: deleteContentLoading, error: deleteContentError }] = 
    useMutation<{ deleteContent: boolean }>(DELETE_CONTENT);
  const [retryProcessingMutation, { loading: retryLoading, error: retryError }] = 
    useMutation<{ retryProcessingJob: any }>(RETRY_PROCESSING_JOB);
  const [cancelProcessingMutation, { loading: cancelLoading, error: cancelError }] = 
    useMutation<{ cancelProcessingJob: any }>(CANCEL_PROCESSING_JOB);

  const deleteAsset = useCallback(async (assetId: string, assetType: 'video' | 'file' = 'file'): Promise<boolean> => {
    if (assetType === 'video') {
      const result = await deleteVideoAssetMutation({ variables: { id: assetId } });
      return result.data?.deleteVideoAsset || false;
    } else {
      const result = await deleteFileAssetMutation({ variables: { id: assetId } });
      return result.data?.deleteFileAsset || false;
    }
  }, [deleteVideoAssetMutation, deleteFileAssetMutation]);

  const deleteContent = useCallback(async (fileKey: string): Promise<boolean> => {
    const result = await deleteContentMutation({ variables: { fileKey } });
    return result.data?.deleteContent || false;
  }, [deleteContentMutation]);

  const retryProcessing = useCallback(async (jobId: string): Promise<void> => {
    await retryProcessingMutation({ variables: { id: jobId } });
  }, [retryProcessingMutation]);

  const cancelProcessing = useCallback(async (jobId: string): Promise<void> => {
    await cancelProcessingMutation({ variables: { id: jobId } });
  }, [cancelProcessingMutation]);

  const loading = deleteVideoLoading || deleteFileLoading || deleteContentLoading || 
                  retryLoading || cancelLoading;
  const error = deleteVideoError || deleteFileError || deleteContentError || 
                retryError || cancelError;

  return {
    deleteAsset,
    deleteContent,
    retryProcessing,
    cancelProcessing,
    loading,
    error,
  };
}

/**
 * Hook for monitoring video processing status with real-time updates
 * 
 * @param videoAssetId - The ID of the video asset to monitor
 * @returns Processing status with real-time updates
 * 
 * @example
 * ```tsx
 * function VideoProcessingMonitor({ videoAssetId }: { videoAssetId: string }) {
 *   const { data: processingStatus, loading, error } = useVideoProcessingStatus(videoAssetId);
 *   
 *   if (loading) return <div>Loading processing status...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!processingStatus) return <div>No processing job found</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Processing Status</h3>
 *       <p>Status: {processingStatus.status}</p>
 *       <p>Progress: {processingStatus.progress}%</p>
 *       {processingStatus.errorMessage && (
 *         <p>Error: {processingStatus.errorMessage}</p>
 *       )}
 *       {processingStatus.canRetry && (
 *         <button onClick={() => retryProcessing(processingStatus.id)}>
 *           Retry Processing
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoProcessingStatus(videoAssetId: string): QueryResult<GetVideoProcessingStatusResponse['videoProcessingStatus']> & {
  subscriptionData?: any;
} {
  const { data, loading, error, refetch } = useQuery<GetVideoProcessingStatusResponse>(
    GET_VIDEO_PROCESSING_STATUS, 
    {
      variables: { videoAssetId },
      errorPolicy: 'all',
      skip: !videoAssetId,
      pollInterval: 5000, // Poll every 5 seconds for status updates
    }
  );

  // Subscribe to real-time processing updates
  const { data: subscriptionData } = useSubscription<{ videoProcessingUpdates: any }>(VIDEO_PROCESSING_UPDATES, {
    variables: { videoAssetId },
    skip: !videoAssetId,
  });

  const refetchStatus = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: data?.videoProcessingStatus,
    loading,
    error,
    refetch: refetchStatus,
    subscriptionData: subscriptionData?.videoProcessingUpdates,
  };
}