/**
 * Upload Provider Component
 *
 * React provider component that provides upload functionality to child components.
 */

'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';
import { UploadQueue } from './uploadQueue';
import type { UploadQueueConfig, UploadQueueStats } from './uploadTypes';

export interface UploadContextValue {
  /** Global upload queue instance */
  uploadQueue: UploadQueue;
  /** Current upload statistics */
  stats: UploadQueueStats;
  /** Refresh upload statistics */
  refreshStats: () => void;
  /** Clear all completed uploads */
  clearCompleted: () => void;
  /** Pause all uploads */
  pauseAll: () => void;
  /** Resume all uploads */
  resumeAll: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export interface UploadProviderProps {
  children: React.ReactNode;
  /** Upload queue configuration */
  config?: Partial<UploadQueueConfig>;
}

/**
 * Upload Provider component that provides upload functionality
 */
export function UploadProvider({ children, config }: UploadProviderProps) {
  const [uploadQueue] = useState(() => new UploadQueue(config));
  const [stats, setStats] = useState<UploadQueueStats>(() => uploadQueue.getStats());

  const refreshStats = useCallback(() => {
    setStats(uploadQueue.getStats());
  }, [uploadQueue]);

  const clearCompleted = useCallback(() => {
    uploadQueue.clearCompleted();
    refreshStats();
  }, [uploadQueue, refreshStats]);

  const pauseAll = useCallback(() => {
    uploadQueue.pauseAll();
    refreshStats();
  }, [uploadQueue, refreshStats]);

  const resumeAll = useCallback(() => {
    uploadQueue.resumeAll();
    refreshStats();
  }, [uploadQueue, refreshStats]);

  // Update stats when queue changes
  React.useEffect(() => {
    const interval = setInterval(refreshStats, 1000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  const contextValue: UploadContextValue = {
    uploadQueue,
    stats,
    refreshStats,
    clearCompleted,
    pauseAll,
    resumeAll,
  };

  return <UploadContext.Provider value={contextValue}>{children}</UploadContext.Provider>;
}

/**
 * Hook to access upload context
 */
export function useUploadContext(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadContext must be used within an UploadProvider');
  }
  return context;
}
