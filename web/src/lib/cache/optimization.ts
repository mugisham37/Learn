/**
 * Cache Optimization Utilities
 * 
 * Cache size monitoring and management, cache eviction strategies,
 * cache warming utilities, and cache performance monitoring.
 * 
 * Requirements: 12.4
 */

import React from 'react';
import { ApolloCache, NormalizedCacheObject } from '@apollo/client';
import { DocumentNode } from 'graphql';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface CacheMetrics {
  totalObjects: number;
  estimatedSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
  lastCleanup: Date;
}

export interface CacheEvictionStrategy {
  name: string;
  shouldEvict: (entry: CacheEntry, metrics: CacheMetrics) => boolean;
  priority: (entry: CacheEntry) => number;
}

export interface CacheEntry {
  key: string;
  data: Record<string, unknown>;
  lastAccessed: Date;
  created: Date;
  accessCount: number;
  size: number;
  type: string;
}

export interface CacheWarmingConfig {
  criticalQueries: Array<{
    query: DocumentNode;
    variables?: Record<string, unknown>;
    priority: number;
  }>;
  maxConcurrent: number;
  timeout: number;
  retryFailed: boolean;
}

export interface CacheOptimizationConfig {
  maxSize: number;
  targetSize: number;
  cleanupInterval: number;
  evictionStrategies: CacheEvictionStrategy[];
  enableMonitoring: boolean;
  warming?: CacheWarmingConfig;
}

// Apollo Client interface for cache operations
interface ApolloClientLike {
  query: (options: { query: DocumentNode; variables?: Record<string, unknown>; fetchPolicy?: string }) => Promise<unknown>;
}

// =============================================================================
// Cache Eviction Strategies
// =============================================================================

/**
 * Least Recently Used (LRU) eviction strategy
 */
export const LRUEvictionStrategy: CacheEvictionStrategy = {
  name: 'LRU',
  shouldEvict: (entry, metrics) => {
    const ageThreshold = 30 * 60 * 1000; // 30 minutes
    const age = Date.now() - entry.lastAccessed.getTime();
    return age > ageThreshold && metrics.memoryUsage > 0.8;
  },
  priority: (entry) => {
    return Date.now() - entry.lastAccessed.getTime();
  },
};

/**
 * Least Frequently Used (LFU) eviction strategy
 */
export const LFUEvictionStrategy: CacheEvictionStrategy = {
  name: 'LFU',
  shouldEvict: (entry, metrics) => {
    const minAccessThreshold = 2;
    return entry.accessCount < minAccessThreshold && metrics.memoryUsage > 0.7;
  },
  priority: (entry) => {
    return 1 / (entry.accessCount + 1);
  },
};

/**
 * Size-based eviction strategy
 */
export const SizeBasedEvictionStrategy: CacheEvictionStrategy = {
  name: 'Size-Based',
  shouldEvict: (entry, metrics) => {
    const sizeThreshold = 1024 * 1024; // 1MB
    return entry.size > sizeThreshold && metrics.memoryUsage > 0.6;
  },
  priority: (entry) => {
    return entry.size;
  },
};

/**
 * Time-to-Live (TTL) eviction strategy
 */
export const TTLEvictionStrategy: CacheEvictionStrategy = {
  name: 'TTL',
  shouldEvict: (entry, metrics) => {
    const ttl = 60 * 60 * 1000; // 1 hour
    const age = Date.now() - entry.created.getTime();
    return age > ttl && metrics.memoryUsage > 0.5;
  },
  priority: (entry) => {
    return Date.now() - entry.created.getTime();
  },
};

// =============================================================================
// Cache Optimizer
// =============================================================================

