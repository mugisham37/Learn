# File Upload System

Comprehensive file upload system with presigned URL workflow, progress tracking, queue management, and error recovery.

## Features

- **Two-Step Presigned URL Upload**: Secure file uploads to S3 using presigned URLs
- **Progress Tracking**: Real-time upload progress with speed and time remaining calculations
- **Queue Management**: Concurrent upload limiting with priority handling
- **Error Recovery**: Automatic retry with exponential backoff for failed uploads
- **Pause/Resume**: Support for pausing and resuming uploads
- **File Validation**: Client-side validation for file types and sizes
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Basic File Upload

```typescript
import { useFileUpload } from '@/lib/uploads';

function FileUploadComponent() {
  const { uploadFile, uploadProgress, cancelUpload, loading, error } = useFileUpload({
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
  });

  const handleFileSelect = async (file: File) => {
    try {
      const result = await uploadFile(file, {
        courseId: 'course-123',
        onProgress: (progress) => {
          console.log(`Upload: ${progress.percentage}%`);
        },
        onComplete: (result) => {
          console.log('Upload completed:', result);
        }
      });
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
      {uploadProgress && (
        <div>
          <div>Progress: {uploadProgress.percentage}%</div>
          <div>Speed: {UploadUtils.formatSpeed(uploadProgress.speed)}</div>
          <div>Time Remaining: {UploadUtils.formatTimeRemaining(uploadProgress.timeRemaining)}</div>
          <button onClick={cancelUpload}>Cancel</button>
        </div>
      )}
      {error && <div>Error: {UploadErrorHandler.formatErrorMessage(error)}</div>}
    </div>
  );
}
```

### Video Upload with Processing Status

```typescript
import { useVideoUpload } from '@/lib/uploads';

function VideoUploadComponent() {
  const { uploadVideo, uploadProgress, processingStatus, loading, error } = useVideoUpload();

  const handleVideoUpload = async (file: File, lessonId: string) => {
    try {
      const result = await uploadVideo(file, lessonId, {
        onProgress: (progress) => {
          console.log(`Upload: ${progress.percentage}%`);
        }
      });
      console.log('Video upload completed:', result);
    } catch (err) {
      console.error('Video upload failed:', err);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="video/*"
        onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0], 'lesson-123')} 
      />
      {uploadProgress && (
        <div>Upload Progress: {uploadProgress.percentage}%</div>
      )}
      {processingStatus && (
        <div>Processing: {processingStatus.status}</div>
      )}
    </div>
  );
}
```

### Upload Queue Management

```typescript
import { useUploadQueue } from '@/lib/uploads';

function MultiFileUpload() {
  const { 
    addUpload, 
    getAllUploads, 
    cancelUpload,
    pauseUpload,
    resumeUpload,
    stats, 
    clearCompleted 
  } = useUploadQueue({
    maxConcurrentUploads: 2,
    maxRetries: 3
  });

  const handleMultipleFiles = (files: FileList) => {
    Array.from(files).forEach((file, index) => {
      addUpload(file, {
        courseId: 'course-123',
        onProgress: (progress) => {
          console.log(`File ${index + 1} progress: ${progress.percentage}%`);
        }
      }, index); // Use index as priority
    });
  };

  const allUploads = getAllUploads();

  return (
    <div>
      <div>
        Total: {stats.total}, Uploading: {stats.uploading}, 
        Completed: {stats.completed}, Failed: {stats.failed}
      </div>
      {allUploads.map(upload => (
        <div key={upload.uploadId}>
          <div>{upload.file.name}: {upload.progress.percentage}%</div>
          <div>Status: {upload.progress.status}</div>
          {upload.progress.status === 'uploading' && (
            <>
              <button onClick={() => pauseUpload(upload.uploadId)}>Pause</button>
              <button onClick={() => cancelUpload(upload.uploadId)}>Cancel</button>
            </>
          )}
          {upload.progress.status === 'paused' && (
            <button onClick={() => resumeUpload(upload.uploadId)}>Resume</button>
          )}
        </div>
      ))}
      <button onClick={clearCompleted}>Clear Completed</button>
    </div>
  );
}
```

## API Reference

