/**
 * Upload Queue Management
 * 
 * Manages concurrent uploads with priority handling, retry logic,
 * and queue statistics.
 */

import type {
  UploadQueueItem,
  UploadQueueConfig,
  UploadQueueStats,
  UploadProgress,
  UploadOptions,
  UploadError,
} from './uploadTypes';
import { UploadErrorHandler, UploadUtils } from './uploadHelpers';

/**
 * Upload queue manager for handling multiple concurrent uploads
 */
export class UploadQueue {
  private queue: Map<string, UploadQueueItem> = new Map();
  private activeUploads: Set<string> = new Set();
  private config: UploadQueueConfig;
  private eventListeners: Map<string, Set<(item: UploadQueueItem) => void>> = new Map();

  constructor(config: Partial<UploadQueueConfig> = {}) {
    this.config = {
      maxConcurrentUploads: 3,
      maxRetries: 3,
      retryDelay: 1000,
      priorityLevels: 5,
      ...config,
    };
  }

  /**
   * Adds a file to the upload queue
   */
  addUpload(
    file: File,
    options: UploadOptions = {},
    priority: number = 0
  ): string {
    const uploadId = UploadUtils.generateUploadId();
    const normalizedPriority = Math.max(0, Math.min(priority, this.config.priorityLevels - 1));

    const queueItem: UploadQueueItem = {
      uploadId,
      file,
      options,
      priority: normalizedPriority,
      createdAt: new Date(),
      progress: {
        uploadId,
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'pending',
        fileName: file.name,
      },
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };

    this.queue.set(uploadId, queueItem);
    this.emit('added', queueItem);
    
    // Try to start the upload immediately
    this.processQueue();
    
    return uploadId;
  }

  /**
   * Removes an upload from the queue
   */
  removeUpload(uploadId: string): boolean {
    const item = this.queue.get(uploadId);
    if (!item) return false;

    // Cancel if currently uploading
    if (this.activeUploads.has(uploadId)) {
      this.cancelUpload(uploadId);
    }

    this.queue.delete(uploadId);
    this.emit('removed', item);
    
    // Process queue to start next uploads
    this.processQueue();
    
    return true;
  }

  /**
   * Cancels an active upload
   */
  cancelUpload(uploadId: string): boolean {
    const item = this.queue.get(uploadId);
    if (!item) return false;

    // Abort the upload if it has an abort controller
    if (item.abortController) {
      item.abortController.abort();
    }

    // Update status
    item.progress = {
      ...item.progress,
      status: 'cancelled',
    };

    this.activeUploads.delete(uploadId);
    this.emit('cancelled', item);
    
    // Process queue to start next uploads
    this.processQueue();
    
    return true;
  }

  /**
   * Pauses an upload (if supported)
   */
  pauseUpload(uploadId: string): boolean {
    const item = this.queue.get(uploadId);
    if (!item || !this.activeUploads.has(uploadId)) return false;

    // Abort current upload
    if (item.abortController) {
      item.abortController.abort();
    }

    item.progress = {
      ...item.progress,
      status: 'paused',
    };

    this.activeUploads.delete(uploadId);
    this.emit('paused', item);
    
    // Process queue to start next uploads
    this.processQueue();
    
    return true;
  }

  /**
   * Resumes a paused upload
   */
  resumeUpload(uploadId: string): boolean {
    const item = this.queue.get(uploadId);
    if (!item || item.progress.status !== 'paused') return false;

    item.progress = {
      ...item.progress,
      status: 'pending',
    };

    this.emit('resumed', item);
    
    // Process queue to start the upload
    this.processQueue();
    
    return true;
  }

  /**
   * Retries a failed upload
   */
  retryUpload(uploadId: string): boolean {
    const item = this.queue.get(uploadId);
    if (!item || item.progress.status !== 'failed') return false;

    if (item.retryCount >= item.maxRetries) {
      return false; // Max retries exceeded
    }

    item.retryCount++;
    item.progress = {
      ...item.progress,
      status: 'pending',
      error: undefined,
    };

    this.emit('retrying', item);
    
    // Process queue to start the upload
    this.processQueue();
    
    return true;
  }

  /**
   * Gets an upload item by ID
   */
  getUpload(uploadId: string): UploadQueueItem | undefined {
    return this.queue.get(uploadId);
  }

