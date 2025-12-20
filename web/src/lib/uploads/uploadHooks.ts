/**
 * Upload React Hooks
 * 
 * React hooks for file uploads with progress tracking, queue management,
 * and error handling. These hooks provide a clean interface to the upload
 * system utilities.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type {
  UploadProgress,
  UploadOptions,
  UploadError,
  UploadResult,
  UploadQueueItem,
  UploadQueueStats,
  UploadQueueConfig,
  FileValidationOptions,
} from './uploadTypes';
import {
  FileValidator,
  UploadProgressCalculator,
  UploadErrorHandler,
  UploadUtils,
} from './uploadHelpers';
import { UploadQueue } from './uploadQueue';

// GraphQL mutations
const GET_PRESIGNED_UPLOAD_URL = gql`
  mutation GetPresignedUploadUrl($input: FileUploadInput!) {
    getPresignedUploadUrl(input: $input) {
      uploadUrl
      fileKey
      fields
      expiresAt
    }
  }
`;

const COMPLETE_FILE_UPLOAD = gql`
  mutation CompleteFileUpload($fileKey: String!, $metadata: FileMetadataInput) {
    completeFileUpload(fileKey: $fileKey, metadata: $metadata) {
      id
      fileKey
      originalName
      mimeType
      fileSize
      url
      createdAt
    }
  }
`;

// GraphQL response types
interface GetPresignedUploadUrlResponse {
  getPresignedUploadUrl: {
    uploadUrl: string;
    fileKey: string;
    fields: Record<string, string>;
    expiresAt: string;
  };
}

interface CompleteFileUploadResponse {
  completeFileUpload: {
    id: string;
    fileKey: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    url: string;
    createdAt: string;
  };
}

// Hook return types
interface FileUploadHookResult {
  uploadFile: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  uploadProgress: UploadProgress | null;
  cancelUpload: () => void;
  pauseUpload: () => void;
  resumeUpload: () => void;
  loading: boolean;
  error: UploadError | null;
  reset: () => void;
}

interface VideoUploadHookResult extends FileUploadHookResult {
  uploadVideo: (file: File, lessonId: string, options?: UploadOptions) => Promise<UploadResult>;
  processingStatus: {
    fileKey?: string;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
  } | null;
}

interface UploadQueueHookResult {
  addUpload: (file: File, options?: UploadOptions, priority?: number) => string;
  removeUpload: (uploadId: string) => boolean;
  cancelUpload: (uploadId: string) => boolean;
  pauseUpload: (uploadId: string) => boolean;
  resumeUpload: (uploadId: string) => boolean;
  retryUpload: (uploadId: string) => boolean;
  getUpload: (uploadId: string) => UploadQueueItem | undefined;
  getAllUploads: () => UploadQueueItem[];
  getUploadsByStatus: (status: UploadProgress['status']) => UploadQueueItem[];
  clearCompleted: () => number;
  clearAll: () => void;
  stats: UploadQueueStats;
  queue: UploadQueue;
}

interface UploadProgressHookResult {
  addUpload: (uploadId: string, progress: UploadProgress) => void;
  updateUpload: (uploadId: string, progress: Partial<UploadProgress>) => void;
  removeUpload: (uploadId: string) => void;
  getUpload: (uploadId: string) => UploadProgress | undefined;
  getAllUploads: () => UploadProgress[];
  clearCompleted: () => void;
}

/**
 * Hook for general file uploads using the two-step presigned URL workflow
 * 
 * @param validationOptions - File validation options
 * @returns File upload utilities with progress tracking
 * 
 * @example
 * ```tsx
 * function FileUploadComponent() {
 *   const { uploadFile, uploadProgress, cancelUpload, loading, error } = useFileUpload({
 *     maxFileSize: 50 * 1024 * 1024, // 50MB
 *     allowedMimeTypes: ['image/jpeg', 'image/png']
 *   });
 *   
 *   const handleFileSelect = async (file: File) => {
 *     try {
 *       const result = await uploadFile(file, {
 *         courseId: 'course-123',
 *         onProgress: (progress) => {
 *           console.log(`Upload progress: ${progress.percentage}%`);
 *         }
 *       });
 *       console.log('Upload completed:', result);
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
export function useFileUpload(
  validationOptions: FileValidationOptions = {}
): FileUploadHookResult {
  const [getPresignedUrl] = useMutation<GetPresignedUploadUrlResponse>(GET_PRESIGNED_UPLOAD_URL);
  const [completeUpload] = useMutation<CompleteFileUploadResponse>(COMPLETE_FILE_UPLOAD);
  
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressCalculatorRef = useRef<UploadProgressCalculator | null>(null);
  const currentUploadIdRef = useRef<string | null>(null);

  const uploadFile = useCallback(async (file: File, options: UploadOptions = {}): Promise<UploadResult> => {
    try {
      setLoading(true);
      setError(null);
      
      const uploadId = UploadUtils.generateUploadId();
      currentUploadIdRef.current = uploadId;

      // Validate file
      const validation = FileValidator.validateFile(file, validationOptions);
      if (!validation.valid) {
        throw UploadErrorHandler.createError(
          uploadId,
          'VALIDATION_ERROR',
          validation.errors.join(', '),
          false,
          { validationErrors: validation.errors }
        );
      }

      // Initialize progress tracking
      progressCalculatorRef.current = new UploadProgressCalculator();
      const initialProgress: UploadProgress = {
        uploadId,
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'pending',
        fileName: file.name,
      };
      
      setUploadProgress(initialProgress);
      options.onProgress?.(initialProgress);

      // Step 1: Get presigned URL
      const { data: presignedData } = await getPresignedUrl({
        variables: {
          input: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            courseId: options.courseId,
            lessonId: options.lessonId,
          },
        },
      });

      if (!presignedData?.getPresignedUploadUrl) {
        throw UploadErrorHandler.createError(
          uploadId,
          'SERVER_ERROR',
          'Failed to get presigned upload URL',
          true
        );
      }

      const { uploadUrl, fileKey } = presignedData.getPresignedUploadUrl;

      // Step 2: Upload file to S3 with progress tracking
      const formData = UploadUtils.createUploadFormData(file, presignedData.getPresignedUploadUrl);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Update status to uploading
      const uploadingProgress = progressCalculatorRef.current.calculateProgress(
        uploadId,
        0,
        file.size,
        file.name
      );
      uploadingProgress.status = 'uploading';
      setUploadProgress(uploadingProgress);
      options.onProgress?.(uploadingProgress);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && progressCalculatorRef.current) {
          const progress = progressCalculatorRef.current.calculateProgress(
            uploadId,
            event.loaded,
            event.total,
            file.name
          );
          setUploadProgress(progress);
          options.onProgress?.(progress);
        }
      });

      // Set up abort handling
      abortControllerRef.current.signal.addEventListener('abort', () => {
        xhr.abort();
      });

      // Perform the upload
      const uploadResponse = await new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response, {
              status: xhr.status,
              statusText: xhr.statusText,
            }));
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          reject(UploadErrorHandler.createError(
            uploadId,
            'NETWORK_ERROR',
            'Network error during upload',
            true
          ));
        };

        xhr.ontimeout = () => {
          reject(UploadErrorHandler.createError(
            uploadId,
            'UPLOAD_TIMEOUT',
            'Upload timed out',
            true
          ));
        };

        xhr.onabort = () => {
          reject(UploadErrorHandler.createError(
            uploadId,
            'UPLOAD_CANCELLED',
            'Upload was cancelled',
            false
          ));
        };

        xhr.open('POST', uploadUrl);
        xhr.timeout = 300000; // 5 minutes timeout
        xhr.send(formData);
      });

      if (!uploadResponse.ok) {
        throw UploadErrorHandler.createError(
          uploadId,
          'UPLOAD_ERROR',
          `Upload failed: ${uploadResponse.statusText}`,
          UploadErrorHandler.isRetryable(new Error(uploadResponse.statusText))
        );
      }

      // Step 3: Complete the upload registration
      const { data: completeData } = await completeUpload({
        variables: {
          fileKey,
          metadata: {
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          },
        },
      });

      if (!completeData?.completeFileUpload) {
        throw UploadErrorHandler.createError(
          uploadId,
          'SERVER_ERROR',
          'Failed to complete upload registration',
          true
        );
      }

      // Final progress update
      const completedProgress: UploadProgress = {
        uploadId,
        loaded: file.size,
        total: file.size,
        percentage: 100,
        speed: 0,
        timeRemaining: 0,
        status: 'completed',
        fileName: file.name,
      };

      setUploadProgress(completedProgress);
      options.onProgress?.(completedProgress);
      options.onComplete?.(completeData.completeFileUpload);

      return completeData.completeFileUpload;

    } catch (err: unknown) {
      const uploadError = err instanceof Error && 'code' in err && 'uploadId' in err && 'retryable' in err
        ? err as UploadError
        : UploadErrorHandler.createError(
            currentUploadIdRef.current || 'unknown',
            'UNKNOWN_ERROR',
            err instanceof Error ? err.message : 'Unknown error occurred',
            err instanceof Error ? UploadErrorHandler.isRetryable(err) : false
          );

      // Update progress with error
      if (uploadProgress) {
        const errorProgress: UploadProgress = {
          ...uploadProgress,
          status: uploadError.code === 'UPLOAD_CANCELLED' ? 'cancelled' : 'failed',
          error: uploadError.message,
        };
        setUploadProgress(errorProgress);
        options.onProgress?.(errorProgress);
      }

      setError(uploadError);
      options.onError?.(uploadError);
      throw uploadError;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      progressCalculatorRef.current = null;
      currentUploadIdRef.current = null;
    }
  }, [getPresignedUrl, completeUpload, validationOptions, uploadProgress]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const pauseUpload = useCallback(() => {
    // For single file uploads, pause is the same as cancel
    // The upload would need to be restarted from the beginning
    cancelUpload();
    if (uploadProgress) {
      const pausedProgress: UploadProgress = {
        ...uploadProgress,
        status: 'paused',
      };
      setUploadProgress(pausedProgress);
    }
  }, [cancelUpload, uploadProgress]);

  const resumeUpload = useCallback(() => {
    // For single file uploads, resume would require restarting
    // This is more applicable to queue-based uploads
    if (uploadProgress?.status === 'paused') {
      const resumedProgress: UploadProgress = {
        ...uploadProgress,
        status: 'pending',
      };
      setUploadProgress(resumedProgress);
    }
  }, [uploadProgress]);

  const reset = useCallback(() => {
    setUploadProgress(null);
    setError(null);
    setLoading(false);
    abortControllerRef.current = null;
    progressCalculatorRef.current = null;
    currentUploadIdRef.current = null;
  }, []);

  return {
    uploadFile,
    uploadProgress,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for video uploads with processing status monitoring
 * 
 * @param validationOptions - File validation options
 * @returns Video upload utilities with processing status tracking
 * 
 * @example
 * ```tsx
 * function VideoUploadComponent() {
 *   const { uploadVideo, uploadProgress, processingStatus, loading, error } = useVideoUpload({
 *     allowedMimeTypes: ['video/mp4', 'video/webm']
 *   });
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
export function useVideoUpload(
  validationOptions: FileValidationOptions = {}
): VideoUploadHookResult {
  const fileUploadHook = useFileUpload({
    ...validationOptions,
    allowedMimeTypes: validationOptions.allowedMimeTypes || [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/avi',
      'video/mov',
    ],
  });

  const [processingStatus, setProcessingStatus] = useState<{
    fileKey?: string;
    status: 'processing' | 'completed' | 'failed';
    progress: number;
  } | null>(null);

  const uploadVideo = useCallback(async (
    file: File,
    lessonId: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    // Validate that it's a video file
    if (!FileValidator.isVideo(file)) {
      throw UploadErrorHandler.createError(
        UploadUtils.generateUploadId(),
        'INVALID_FILE_TYPE',
        'File must be a video',
        false
      );
    }

    const result = await fileUploadHook.uploadFile(file, {
      ...options,
      lessonId,
      onComplete: (uploadResult) => {
        // Start monitoring processing status
        // TODO: Implement video processing status polling
        setProcessingStatus({
          fileKey: uploadResult.fileKey,
          status: 'processing',
          progress: 0,
        });
        
        options.onComplete?.(uploadResult);
      },
    });

    return result;
  }, [fileUploadHook]);

  return {
    ...fileUploadHook,
    uploadVideo,
    processingStatus,
  };
}

/**
 * Hook for managing upload queues with concurrent uploads
 * 
 * @param config - Queue configuration options
 * @returns Upload queue management utilities
 * 
 * @example
 * ```tsx
 * function MultiFileUpload() {
 *   const { addUpload, getAllUploads, stats, clearCompleted } = useUploadQueue({
 *     maxConcurrentUploads: 2
 *   });
 *   
 *   const handleMultipleFiles = (files: FileList) => {
 *     Array.from(files).forEach((file, index) => {
 *       addUpload(file, {
 *         courseId: 'course-123',
 *         onProgress: (progress) => {
 *           console.log(`File ${index + 1} progress: ${progress.percentage}%`);
 *         }
 *       }, index); // Use index as priority
 *     });
 *   };
 *   
 *   const allUploads = getAllUploads();
 *   
 *   return (
 *     <div>
 *       <div>Total: {stats.total}, Uploading: {stats.uploading}</div>
 *       {allUploads.map(upload => (
 *         <div key={upload.uploadId}>
 *           {upload.file.name}: {upload.progress.percentage}% - {upload.progress.status}
 *         </div>
 *       ))}
 *       <button onClick={clearCompleted}>Clear Completed</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUploadQueue(config: Partial<UploadQueueConfig> = {}): UploadQueueHookResult {
  const [queue] = useState(() => new UploadQueue(config));
  const [, forceUpdate] = useState({});

  // Force re-render when queue changes
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  // Set up event listeners
  useEffect(() => {
    const events = ['added', 'removed', 'progress', 'completed', 'failed', 'cancelled'];
    
    events.forEach(event => {
      queue.on(event, triggerUpdate);
    });

    return () => {
      events.forEach(event => {
        queue.off(event, triggerUpdate);
      });
    };
  }, [queue, triggerUpdate]);

  const stats = useMemo(() => queue.getStats(), [queue]);

  const addUpload = useCallback((file: File, options?: UploadOptions, priority?: number) => {
    return queue.addUpload(file, options, priority);
  }, [queue]);

  const removeUpload = useCallback((uploadId: string) => {
    return queue.removeUpload(uploadId);
  }, [queue]);

  const cancelUpload = useCallback((uploadId: string) => {
    return queue.cancelUpload(uploadId);
  }, [queue]);

  const pauseUpload = useCallback((uploadId: string) => {
    return queue.pauseUpload(uploadId);
  }, [queue]);

  const resumeUpload = useCallback((uploadId: string) => {
    return queue.resumeUpload(uploadId);
  }, [queue]);

  const retryUpload = useCallback((uploadId: string) => {
    return queue.retryUpload(uploadId);
  }, [queue]);

  const getUpload = useCallback((uploadId: string) => {
    return queue.getUpload(uploadId);
  }, [queue]);

  const getAllUploads = useCallback(() => {
    return queue.getAllUploads();
  }, [queue]);

  const getUploadsByStatus = useCallback((status: UploadProgress['status']) => {
    return queue.getUploadsByStatus(status);
  }, [queue]);

  const clearCompleted = useCallback(() => {
    return queue.clearCompleted();
  }, [queue]);

  const clearAll = useCallback(() => {
    return queue.clearAll();
  }, [queue]);

  return {
    addUpload,
    removeUpload,
    cancelUpload,
    pauseUpload,
    resumeUpload,
    retryUpload,
    getUpload,
    getAllUploads,
    getUploadsByStatus,
    clearCompleted,
    clearAll,
    stats,
    queue,
  };
}

/**
 * Hook for tracking upload progress across multiple uploads
 * 
 * @returns Upload progress tracking utilities
 * 
 * @example
 * ```tsx
 * function UploadProgressTracker() {
 *   const { addUpload, updateUpload, getAllUploads, clearCompleted } = useUploadProgress();
 *   
 *   const handleFileUpload = (file: File) => {
 *     const uploadId = UploadUtils.generateUploadId();
 *     
 *     addUpload(uploadId, {
 *       uploadId,
 *       loaded: 0,
 *       total: file.size,
 *       percentage: 0,
 *       speed: 0,
 *       timeRemaining: 0,
 *       status: 'pending',
 *       fileName: file.name
 *     });
 *     
 *     // Simulate progress updates
 *     const interval = setInterval(() => {
 *       updateUpload(uploadId, {
 *         loaded: Math.min(file.size, Math.random() * file.size),
 *         percentage: Math.min(100, Math.random() * 100),
 *         status: 'uploading'
 *       });
 *     }, 1000);
 *     
 *     setTimeout(() => {
 *       clearInterval(interval);
 *       updateUpload(uploadId, {
 *         loaded: file.size,
 *         percentage: 100,
 *         status: 'completed'
 *       });
 *     }, 5000);
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
 *       <button onClick={clearCompleted}>Clear Completed</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUploadProgress(): UploadProgressHookResult {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());

  const addUpload = useCallback((uploadId: string, progress: UploadProgress) => {
    setUploads(prev => new Map(prev).set(uploadId, progress));
  }, []);

  const updateUpload = useCallback((uploadId: string, progress: Partial<UploadProgress>) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(uploadId);
      if (existing) {
        newMap.set(uploadId, { ...existing, ...progress });
      }
      return newMap;
    });
  }, []);

  const removeUpload = useCallback((uploadId: string) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(uploadId);
      return newMap;
    });
  }, []);

  const getUpload = useCallback((uploadId: string) => {
    return uploads.get(uploadId);
  }, [uploads]);

  const getAllUploads = useCallback(() => {
    return Array.from(uploads.values());
  }, [uploads]);

  const clearCompleted = useCallback(() => {
    setUploads(prev => {
      const newMap = new Map();
      prev.forEach((upload, id) => {
        if (upload.status !== 'completed') {
          newMap.set(id, upload);
        }
      });
      return newMap;
    });
  }, []);

  return {
    addUpload,
    updateUpload,
    removeUpload,
    getUpload,
    getAllUploads,
    clearCompleted,
  };
}