export class CacheOptimizer {
  private cache: InMemoryCache;
  private monitor: CacheMonitor;
  private config: CacheOptimizationConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    cache: InMemoryCache,
    config: Partial<CacheOptimizationConfig> = {}
  ) {
    this.cache = cache;
    this.monitor = new CacheMonitor(cache);
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      targetSize: 40 * 1024 * 1024, // 40MB
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      evictionStrategies: [LRUEvictionStrategy, LFUEvictionStrategy],
      enableMonitoring: true,
      ...config,
    };

    this.startCleanupInterval();
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Perform cache cleanup based on configured strategies
   */
  private performCleanup(): void {
    const metrics = this.monitor.getMetrics();
    
    if (metrics.estimatedSize <= this.config.maxSize) {
      return; // No cleanup needed
    }

    const entries = this.monitor.getCacheEntries();
    const toEvict: CacheEntry[] = [];

    // Apply eviction strategies
    for (const strategy of this.config.evictionStrategies) {
      const candidates = entries.filter(entry => 
        strategy.shouldEvict(entry, metrics) && !toEvict.includes(entry)
      );

      // Sort by priority (higher priority = more likely to evict)
      candidates.sort((a, b) => strategy.priority(b) - strategy.priority(a));

      toEvict.push(...candidates);

      // Check if we've reached target size
      const evictedSize = toEvict.reduce((sum, entry) => sum + entry.size, 0);
      if (metrics.estimatedSize - evictedSize <= this.config.targetSize) {
        break;
      }
    }

    // Perform evictions
    this.evictEntries(toEvict);

    if (this.config.enableMonitoring) {
      console.log(`[Cache] Cleanup completed: evicted ${toEvict.length} entries`);
    }
  }

  /**
   * Evict specific cache entries
   */
  private evictEntries(entries: CacheEntry[]): void {
    entries.forEach(entry => {
      try {
        this.cache.evict({ id: entry.key });
      } catch (error) {
        console.warn(`[Cache] Failed to evict entry ${entry.key}:`, error);
      }
    });

    // Garbage collect after evictions
    this.cache.gc();
  }

  /**
   * Warm cache with critical queries
   */
  async warmCache(client: ApolloClientLike): Promise<void> {
    if (!this.config.warming) return;

    const { criticalQueries, maxConcurrent, timeout, retryFailed } = this.config.warming;

    // Sort queries by priority
    const sortedQueries = [...criticalQueries].sort((a, b) => b.priority - a.priority);

    // Process queries in batches
    for (let i = 0; i < sortedQueries.length; i += maxConcurrent) {
      const batch = sortedQueries.slice(i, i + maxConcurrent);
      
      const promises = batch.map(async ({ query, variables }) => {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Warming timeout')), timeout);
          });

          await Promise.race([
            client.query({ 
              query, 
              variables: variables || undefined, 
              fetchPolicy: 'cache-first' 
            }),
            timeoutPromise,
          ]);

          if (this.config.enableMonitoring) {
            console.log(`[Cache] Warmed query successfully`);
          }
        } catch (error) {
          if (retryFailed) {
            // Retry once
            try {
              await client.query({ 
                query, 
                variables: variables || undefined, 
                fetchPolicy: 'network-only' 
              });
            } catch (retryError) {
              console.warn(`[Cache] Failed to warm query after retry:`, retryError);
            }
          } else {
            console.warn(`[Cache] Failed to warm query:`, error);
          }
        }
      });

      await Promise.allSettled(promises);
    }
  }

  /**
   * Get cache optimization report
   */
  getOptimizationReport(): {
    metrics: CacheMetrics;
    recommendations: string[];
    performance: {
      hitRate: number;
      memoryEfficiency: number;
      evictionRate: number;
    };
  } {
    const metrics = this.monitor.getMetrics();
    const recommendations: string[] = [];

    // Generate recommendations
    if (metrics.hitRate < 0.8) {
      recommendations.push('Consider warming more critical queries to improve hit rate');
    }

    if (metrics.memoryUsage > 0.9) {
      recommendations.push('Cache is near memory limit, consider more aggressive eviction');
    }

    if (metrics.evictions > 100) {
      recommendations.push('High eviction rate detected, consider increasing cache size');
    }

    const performance = {
      hitRate: metrics.hitRate,
      memoryEfficiency: 1 - metrics.memoryUsage,
      evictionRate: metrics.evictions / metrics.totalObjects || 0,
    };

    return {
      metrics,
      recommendations,
      performance,
    };
  }

  /**
   * Manually trigger cache optimization
   */
  optimize(): void {
    this.performCleanup();
  }

  /**
   * Stop the optimizer
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =============================================================================
// Cache Monitor (Simplified version for the optimizer)
// =============================================================================

class CacheMonitor {
  private cache: InMemoryCache;
  private metrics: CacheMetrics = {
    totalObjects: 0,
    estimatedSize: 0,
    hitRate: 0.8,
    missRate: 0.2,
    evictions: 0,
    memoryUsage: 0.5,
    lastCleanup: new Date(),
  };

  constructor(cache: InMemoryCache) {
    this.cache = cache;
  }

  getMetrics(): CacheMetrics {
    // In a real implementation, this would analyze the actual cache
    return { ...this.metrics };
  }

  getCacheEntries(): CacheEntry[] {
    // In a real implementation, this would extract actual cache entries
    return [];
  }
}

// =============================================================================
// Cache Warming Utilities
// =============================================================================

/**
 * Creates a cache warming configuration for common queries
 */
