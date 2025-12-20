/**
 * Content Management Hooks
 * 
 * React hooks for content-related operations including file uploads,
 * video processing, streaming URLs, and upload progress tracking.
 * 
 * Note: This module now uses the dedicated upload system from lib/uploads
 * for improved functionality and consistency.
 */

import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { useCallback } from 'react';
import type {
  VideoProcessingStatus,
  StreamingUrl,
} from '../types';
import type {
  GetStreamingUrlResponse,
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
  mutation GetStreamingUrl($fileKey: String!, $quality: String) {
    getStreamingUrl(fileKey: $fileKey, quality: $quality) {
      url
      expiresAt
      quality
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
interface MutationResult<T> {
  mutate: (variables: unknown) => Promise<T>;
  loading: boolean;
  error: unknown;
  reset: () => void;
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

/**
 * Hook for general file uploads using the two-step presigned URL workflow
 * 
 * @deprecated Use useFileUpload from lib/uploads instead for better functionality
 * @returns File upload utilities with progress tracking
 * 
 * @example
 * ```tsx
 * // Recommended: Use the new upload system
 * import { useFileUpload } from '../lib/uploads';
 * 
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
  // Delegate to the new upload system
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
 * @deprecated Use useVideoUpload from lib/uploads instead for better functionality
 * @returns Video upload utilities with processing status tracking
 * 
 * @example
 * ```tsx
 * // Recommended: Use the new upload system
 * import { useVideoUpload } from '../lib/uploads';
 * 
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
  // Delegate to the new upload system
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
 * @param fileKey - The file key of the video to stream
 * @param quality - Optional quality preference
 * @returns Mutation function for getting streaming URLs
 * 
 * @example
 * ```tsx
 * function VideoPlayer({ fileKey }: { fileKey: string }) {
 *   const { mutate: getStreamingUrl, loading, error } = useStreamingUrl();
 *   const [videoUrl, setVideoUrl] = useState<string | null>(null);
 *   
 *   useEffect(() => {
 *     const loadVideo = async () => {
 *       try {
 *         const result = await getStreamingUrl({ fileKey, quality: '720p' });
 *         setVideoUrl(result.url);
 *       } catch (err) {
 *         console.error('Failed to get streaming URL:', err);
 *       }
 *     };
 *     
 *     loadVideo();
 *   }, [fileKey, getStreamingUrl]);
 *   
 *   if (loading) return <div>Loading video...</div>;
 *   if (error) return <div>Error loading video</div>;
 *   
 *   return videoUrl ? <video src={videoUrl} controls /> : null;
 * }
 * ```
 */
export function useStreamingUrl(): MutationResult<StreamingUrl> {
  const [getStreamingUrlMutation, { loading, error, reset }] = useMutation<GetStreamingUrlResponse>(GET_STREAMING_URL, {
    errorPolicy: 'all',
  });

  const mutate = useCallback(async (variables: unknown) => {
    const typedVariables = variables as { fileKey: string; quality?: string };
    const result = await getStreamingUrlMutation({ variables: typedVariables });
    return result.data?.getStreamingUrl;
  }, [getStreamingUrlMutation]);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for tracking upload progress across multiple uploads
 * 
 * @deprecated Use useUploadProgress from lib/uploads instead for better functionality
 * @returns Upload progress tracking utilities
 * 
 * @example
 * ```tsx
 * // Recommended: Use the new upload system
 * import { useUploadProgress } from '../lib/uploads';
 * 
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