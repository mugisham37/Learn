/**
 * Content Management Hooks
 * 
 * React hooks for content-related operations including file uploads,
 * video processing, streaming URLs, and upload progress tracking.
 */

import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { gql } from '@apollo/client';
import { useState, useCallback, useRef } from 'react';
import type {
  PresignedUploadUrl,
  VideoProcessingStatus,
  StreamingUrl,
  FileUploadInput,
  VideoUploadInput,
} from '../types';

// GraphQL Queries and Mutations
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

const GET_VIDEO_PROCESSING_STATUS = gql`
  query GetVideoProcessingStatus($fileKey: String!) {
    videoProcessingStatus(fileKey: $fileKey) {
      fileKey
      status
      progress
      outputFormats {
        quality
        url
        fileSize
      }
      thumbnailUrl
      duration
      error
      updatedAt
    }
  }
`;

const GET_STREAMING_URL = gql`
  mutation GetStreamingUrl($fileKey: String!, $quality: String) {
    getStreamingUrl(fileKey: $fileKey, quality: $quality) {
      url
      expiresAt
      quality
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

// Upload progress tracking types
interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: any) => void;
}

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any;
  refetch: () => Promise<any>;
}

interface MutationResult<T> {
  mutate: (variables: any) => Promise<T>;
  loading: boolean;
  error: any;
  reset: () => void;
}

interface FileUploadResult {
  uploadFile: (file: File, options?: UploadOptions) => Promise<any>;
  uploadProgress: UploadProgress | null;
  cancelUpload: () => void;
  loading: boolean;
  error: any;
}

interface VideoUploadResult {
  uploadVideo: (file: File, lessonId: string, options?: UploadOptions) => Promise<any>;
  uploadProgress: UploadProgress | null;
  processingStatus: VideoProcessingStatus | null;
  cancelUpload: () => void;
  loading: boolean;
  error: any;
}

/**
 * Hook for general file uploads using the two-step presigned URL workflow
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
 *           <div>Speed: {(uploadProgress.speed / 1024 / 1024).toFixed(2)} MB/s</div>
 *           <button onClick={cancelUpload}>Cancel</button>
 *         </div>
 *       )}
 *       {error && <div>Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFileUpload(): FileUploadResult {
  const [getPresignedUrl] = useMutation(GET_PRESIGNED_UPLOAD_URL);
  const [completeUpload] = useMutation(COMPLETE_FILE_UPLOAD);
  
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadFile = useCallback(async (file: File, options: UploadOptions = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize progress tracking
      const initialProgress: UploadProgress = {
        uploadId,
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'pending',
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
        throw new Error('Failed to get presigned upload URL');
      }

      const { uploadUrl, fileKey, fields } = presignedData.getPresignedUploadUrl;

      // Step 2: Upload file to S3 with progress tracking
      const formData = new FormData();
      
      // Add presigned URL fields
      Object.entries(fields || {}).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      
      // Add the file last
      formData.append('file', file);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
        // Track upload progress
        ...(window.fetch.toString().includes('[native code]') && {
          onUploadProgress: (progressEvent: ProgressEvent) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - lastTime;
            const loadedDiff = progressEvent.loaded - lastLoaded;
            
            if (timeDiff > 100) { // Update every 100ms
              const speed = loadedDiff / (timeDiff / 1000); // bytes per second
              const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              const timeRemaining = speed > 0 ? (progressEvent.total - progressEvent.loaded) / speed : 0;

              const progress: UploadProgress = {
                uploadId,
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage,
                speed,
                timeRemaining,
                status: 'uploading',
              };

              setUploadProgress(progress);
              options.onProgress?.(progress);

              lastLoaded = progressEvent.loaded;
              lastTime = currentTime;
            }
          },
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
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

      const completedProgress: UploadProgress = {
        uploadId,
        loaded: file.size,
        total: file.size,
        percentage: 100,
        speed: 0,
        timeRemaining: 0,
        status: 'completed',
      };

      setUploadProgress(completedProgress);
      options.onProgress?.(completedProgress);
      options.onComplete?.(completeData?.completeFileUpload);

      return completeData?.completeFileUpload;

    } catch (err: any) {
      if (err.name === 'AbortError') {
        const cancelledProgress: UploadProgress = {
          uploadId: uploadProgress?.uploadId || 'cancelled',
          loaded: uploadProgress?.loaded || 0,
          total: uploadProgress?.total || file.size,
          percentage: uploadProgress?.percentage || 0,
          speed: 0,
          timeRemaining: 0,
          status: 'cancelled',
        };
        setUploadProgress(cancelledProgress);
        options.onProgress?.(cancelledProgress);
      } else {
        const errorProgress: UploadProgress = {
          uploadId: uploadProgress?.uploadId || 'error',
          loaded: uploadProgress?.loaded || 0,
          total: uploadProgress?.total || file.size,
          percentage: uploadProgress?.percentage || 0,
          speed: 0,
          timeRemaining: 0,
          status: 'error',
          error: err.message,
        };
        setUploadProgress(errorProgress);
        options.onProgress?.(errorProgress);
        setError(err);
        options.onError?.(err);
      }
      throw err;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [getPresignedUrl, completeUpload]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    uploadFile,
    uploadProgress,
    cancelUpload,
    loading,
    error,
  };
}

/**
 * Hook for video uploads with processing status monitoring
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
 *         <div>
 *           <div>Processing: {processingStatus.status}</div>
 *           <div>Progress: {processingStatus.progress}%</div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVideoUpload(): VideoUploadResult {
  const { uploadFile, uploadProgress, cancelUpload, loading, error } = useFileUpload();
  const [processingStatus, setProcessingStatus] = useState<VideoProcessingStatus | null>(null);

  const { refetch: refetchProcessingStatus } = useQuery(GET_VIDEO_PROCESSING_STATUS, {
    skip: true, // We'll call this manually
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.videoProcessingStatus) {
        setProcessingStatus(data.videoProcessingStatus);
      }
    },
  });

  const uploadVideo = useCallback(async (file: File, lessonId: string, options: UploadOptions = {}) => {
    try {
      // Upload the video file
      const result = await uploadFile(file, {
        ...options,
        lessonId,
        onComplete: (uploadResult) => {
          // Start monitoring processing status
          if (uploadResult?.fileKey) {
            const pollProcessingStatus = async () => {
              try {
                await refetchProcessingStatus({ fileKey: uploadResult.fileKey });
                
                // Continue polling if still processing
                if (processingStatus?.status === 'processing') {
                  setTimeout(pollProcessingStatus, 2000); // Poll every 2 seconds
                }
              } catch (err) {
                console.error('Error polling processing status:', err);
              }
            };
            
            pollProcessingStatus();
          }
          
          options.onComplete?.(uploadResult);
        },
      });

      return result;
    } catch (err) {
      throw err;
    }
  }, [uploadFile, refetchProcessingStatus, processingStatus]);

  return {
    uploadVideo,
    uploadProgress,
    processingStatus,
    cancelUpload,
    loading,
    error,
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
  const [getStreamingUrlMutation, { loading, error, reset }] = useMutation(GET_STREAMING_URL, {
    errorPolicy: 'all',
  });

  const mutate = useCallback(async (variables: { fileKey: string; quality?: string }) => {
    const result = await getStreamingUrlMutation({ variables });
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
 * @returns Upload progress tracking utilities
 * 
 * @example
 * ```tsx
 * function MultiFileUpload() {
 *   const { addUpload, removeUpload, getUpload, getAllUploads } = useUploadProgress();
 *   
 *   const handleMultipleFiles = (files: FileList) => {
 *     Array.from(files).forEach(async (file) => {
 *       const uploadId = `upload-${Date.now()}-${Math.random()}`;
 *       
 *       addUpload(uploadId, {
 *         uploadId,
 *         loaded: 0,
 *         total: file.size,
 *         percentage: 0,
 *         speed: 0,
 *         timeRemaining: 0,
 *         status: 'pending'
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
 *           {upload.percentage}% - {upload.status}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUploadProgress() {
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