/**
 * Content Management Example Component
 *
 * Demonstrates the comprehensive content management capabilities
 * with real backend integration for S3 uploads, MediaConvert processing,
 * and CloudFront streaming.
 */

import React, { useState, useCallback } from 'react';
import {
  useFileUpload,
  useVideoUpload,
  useStreamingUrl,
  useVideoAsset,
  useFileAsset,
  useAssetManagement,
  useVideoProcessingStatus,
} from '../hooks/useContent';

interface ContentManagementProps {
  courseId?: string;
  lessonId?: string;
}

export function ContentManagementExample({ courseId, lessonId }: ContentManagementProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<'video' | 'file'>('file');

  // Upload hooks
  const fileUpload = useFileUpload();
  const videoUpload = useVideoUpload();

  // Asset management hooks
  const {
    data: videoAsset,
    loading: videoLoading,
    error: videoError,
  } = useVideoAsset(assetType === 'video' && uploadedAssetId ? uploadedAssetId : '');
  const {
    data: fileAsset,
    loading: fileLoading,
    error: fileError,
  } = useFileAsset(assetType === 'file' && uploadedAssetId ? uploadedAssetId : '');
  const { data: streamingUrl, loading: streamingLoading } = useStreamingUrl(
    lessonId || '',
    '720p',
    'hls'
  );
  const { data: processingStatus, subscriptionData } = useVideoProcessingStatus(
    assetType === 'video' && uploadedAssetId ? uploadedAssetId : ''
  );
  const assetManagement = useAssetManagement();

  // File selection handler
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Determine asset type based on file type
      if (file.type.startsWith('video/')) {
        setAssetType('video');
      } else {
        setAssetType('file');
      }
    }
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const result = await fileUpload.uploadFile(selectedFile, {
        courseId,
        lessonId,
        onProgress: progress => {
          console.log(`Upload progress: ${progress.percentage}%`);
        },
        onComplete: (result: any) => {
          console.log('Upload completed:', result);
          if (result?.id) {
            setUploadedAssetId(result.id);
          }
        },
        onError: error => {
          console.error('Upload failed:', error);
        },
      });

      console.log('File upload result:', result);
    } catch (error) {
      console.error('Upload error:', error);
    }
  }, [selectedFile, fileUpload, courseId, lessonId]);

  // Video upload handler
  const handleVideoUpload = useCallback(async () => {
    if (!selectedFile || !lessonId) return;

    try {
      const result = await videoUpload.uploadVideo(selectedFile, lessonId, {
        courseId,
        onProgress: progress => {
          console.log(`Video upload progress: ${progress.percentage}%`);
        },
        onComplete: (result: any) => {
          console.log('Video upload completed:', result);
          if (result?.id) {
            setUploadedAssetId(result.id);
          }
        },
        onError: error => {
          console.error('Video upload failed:', error);
        },
      });

      console.log('Video upload result:', result);
    } catch (error) {
      console.error('Video upload error:', error);
    }
  }, [selectedFile, videoUpload, courseId, lessonId]);

  // Asset deletion handler
  const handleDeleteAsset = useCallback(async () => {
    if (!uploadedAssetId) return;

    try {
      await assetManagement.deleteAsset(uploadedAssetId, assetType);
      console.log('Asset deleted successfully');
      setUploadedAssetId(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Failed to delete asset:', error);
    }
  }, [uploadedAssetId, assetType, assetManagement]);

  // Processing retry handler
  const handleRetryProcessing = useCallback(async () => {
    if (!processingStatus?.id) return;

    try {
      await assetManagement.retryProcessing(processingStatus.id);
      console.log('Processing retry initiated');
    } catch (error) {
      console.error('Failed to retry processing:', error);
    }
  }, [processingStatus, assetManagement]);

  return (
    <div className='content-management-example'>
      <h2>Content Management System</h2>

      {/* File Selection */}
      <div className='file-selection'>
        <h3>Select File</h3>
        <input type='file' onChange={handleFileSelect} accept='*/*' />
        {selectedFile && (
          <div className='selected-file'>
            <p>Selected: {selectedFile.name}</p>
            <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p>Type: {selectedFile.type}</p>
            <p>Detected as: {assetType}</p>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      {selectedFile && (
        <div className='upload-controls'>
          <h3>Upload File</h3>
          {assetType === 'video' ? (
            <button onClick={handleVideoUpload} disabled={videoUpload.loading || !lessonId}>
              {videoUpload.loading ? 'Uploading Video...' : 'Upload Video'}
            </button>
          ) : (
            <button onClick={handleFileUpload} disabled={fileUpload.loading}>
              {fileUpload.loading ? 'Uploading File...' : 'Upload File'}
            </button>
          )}

          {/* Upload Progress */}
          {(fileUpload.uploadProgress || videoUpload.uploadProgress) && (
            <div className='upload-progress'>
              <div className='progress-bar'>
                <div
                  className='progress-fill'
                  style={{
                    width: `${(fileUpload.uploadProgress || videoUpload.uploadProgress)?.percentage || 0}%`,
                  }}
                />
              </div>
              <p>
                {(fileUpload.uploadProgress || videoUpload.uploadProgress)?.percentage || 0}% -
                {(fileUpload.uploadProgress || videoUpload.uploadProgress)?.status}
              </p>
              {(fileUpload.uploadProgress || videoUpload.uploadProgress)?.speed && (
                <p>
                  Speed:{' '}
                  {(
                    (fileUpload.uploadProgress || videoUpload.uploadProgress)?.speed! /
                    1024 /
                    1024
                  ).toFixed(2)}{' '}
                  MB/s
                </p>
              )}
            </div>
          )}

          {/* Upload Errors */}
          {(fileUpload.error || videoUpload.error) && (
            <div className='upload-error'>
              <p>Upload Error: {String(fileUpload.error || videoUpload.error)}</p>
            </div>
          )}
        </div>
      )}

      {/* Asset Information */}
      {uploadedAssetId && (
        <div className='asset-info'>
          <h3>Asset Information</h3>

          {assetType === 'video' && videoAsset && (
            <div className='video-asset'>
              <h4>Video Asset</h4>
              <p>ID: {videoAsset.id}</p>
              <p>File Name: {videoAsset.originalFileName}</p>
              <p>Size: {videoAsset.formattedFileSize}</p>
              <p>Duration: {videoAsset.formattedDuration}</p>
              <p>Processing Status: {videoAsset.processingStatus}</p>
              <p>Ready for Streaming: {videoAsset.isReadyForStreaming ? 'Yes' : 'No'}</p>

              {videoAsset.thumbnailUrl && (
                <div className='thumbnail'>
                  <img src={videoAsset.thumbnailUrl} alt='Video thumbnail' />
                </div>
              )}

              {videoAsset.isReadyForStreaming && videoAsset.streamingUrls?.hls && (
                <div className='video-player'>
                  <video controls src={videoAsset.streamingUrls.hls}>
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </div>
          )}

          {assetType === 'file' && fileAsset && (
            <div className='file-asset'>
              <h4>File Asset</h4>
              <p>ID: {fileAsset.id}</p>
              <p>File Name: {fileAsset.fileName}</p>
              <p>Size: {fileAsset.formattedFileSize}</p>
              <p>Type: {fileAsset.assetType}</p>
              <p>Access Level: {fileAsset.accessLevel}</p>
              <p>Public: {fileAsset.isPublic ? 'Yes' : 'No'}</p>

              {fileAsset.thumbnailUrl && (
                <div className='thumbnail'>
                  <img src={fileAsset.thumbnailUrl} alt='File thumbnail' />
                </div>
              )}

              {fileAsset.cdnUrl && (
                <div className='file-link'>
                  <a href={fileAsset.cdnUrl} target='_blank' rel='noopener noreferrer'>
                    Download File
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Processing Status for Videos */}
          {assetType === 'video' && processingStatus && (
            <div className='processing-status'>
              <h4>Processing Status</h4>
              <p>Status: {processingStatus.status}</p>
              <p>Progress: {processingStatus.progress}%</p>
              <p>Job Type: {processingStatus.jobTypeDescription}</p>
              <p>Priority: {processingStatus.priorityDescription}</p>

              {processingStatus.errorMessage && (
                <p className='error'>Error: {processingStatus.errorMessage}</p>
              )}

              {processingStatus.canRetry && (
                <button onClick={handleRetryProcessing}>Retry Processing</button>
              )}

              {processingStatus.estimatedCompletionTime && (
                <p>
                  Estimated Completion:{' '}
                  {new Date(processingStatus.estimatedCompletionTime).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Real-time Processing Updates */}
          {subscriptionData && (
            <div className='realtime-updates'>
              <h4>Real-time Updates</h4>
              <p>Status: {subscriptionData.status}</p>
              <p>Progress: {subscriptionData.progress}%</p>
              {subscriptionData.errorMessage && (
                <p className='error'>Error: {subscriptionData.errorMessage}</p>
              )}
            </div>
          )}

          {/* Asset Management */}
          <div className='asset-management'>
            <h4>Asset Management</h4>
            <button
              onClick={handleDeleteAsset}
              disabled={assetManagement.loading}
              className='delete-button'
            >
              {assetManagement.loading ? 'Deleting...' : 'Delete Asset'}
            </button>

            {assetManagement.error && (
              <p className='error'>Management Error: {String(assetManagement.error)}</p>
            )}
          </div>
        </div>
      )}

      {/* Streaming URL Demo */}
      {lessonId && streamingUrl && (
        <div className='streaming-demo'>
          <h3>Streaming URL Demo</h3>
          <p>Lesson ID: {lessonId}</p>
          <p>Streaming URL: {streamingUrl.streamingUrl}</p>
          <p>Resolution: {streamingUrl.resolution}</p>
          <p>Format: {streamingUrl.format}</p>
          <p>Expires At: {new Date(streamingUrl.expiresAt).toLocaleString()}</p>

          <div className='video-player'>
            <video controls src={streamingUrl.streamingUrl}>
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Loading States */}
      {(videoLoading || fileLoading || streamingLoading) && (
        <div className='loading'>
          <p>Loading asset information...</p>
        </div>
      )}

      {/* Error States */}
      {(videoError || fileError) && (
        <div className='error'>
          <p>Error loading asset: {String(videoError || fileError)}</p>
        </div>
      )}

      <style jsx>{`
        .content-management-example {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .file-selection,
        .upload-controls,
        .asset-info,
        .streaming-demo {
          margin-bottom: 30px;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        .selected-file {
          margin-top: 10px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }

        .upload-progress {
          margin-top: 15px;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background-color: #f0f0f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background-color: #4caf50;
          transition: width 0.3s ease;
        }

        .upload-error,
        .error {
          color: #f44336;
          margin-top: 10px;
        }

        .video-asset,
        .file-asset,
        .processing-status,
        .realtime-updates,
        .asset-management {
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }

        .thumbnail img {
          max-width: 200px;
          max-height: 150px;
          border-radius: 4px;
        }

        .video-player video {
          width: 100%;
          max-width: 600px;
          height: auto;
        }

        .delete-button {
          background-color: #f44336;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        }

        .delete-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        button {
          background-color: #2196f3;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        }

        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 20px;
        }
      `}</style>
    </div>
  );
}

export default ContentManagementExample;