  /**
   * Gets all uploads in the queue
   */
  getAllUploads(): UploadQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Gets uploads by status
   */
  getUploadsByStatus(status: UploadProgress['status']): UploadQueueItem[] {
    return Array.from(this.queue.values()).filter(item => item.progress.status === status);
  }

  /**
   * Gets queue statistics
   */
  getStats(): UploadQueueStats {
    const uploads = Array.from(this.queue.values());
    
    return {
      total: uploads.length,
      pending: uploads.filter(item => item.progress.status === 'pending').length,
      uploading: uploads.filter(item => item.progress.status === 'uploading').length,
      completed: uploads.filter(item => item.progress.status === 'completed').length,
      failed: uploads.filter(item => item.progress.status === 'failed').length,
      cancelled: uploads.filter(item => item.progress.status === 'cancelled').length,
    };
  }

  /**
   * Clears completed uploads from the queue
   */
  clearCompleted(): number {
    const completedIds: string[] = [];
    
    this.queue.forEach((item, uploadId) => {
      if (item.progress.status === 'completed') {
        completedIds.push(uploadId);
      }
    });

    completedIds.forEach(uploadId => {
      const item = this.queue.get(uploadId);
      if (item) {
        this.queue.delete(uploadId);
        this.emit('removed', item);
      }
    });

    return completedIds.length;
  }

  /**
   * Clears all uploads from the queue
   */
  clearAll(): void {
    // Cancel all active uploads
    this.activeUploads.forEach(uploadId => {
      this.cancelUpload(uploadId);
    });

    // Clear the queue
    const items = Array.from(this.queue.values());
    this.queue.clear();
    this.activeUploads.clear();

    items.forEach(item => {
      this.emit('removed', item);
    });
  }

  /**
   * Updates upload progress
   */
  updateProgress(uploadId: string, progress: Partial<UploadProgress>): void {
    const item = this.queue.get(uploadId);
    if (!item) return;

    item.progress = {
      ...item.progress,
      ...progress,
    };

    this.emit('progress', item);

    // Handle completion or failure
    if (progress.status === 'completed') {
      item.completedAt = new Date();
      this.activeUploads.delete(uploadId);
      this.emit('completed', item);
      this.processQueue(); // Start next uploads
    } else if (progress.status === 'failed') {
      this.activeUploads.delete(uploadId);
      this.emit('failed', item);
      
      // Auto-retry if retries are available
      if (item.retryCount < item.maxRetries) {
        setTimeout(() => {
          this.retryUpload(uploadId);
        }, UploadErrorHandler.getRetryDelay(item.retryCount + 1, this.config.retryDelay));
      } else {
        this.processQueue(); // Start next uploads
      }
    }
  }

  /**
   * Sets an abort controller for an upload
   */
  setAbortController(uploadId: string, controller: AbortController): void {
    const item = this.queue.get(uploadId);
    if (item) {
      item.abortController = controller;
    }
  }

  /**
   * Processes the queue to start pending uploads
   */
  private processQueue(): void {
    // Don't start new uploads if we're at the limit
    if (this.activeUploads.size >= this.config.maxConcurrentUploads) {
      return;
    }

    // Get pending uploads sorted by priority (higher priority first) and creation time
    const pendingUploads = Array.from(this.queue.values())
      .filter(item => item.progress.status === 'pending')
      .sort((a, b) => {
        // Sort by priority first (higher priority first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by creation time (older first)
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    // Start uploads up to the concurrent limit
    const slotsAvailable = this.config.maxConcurrentUploads - this.activeUploads.size;
    const uploadsToStart = pendingUploads.slice(0, slotsAvailable);

    uploadsToStart.forEach(item => {
      this.startUpload(item);
    });
  }

  /**
   * Starts an individual upload
   */
  private startUpload(item: UploadQueueItem): void {
    item.startedAt = new Date();
    item.progress = {
      ...item.progress,
      status: 'uploading',
    };

    this.activeUploads.add(item.uploadId);
    this.emit('started', item);
  }

  /**
   * Event listener management
   */
  on(event: string, listener: (item: UploadQueueItem) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: (item: UploadQueueItem) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, item: UploadQueueItem): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(item);
        } catch (error) {
          console.error(`Error in upload queue event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Gets the current configuration
   */
  getConfig(): UploadQueueConfig {
    return { ...this.config };
  }

  /**
   * Updates the queue configuration
   */
  updateConfig(newConfig: Partial<UploadQueueConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Process queue in case concurrent limit changed
    this.processQueue();
  }
}