/**
 * Cache Provider Component
 * 
 * React provider component that provides cache management functionality.
 */

'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';
import { useApolloClient } from '@apollo/client';

export interface CacheContextValue {
  /** Clear all cache data */
  clearCache: () => Promise<void>;
  /** Clear specific cache entries */
  clearCacheEntries: (keys: string[]) => Promise<void>;
  /** Get cache statistics */
  getCacheStats: () => {
    size: number;
    entries: number;
  };
  /** Refresh cache data */
  refreshCache: () => Promise<void>;
}

const CacheContext = createContext<CacheContextValue | null>(null);

export interface CacheProviderProps {
  children: React.ReactNode;
}

/**
 * Cache Provider component that provides cache management functionality
 */
export function CacheProvider({ children }: CacheProviderProps) {
  const client = useApolloClient();
  const [cacheStats, setCacheStats] = useState({ size: 0, entries: 0 });

  const clearCache = useCallback(async () => {
    await client.clearStore();
    setCacheStats({ size: 0, entries: 0 });
  }, [client]);

  const clearCacheEntries = useCallback(async (keys: string[]) => {
    // Clear specific cache entries
    keys.forEach(key => {
      client.cache.evict({ id: key });
    });
    client.cache.gc();
  }, [client]);

  const getCacheStats = useCallback(() => {
    // In a real implementation, you'd calculate actual cache size
    return cacheStats;
  }, [cacheStats]);

  const refreshCache = useCallback(async () => {
    await client.refetchQueries({ include: 'active' });
  }, [client]);

  const contextValue: CacheContextValue = {
    clearCache,
    clearCacheEntries,
    getCacheStats,
    refreshCache,
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