### Hooks

#### `useFileUpload(validationOptions?)`

Hook for general file uploads with validation.

**Parameters:**
- `validationOptions` (optional): File validation options
  - `maxFileSize`: Maximum file size in bytes
  - `allowedMimeTypes`: Array of allowed MIME types
  - `allowedExtensions`: Array of allowed file extensions

**Returns:**
- `uploadFile`: Function to upload a file
- `uploadProgress`: Current upload progress
- `cancelUpload`: Function to cancel the upload
- `pauseUpload`: Function to pause the upload
- `resumeUpload`: Function to resume a paused upload
- `loading`: Upload loading state
- `error`: Upload error if any
- `reset`: Function to reset the upload state

#### `useVideoUpload(validationOptions?)`

Hook for video uploads with processing status monitoring.

**Parameters:**
- `validationOptions` (optional): File validation options (defaults to video types)

**Returns:**
- All properties from `useFileUpload`
- `uploadVideo`: Function to upload a video file
- `processingStatus`: Video processing status

#### `useUploadQueue(config?)`

Hook for managing multiple concurrent uploads.

**Parameters:**
- `config` (optional): Queue configuration
  - `maxConcurrentUploads`: Maximum concurrent uploads (default: 3)
  - `maxRetries`: Maximum retry attempts (default: 3)
  - `retryDelay`: Base delay for retries in ms (default: 1000)
  - `priorityLevels`: Number of priority levels (default: 5)

**Returns:**
- `addUpload`: Add a file to the queue
- `removeUpload`: Remove a file from the queue
- `cancelUpload`: Cancel an active upload
- `pauseUpload`: Pause an upload
- `resumeUpload`: Resume a paused upload
- `retryUpload`: Retry a failed upload
- `getUpload`: Get upload by ID
- `getAllUploads`: Get all uploads
- `getUploadsByStatus`: Get uploads by status
- `clearCompleted`: Clear completed uploads
- `clearAll`: Clear all uploads
- `stats`: Queue statistics
- `queue`: Direct access to queue instance

#### `useUploadProgress()`

Hook for tracking upload progress across multiple uploads.

**Returns:**
- `addUpload`: Add upload progress
- `updateUpload`: Update upload progress
- `removeUpload`: Remove upload progress
- `getUpload`: Get upload progress by ID
- `getAllUploads`: Get all upload progress
- `clearCompleted`: Clear completed uploads

### Utilities

#### `FileValidator`

Utility class for file validation.

**Methods:**
- `validateFile(file, options)`: Validates a file
- `formatFileSize(bytes)`: Formats file size for display
- `isImage(file)`: Checks if file is an image
- `isVideo(file)`: Checks if file is a video
- `isDocument(file)`: Checks if file is a document

#### `UploadProgressCalculator`

Utility class for calculating upload progress.

**Methods:**
- `calculateProgress(uploadId, loaded, total, fileName?)`: Calculates progress
- `reset()`: Resets the calculator

#### `UploadErrorHandler`

Utility class for error handling.

**Methods:**
- `createError(uploadId, code, message, retryable, details?)`: Creates an error
- `isRetryable(error)`: Checks if error is retryable
- `getRetryDelay(attemptNumber, baseDelay?)`: Gets retry delay with backoff
- `formatErrorMessage(error)`: Formats error for display

#### `UploadUtils`

General upload utilities.

**Methods:**
- `generateUploadId()`: Generates a unique upload ID
- `createUploadFormData(file, presignedData)`: Creates FormData for S3
- `isPresignedUrlExpired(expiresAt)`: Checks if URL is expired
- `formatSpeed(bytesPerSecond)`: Formats upload speed
- `formatTimeRemaining(seconds)`: Formats time remaining
- `debounceProgressUpdate(callback, delay?)`: Debounces progress updates

### Classes

#### `UploadQueue`

Class for managing upload queues.

**Constructor:**
```typescript
new UploadQueue(config?: Partial<UploadQueueConfig>)
```

