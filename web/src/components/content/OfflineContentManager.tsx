/**
 * Offline Content Manager Component
 *
 * Manages offline content access capabilities including download,
 * storage, synchronization, and offline playback.
 *
 * Features:
 * - Content download for offline access
 * - Intelligent storage management
 * - Sync status tracking
 * - Offline playback capabilities
 * - Storage quota management
 *
 * Requirements: 13.5
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useUsers';

interface OfflineContentManagerProps {
  lessonId: string;
  courseId: string;
  streamingUrl: string;
  className?: string;
}

interface OfflineContent {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  url: string;
  size: number;
  downloadedAt: Date;
  lastAccessedAt: Date;
  expiresAt?: Date;
  quality: string;
  format: string;
}

interface StorageInfo {
  used: number;
  available: number;
  quota: number;
  percentage: number;
}

interface DownloadProgress {
  lessonId: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  error?: string;
}

export function OfflineContentManager({
  lessonId,
  courseId,
  streamingUrl,
  className = '',
}: OfflineContentManagerProps) {
  const { data: currentUser } = useCurrentUser();
  const [isOfflineSupported, setIsOfflineSupported] = useState(false);
  const [offlineContent, setOfflineContent] = useState<OfflineContent[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showManager, setShowManager] = useState(false);

  // Check offline support
  useEffect(() => {
    const checkOfflineSupport = () => {
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasIndexedDB = 'indexedDB' in window;
      const hasStorage = 'storage' in navigator;

      setIsOfflineSupported(hasServiceWorker && hasIndexedDB && hasStorage);
    };

    checkOfflineSupport();
  }, []);

  // Open IndexedDB for offline content
  const openOfflineDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineContent', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('content')) {
          const store = db.createObjectStore('content', { keyPath: 'id' });
          store.createIndex('lessonId', 'lessonId', { unique: false });
          store.createIndex('courseId', 'courseId', { unique: false });
        }
      };
    });
  }, []);

  // Load offline content from IndexedDB
  const loadOfflineContent = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const request = store.getAll();

      request.onsuccess = () => {
        const content = request.result as OfflineContent[];
        setOfflineContent(content);

        // Check if current lesson is downloaded
        const currentContent = content.find(c => c.lessonId === lessonId);
        setIsDownloaded(!!currentContent);
      };
    } catch (error) {
      console.error('Failed to load offline content:', error);
    }
  }, [lessonId, openOfflineDB]);

  // Update storage information
  const updateStorageInfo = useCallback(async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = quota - used;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;

        setStorageInfo({
          used,
          available,
          quota,
          percentage,
        });
      }
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  }, []);

  // Load offline content and storage info
  useEffect(() => {
    if (!isOfflineSupported) return;

    loadOfflineContent();
    updateStorageInfo();
  }, [isOfflineSupported, loadOfflineContent, updateStorageInfo]);

  // Download content for offline access
  const downloadContent = useCallback(async () => {
    if (!streamingUrl || !isOfflineSupported) return;

    try {
      setDownloadProgress({
        lessonId,
        progress: 0,
        status: 'downloading',
      });

      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }

      // Download the video content
      const response = await fetch(streamingUrl);
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
        setDownloadProgress({
          lessonId,
          progress,
          status: 'downloading',
        });
      }

      // Combine chunks into blob
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });

      // Store in IndexedDB
      const db = await openOfflineDB();
      const transaction = db.transaction(['content'], 'readwrite');
      const store = transaction.objectStore('content');

      const offlineContentItem: OfflineContent = {
        id: `${courseId}-${lessonId}`,
        lessonId,
        courseId,
        title: `Lesson ${lessonId}`, // This should come from lesson data
        url: URL.createObjectURL(blob),
        size: downloadedSize,
        downloadedAt: new Date(),
        lastAccessedAt: new Date(),
        quality: 'standard',
        format: 'mp4',
      };

      await new Promise((resolve, reject) => {
        const request = store.put(offlineContentItem);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      setDownloadProgress({
        lessonId,
        progress: 100,
        status: 'completed',
      });

      setIsDownloaded(true);
      await loadOfflineContent();
      await updateStorageInfo();
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress({
        lessonId,
        progress: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Download failed',
      });
    }
  }, [streamingUrl, lessonId, courseId, isOfflineSupported, loadOfflineContent, updateStorageInfo, openOfflineDB]);

  // Remove offline content
  const removeContent = useCallback(
    async (contentId: string) => {
      try {
        const db = await openOfflineDB();
        const transaction = db.transaction(['content'], 'readwrite');
        const store = transaction.objectStore('content');

        await new Promise((resolve, reject) => {
          const request = store.delete(contentId);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (contentId === `${courseId}-${lessonId}`) {
          setIsDownloaded(false);
        }

        await loadOfflineContent();
        await updateStorageInfo();
      } catch (error) {
        console.error('Failed to remove content:', error);
      }
    },
    [courseId, lessonId, loadOfflineContent, updateStorageInfo, openOfflineDB]
  );

  // Clean up expired content
  const cleanupExpiredContent = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['content'], 'readwrite');
      const store = transaction.objectStore('content');
      const request = store.getAll();

      request.onsuccess = async () => {
        const content = request.result as OfflineContent[];
        const now = new Date();

        for (const item of content) {
          if (item.expiresAt && item.expiresAt < now) {
            await removeContent(item.id);
          }
        }
      };
    } catch (error) {
      console.error('Failed to cleanup expired content:', error);
    }
  }, [removeContent, openOfflineDB]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Don't render if offline not supported or user not authenticated
  if (!isOfflineSupported || !currentUser) {
    return null;
  }

  return (
    <div className={`offline-content-manager ${className}`}>
      {/* Download button */}
      {!isDownloaded && streamingUrl && (
        <button
          onClick={downloadContent}
          disabled={downloadProgress?.status === 'downloading'}
          className='download-button'
        >
          {downloadProgress?.status === 'downloading' ? (
            <>
              <span className='download-icon'>⬇️</span>
              Downloading... {Math.round(downloadProgress.progress)}%
            </>
          ) : (
            <>
              <span className='download-icon'>⬇️</span>
              Download for Offline
            </>
          )}
        </button>
      )}

      {/* Downloaded indicator */}
      {isDownloaded && (
        <div className='downloaded-indicator'>
          <span className='offline-icon'>📱</span>
          Available Offline
          <button
            onClick={() => removeContent(`${courseId}-${lessonId}`)}
            className='remove-button'
            title='Remove offline content'
          >
            ✕
          </button>
        </div>
      )}

      {/* Download progress */}
      {downloadProgress && downloadProgress.status === 'downloading' && (
        <div className='download-progress'>
          <div className='progress-bar'>
            <div className='progress-fill' style={{ width: `${downloadProgress.progress}%` }} />
          </div>
          <div className='progress-text'>{Math.round(downloadProgress.progress)}% downloaded</div>
        </div>
      )}

      {/* Error state */}
      {downloadProgress?.status === 'failed' && (
        <div className='download-error'>
          <span className='error-icon'>⚠️</span>
          Download failed: {downloadProgress.error}
          <button onClick={downloadContent} className='retry-button'>
            Retry
          </button>
        </div>
      )}

      {/* Offline manager toggle */}
      <button
        onClick={() => setShowManager(!showManager)}
        className='manager-toggle'
        title='Manage offline content'
      >
        <span className='settings-icon'>⚙️</span>
      </button>

      {/* Offline content manager */}
      {showManager && (
        <div className='offline-manager-panel'>
          <div className='panel-header'>
            <h3>Offline Content</h3>
            <button onClick={() => setShowManager(false)} className='close-button'>
              ✕
            </button>
          </div>

          {/* Storage info */}
          {storageInfo && (
            <div className='storage-info'>
              <h4>Storage Usage</h4>
              <div className='storage-bar'>
                <div className='storage-fill' style={{ width: `${storageInfo.percentage}%` }} />
              </div>
              <div className='storage-details'>
                <span>Used: {formatFileSize(storageInfo.used)}</span>
                <span>Available: {formatFileSize(storageInfo.available)}</span>
              </div>
            </div>
          )}

          {/* Offline content list */}
          <div className='content-list'>
            <h4>Downloaded Content</h4>
            {offlineContent.length === 0 ? (
              <p className='no-content'>No offline content available</p>
            ) : (
              <div className='content-items'>
                {offlineContent.map(content => (
                  <div key={content.id} className='content-item'>
                    <div className='content-info'>
                      <div className='content-title'>{content.title}</div>
                      <div className='content-meta'>
                        {formatFileSize(content.size)} • {content.quality}
                      </div>
                      <div className='content-date'>
                        Downloaded: {content.downloadedAt.toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeContent(content.id)}
                      className='remove-content-button'
                      title='Remove from offline storage'
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Management actions */}
          <div className='management-actions'>
            <button onClick={cleanupExpiredContent} className='cleanup-button'>
              Clean Up Expired
            </button>
            <button
              onClick={() => {
                offlineContent.forEach(content => removeContent(content.id));
              }}
              className='clear-all-button'
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility functions for offline content management
export const OfflineContentUtils = {
  /**
   * Check if content is available offline
   */
  isContentAvailableOffline: async (lessonId: string): Promise<boolean> => {
    try {
      const request = indexedDB.open('OfflineContent', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const transaction = db.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const index = store.index('lessonId');
      const getRequest = index.get(lessonId);

      return new Promise(resolve => {
        getRequest.onsuccess = () => resolve(!!getRequest.result);
        getRequest.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  /**
   * Get offline content URL
   */
  getOfflineContentUrl: async (lessonId: string): Promise<string | null> => {
    try {
      const request = indexedDB.open('OfflineContent', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const transaction = db.transaction(['content'], 'readonly');
      const store = transaction.objectStore('content');
      const index = store.index('lessonId');
      const getRequest = index.get(lessonId);

      return new Promise(resolve => {
        getRequest.onsuccess = () => {
          const content = getRequest.result as OfflineContent;
          resolve(content?.url || null);
        };
        getRequest.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /**
   * Check available storage space
   */
  getAvailableStorage: async (): Promise<number> => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return (estimate.quota || 0) - (estimate.usage || 0);
      }
      return 0;
    } catch {
      return 0;
    }
  },
};

export default OfflineContentManager;