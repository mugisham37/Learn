/**
 * Cache Provider Component
 * 
 * React provider component that provides comprehensive cache management functionality
 * with backend integration, persistence, and optimization.
 */

'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { InMemoryCache } from '@apollo/client';
import { BackendCacheManager, createBackendCacheManager, BackendModule } from './backendIntegration';
import { cacheConfig } from '../config';

export interface CacheContextValue {
  /** Clear all cache data */
  clearCache: () => Promise<void>;
  /** Clear specific cache entries */
  clearCacheEntries: (keys: string[]) => Promise<void>;
  /** Get cache statistics */
  getCacheStats: () => {
    size: number;
    entities: number;
    queries: number;
    subscriptions: number;
    memoryUsage: string;
  };
  /** Refresh cache data */
  refreshCache: () => Promise<void>;
  /** Backend cache manager instance */
  backendManager: BackendCacheManager | null;
  /** Get module-specific cache statistics */
  getModuleStats: (module: BackendModule) => {
    entities: number;
    queries: number;
    memoryUsage: string;
  };
  /** Persist cache to storage */
  persistCache: () => boolean;
  /** Load persisted cache */
  loadPersistedCache: () => boolean;
  /** Clear persisted cache */
  clearPersistedCache: () => boolean;
  /** Get cache health report */
  getHealthReport: () => {
    overall: 'healthy' | 'warning' | 'critical';
    stats: {
      size: number;
      entities: number;
      queries: number;
      subscriptions: number;
      memoryUsage: string;
    };
    persistence: {
      size: number;
      timestamp: number;
      version: string;
      age: number;
      sizeInMB: string;
    } | null;
    optimization: {
      metrics: {
        totalObjects: number;
        estimatedSize: number;
        hitRate: number;
        missRate: number;
        evictions: number;
        memoryUsage: number;
        lastCleanup: Date;
      };
      recommendations: string[];
      performance: {
        hitRate: number;
        memoryEfficiency: number;
        evictionRate: number;
      };
    } | null;
    recommendations: string[];
  };
}

const CacheContext = createContext<CacheContextValue | null>(null);

export interface CacheProviderProps {
  children: React.ReactNode;
  enablePersistence?: boolean;
  enableOptimization?: boolean;
  persistenceKey?: string;
}

/**
 * Cache Provider component that provides comprehensive cache management functionality
 * with backend integration, persistence, and optimization
 */
export function CacheProvider({ 
  children, 
  enablePersistence = cacheConfig.enablePersistence,
  enableOptimization = true,
  persistenceKey = 'lms-apollo-cache'
}: CacheProviderProps) {
  const client = useApolloClient();
  const cache = client.cache as InMemoryCache;
  const [backendManager, setBackendManager] = useState<BackendCacheManager | null>(null);
  const [cacheStats, setCacheStats] = useState({ 
    size: 0, 
    entities: 0, 
    queries: 0, 
    subscriptions: 0,
    memoryUsage: '0 MB'
  });

  // Initialize backend cache manager
  useEffect(() => {
    const manager = createBackendCacheManager(cache, client, {
      enablePersistence,
      enableOptimization,
      persistenceKey,
    });
    
    setBackendManager(manager);

    // Update cache stats periodically
    const updateStats = () => {
      if (manager) {
        const healthReport = manager.getHealthReport();
        setCacheStats(healthReport.stats);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
      manager.destroy();
    };
  }, [cache, client, enablePersistence, enableOptimization, persistenceKey]);

  const clearCache = useCallback(async () => {
    await client.clearStore();
    setCacheStats({ 
      size: 0, 
      entities: 0, 
      queries: 0, 
      subscriptions: 0,
      memoryUsage: '0 MB'
    });
    
    // Clear persisted cache as well
    if (backendManager) {
      backendManager.clearPersistedCache();
    }
  }, [client, backendManager]);

  const clearCacheEntries = useCallback(async (keys: string[]) => {
    // Clear specific cache entries
    keys.forEach(key => {
      client.cache.evict({ id: key });
    });
    client.cache.gc();
    
    // Update stats
    if (backendManager) {
      const healthReport = backendManager.getHealthReport();
      setCacheStats(healthReport.stats);
    }
  }, [client, backendManager]);

  const getCacheStats = useCallback(() => {
    return cacheStats;
  }, [cacheStats]);

  const refreshCache = useCallback(async () => {
    await client.refetchQueries({ include: 'active' });
  }, [client]);

  const getModuleStats = useCallback((module: BackendModule) => {
    if (!backendManager) {
      return { entities: 0, queries: 0, memoryUsage: '0 MB' };
    }
    return backendManager.getModuleStats(module);
  }, [backendManager]);

  const persistCache = useCallback(() => {
    if (!backendManager) return false;
    return backendManager.persistCache();
  }, [backendManager]);

  const loadPersistedCache = useCallback(() => {
    if (!backendManager) return false;
    return backendManager.loadPersistedCache();
  }, [backendManager]);

  const clearPersistedCache = useCallback(() => {
    if (!backendManager) return false;
    return backendManager.clearPersistedCache();
  }, [backendManager]);

  const getHealthReport = useCallback(() => {
    if (!backendManager) {
      return {
        overall: 'healthy' as const,
        stats: cacheStats,
        persistence: null,
        optimization: null,
        recommendations: [],
      };
    }
    return backendManager.getHealthReport();
  }, [backendManager, cacheStats]);

  const contextValue: CacheContextValue = {
    clearCache,
    clearCacheEntries,
    getCacheStats,
    refreshCache,
    backendManager,
    getModuleStats,
    persistCache,
    loadPersistedCache,
    clearPersistedCache,
    getHealthReport,
  };

  return (
    <CacheContext.Provider value={contextValue}>
      {children}
    </CacheContext.Provider>
  );
}

/**
 * Hook to access cache management functionality
 */
export function useCacheManager(): CacheContextValue {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('useCacheManager must be used within a CacheProvider');
  }
  return context;
}

/**
 * Hook to access backend cache manager directly
 */
export function useBackendCacheManager(): BackendCacheManager | null {
  const { backendManager } = useCacheManager();
  return backendManager;
}

/**
 * Hook for module-specific cache operations
 */
export function useModuleCache(module: BackendModule) {
  const { backendManager, getModuleStats } = useCacheManager();
  
  const executeOperation = useCallback(async (operation: Parameters<BackendCacheManager['executeOperation']>[0]) => {
    if (!backendManager) {
      throw new Error('Backend cache manager not initialized');
    }
    return backendManager.executeOperation({ ...operation, module });
  }, [backendManager, module]);

  const getStats = useCallback(() => {
    return getModuleStats(module);
  }, [getModuleStats, module]);

  const warmCache = useCallback(async (queries: Parameters<BackendCacheManager['warmModuleCache']>[1]) => {
    if (!backendManager) return;
    return backendManager.warmModuleCache(module, queries);
  }, [backendManager, module]);

  return {
    executeOperation,
    getStats,
    warmCache,
  };
}

/**
 * Hook for cache health monitoring
 */
export function useCacheHealth() {
  const { getHealthReport } = useCacheManager();
  const [healthReport, setHealthReport] = useState(getHealthReport());

  useEffect(() => {
    const updateHealth = () => {
      setHealthReport(getHealthReport());
    };

    updateHealth();
    const interval = setInterval(updateHealth, 60000); // Every minute

    return () => clearInterval(interval);
  }, [getHealthReport]);

  return healthReport;
}