**Methods:**
- `addUpload(file, options?, priority?)`: Adds a file to the queue
- `removeUpload(uploadId)`: Removes an upload
- `cancelUpload(uploadId)`: Cancels an upload
- `pauseUpload(uploadId)`: Pauses an upload
- `resumeUpload(uploadId)`: Resumes an upload
- `retryUpload(uploadId)`: Retries a failed upload
- `getUpload(uploadId)`: Gets an upload by ID
- `getAllUploads()`: Gets all uploads
- `getUploadsByStatus(status)`: Gets uploads by status
- `getStats()`: Gets queue statistics
- `clearCompleted()`: Clears completed uploads
- `clearAll()`: Clears all uploads
- `updateProgress(uploadId, progress)`: Updates upload progress
- `setAbortController(uploadId, controller)`: Sets abort controller
- `on(event, listener)`: Adds event listener
- `off(event, listener)`: Removes event listener
- `getConfig()`: Gets current configuration
- `updateConfig(newConfig)`: Updates configuration

**Events:**
- `added`: Upload added to queue
- `removed`: Upload removed from queue
- `started`: Upload started
- `progress`: Upload progress updated
- `completed`: Upload completed
- `failed`: Upload failed
- `cancelled`: Upload cancelled
- `paused`: Upload paused
- `resumed`: Upload resumed
- `retrying`: Upload retrying

## Types

### `UploadProgress`

```typescript
interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: UploadStatus;
  error?: string;
  fileName?: string;
}
```

### `UploadStatus`

```typescript
type UploadStatus = 
  | 'pending' 
  | 'uploading' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'paused';
```

### `UploadOptions`

```typescript
interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  priority?: number;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
  onComplete?: (result: UploadResult) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}
```

### `UploadError`

```typescript
interface UploadError {
  uploadId: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}
```

### `UploadResult`

```typescript
interface UploadResult {
  id: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: string;
}
```

## Best Practices

1. **Always validate files** before uploading to provide immediate feedback
2. **Use appropriate file size limits** based on your use case
3. **Implement progress tracking** for better user experience
4. **Handle errors gracefully** with user-friendly messages
5. **Use upload queues** for multiple file uploads to manage concurrency
6. **Clean up completed uploads** to prevent memory leaks
7. **Provide cancel/pause options** for long-running uploads
8. **Use retry logic** for transient network errors

## Error Handling

The upload system provides comprehensive error handling with automatic retry for retryable errors:

```typescript
const { uploadFile, error } = useFileUpload();

try {
  await uploadFile(file, {
    onError: (error) => {
      if (error.retryable) {
        console.log('Upload will be retried automatically');
      } else {
        console.error('Upload failed permanently:', error.message);
      }
    }
  });
} catch (err) {
  // Handle final error after all retries
  const uploadError = err as UploadError;
  const userMessage = UploadErrorHandler.formatErrorMessage(uploadError);
  alert(userMessage);
}
```

## Performance Considerations

- **Concurrent Uploads**: Limit concurrent uploads to avoid overwhelming the network
- **Progress Updates**: Progress updates are debounced to prevent excessive re-renders
- **Memory Management**: Clean up completed uploads regularly
- **File Size**: Validate file sizes before upload to prevent unnecessary network usage
- **Retry Strategy**: Use exponential backoff to avoid overwhelming the server

## Integration with Backend

The upload system integrates with the backend's presigned URL workflow:

1. **Request Presigned URL**: Client requests a presigned URL from the backend
2. **Upload to S3**: Client uploads file directly to S3 using the presigned URL
3. **Complete Upload**: Client notifies backend that upload is complete
4. **Processing**: Backend processes the file (e.g., video transcoding)

This approach provides:
- **Security**: Files are uploaded directly to S3 without going through the backend
- **Performance**: Reduces backend load and improves upload speed
- **Scalability**: S3 handles the upload traffic

## Migration from Legacy Hooks

If you're using the legacy upload hooks from `hooks/useContent.ts`, migrate to the new system:

```typescript
// Old (deprecated)
import { useFileUpload } from '@/hooks/useContent';

// New (recommended)
import { useFileUpload } from '@/lib/uploads';
```

The new system provides:
- Better error handling
- Queue management
- Pause/resume support
- More comprehensive progress tracking
- Better TypeScript support

## License

Part of the frontend foundation layer for the Learning Management System.