export function createCacheWarmingConfig(
  queries: Array<{ query: DocumentNode; variables?: Record<string, unknown>; priority?: number }>
): CacheWarmingConfig {
  return {
    criticalQueries: queries.map(q => ({
      ...q,
      priority: q.priority || 1,
    })),
    maxConcurrent: 3,
    timeout: 10000,
    retryFailed: true,
  };
}

/**
 * Preload critical data for faster user experience
 */
export async function preloadCriticalData(
  client: ApolloClientLike,
  queries: DocumentNode[],
  options: { timeout?: number; maxConcurrent?: number } = {}
): Promise<void> {
  const { timeout = 5000, maxConcurrent = 5 } = options;

  const promises = queries.slice(0, maxConcurrent).map(async (query) => {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Preload timeout')), timeout);
      });

      await Promise.race([
        client.query({ 
          query, 
          variables: variables || undefined, 
          fetchPolicy: 'cache-first' 
        }),
        timeoutPromise,
      ]);
    } catch (error) {
      console.warn('[Cache] Failed to preload query:', error);
    }
  });

  await Promise.allSettled(promises);
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for monitoring cache performance
 */
export function useCacheMetrics(optimizer: CacheOptimizer): {
  metrics: CacheMetrics;
  report: ReturnType<CacheOptimizer['getOptimizationReport']>;
  optimize: () => void;
} {
  const [metrics, setMetrics] = React.useState<CacheMetrics>(optimizer.getOptimizationReport().metrics);
  const [report, setReport] = React.useState(optimizer.getOptimizationReport());

  React.useEffect(() => {
    const interval = setInterval(() => {
      const newReport = optimizer.getOptimizationReport();
      setMetrics(newReport.metrics);
      setReport(newReport);
    }, 5000);

    return () => clearInterval(interval);
  }, [optimizer]);

  const optimize = React.useCallback(() => {
    optimizer.optimize();
    const newReport = optimizer.getOptimizationReport();
    setMetrics(newReport.metrics);
    setReport(newReport);
  }, [optimizer]);

  return { metrics, report, optimize };
}

// =============================================================================
// Exports
// =============================================================================

export const CacheOptimizationUtils = {
  CacheOptimizer,
  LRUEvictionStrategy,
  LFUEvictionStrategy,
  SizeBasedEvictionStrategy,
  TTLEvictionStrategy,
  createCacheWarmingConfig,
  preloadCriticalData,
  useCacheMetrics,
};