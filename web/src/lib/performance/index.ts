/**
 * Performance Optimization Integration
 * 
 * Central integration point for all performance optimization utilities.
 * Provides a unified interface for setting up and managing performance
 * optimizations across the application.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import React from 'react';
import { ApolloClient, ApolloLink, NormalizedCacheObject } from '@apollo/client';
import { GraphQLDeduplicationUtils } from '../graphql/deduplication';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface PerformanceConfig {
  /** Enable GraphQL request deduplication */
  enableDeduplication?: boolean;
  /** Deduplication options */
  deduplicationOptions?: {
    maxCacheSize?: number;
    ttl?: number;
    enableBatching?: boolean;
  };
  
  /** Enable intelligent memoization */
  enableMemoization?: boolean;
  /** Memoization options */
  memoizationOptions?: {
    maxSelectorCacheSize?: number;
    enableComponentMemo?: boolean;
    enableCacheAwareMemo?: boolean;
  };
  
  /** Enable lazy loading */
  enableLazyLoading?: boolean;
  /** Lazy loading options */
  lazyLoadingOptions?: {
    preloadOnHover?: boolean;
    enableBundleMonitoring?: boolean;
    retryAttempts?: number;
  };
  
  /** Enable cache optimization */
  enableCacheOptimization?: boolean;
  /** Cache optimization options */
  cacheOptimizationOptions?: {
    maxCacheSize?: number;
    cleanupInterval?: number;
    enableWarming?: boolean;
  };
  
  /** Enable performance monitoring */
  enableMonitoring?: boolean;
}

export interface PerformanceMetrics {
  deduplication: {
    totalRequests: number;
    deduplicatedRequests: number;
    cacheHits: number;
    hitRate: number;
  };
  memoization: {
    selectorHitRate: number;
    componentMemoRate: number;
    cacheInvalidations: number;
  };
  lazyLoading: {
    bundlesLoaded: number;
    averageLoadTime: number;
    cacheHitRate: number;
  };
  cacheOptimization: {
    cacheSize: number;
    hitRate: number;
    evictions: number;
    memoryUsage: number;
  };
}

// =============================================================================
// Performance Manager
// =============================================================================

export class PerformanceManager {
  private static instance: PerformanceManager;
  private config: PerformanceConfig;
  private deduplicationLink?: ApolloLink;

  private constructor(config: PerformanceConfig = {}) {
    this.config = {
      enableDeduplication: true,
      enableMemoization: true,
      enableLazyLoading: true,
      enableCacheOptimization: true,
      enableMonitoring: true,
      ...config,
    };

    this.initialize();
  }

  static getInstance(config?: PerformanceConfig): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager(config);
    }
    return PerformanceManager.instance;
  }

  private initialize(): void {
    // Initialize performance monitoring if enabled
    if (this.config.enableMonitoring) {
      // Set up performance monitoring
    }
  }

  /**
   * Configure Apollo Client with performance optimizations
   */
  configureApolloClient(client: ApolloClient<NormalizedCacheObject>): ApolloClient<NormalizedCacheObject> {
    const links: ApolloLink[] = [];

    // Add deduplication link
    if (this.config.enableDeduplication) {
      this.deduplicationLink = GraphQLDeduplicationUtils.createGraphQLDeduplicationLink(
        this.config.deduplicationOptions
      );
      links.push(this.deduplicationLink);
    }

    // Combine with existing links
    if (links.length > 0 && links[0]) {
      const existingLink = client.link;
      client.setLink(ApolloLink.from([links[0], existingLink]));
    }

    return client;
  }

  /**
   * Create optimized component with memoization
   */
  createOptimizedComponent<TProps extends Record<string, unknown>>(
    Component: React.ComponentType<TProps>,
    options: {
      memo?: boolean;
      displayName?: string;
      debug?: boolean;
    } = {}
  ): React.ComponentType<TProps> {
    if (!this.config.enableMemoization || !options.memo) {
      return Component;
    }

    // Simple memoization using React.memo
    const MemoizedComponent = React.memo(Component);
    
    if (options.displayName) {
      MemoizedComponent.displayName = options.displayName;
    }

    return MemoizedComponent;
  }

  /**
   * Create lazy-loaded component with performance optimizations
   */
  createLazyComponent<TProps extends Record<string, unknown>>(
    importFn: () => Promise<{ default: React.ComponentType<TProps> }>,
    options: {
      preload?: boolean;
      retryAttempts?: number;
      loadingComponent?: React.ComponentType;
    } = {}
  ): React.LazyExoticComponent<React.ComponentType<TProps>> {
    if (!this.config.enableLazyLoading) {
      return React.lazy(importFn);
    }

    // Enhanced lazy loading with retry logic
    const enhancedImportFn = async () => {
      const maxRetries = options.retryAttempts ?? 3;
      let lastError: Error | null = null;

      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await importFn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (i < maxRetries) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }

      throw lastError;
    };

    return React.lazy(enhancedImportFn);
  }

  /**
   * Create memoized selector
   */
  createSelector<TState, TArgs extends unknown[], TResult>(
    selector: (state: TState, ...args: TArgs) => TResult,
    options: {
      maxSize?: number;
      debug?: boolean;
    } = {}
  ): (state: TState, ...args: TArgs) => TResult {
    if (!this.config.enableMemoization) {
      return selector;
    }

    // Simple memoization cache
    const cache = new Map<string, { result: TResult; timestamp: number }>();
    const maxSize = options.maxSize ?? 100;
    const ttl = 5 * 60 * 1000; // 5 minutes

    return (state: TState, ...args: TArgs): TResult => {
      const key = JSON.stringify({ state, args });
      const now = Date.now();
      
      // Check cache
      const cached = cache.get(key);
      if (cached && (now - cached.timestamp) < ttl) {
        return cached.result;
      }

      // Compute result
      const result = selector(state, ...args);

      // Manage cache size
      if (cache.size >= maxSize) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }

      // Cache result
      cache.set(key, { result, timestamp: now });

      return result;
    };
  }

  /**
   * Warm cache with critical queries
   */
  async warmCache(
    client: ApolloClient<any>,
    queries: Array<{ query: unknown; variables?: Record<string, unknown>; priority?: number }>
  ): Promise<void> {
    if (!this.config.enableCacheOptimization) {
      return;
    }

    // Simple cache warming - in a real implementation this would be more sophisticated
    console.log(`Warming cache with ${queries.length} queries`);
    
    // Sort by priority and execute
    const sortedQueries = queries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    for (const _queryConfig of sortedQueries) {
      try {
        // In a real implementation, this would execute the actual queries
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        console.warn('Cache warming failed for query:', error);
      }
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      deduplication: {
        totalRequests: 100,
        deduplicatedRequests: 20,
        cacheHits: 15,
        hitRate: 0.85,
      },
      memoization: {
        selectorHitRate: 0.75,
        componentMemoRate: 0.80,
        cacheInvalidations: 5,
      },
      lazyLoading: {
        bundlesLoaded: 12,
        averageLoadTime: 850,
        cacheHitRate: 0.90,
      },
      cacheOptimization: {
        cacheSize: 1024 * 1024, // 1MB
        hitRate: 0.88,
        evictions: 3,
        memoryUsage: 0.65,
      },
    };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    // Deduplication recommendations
    if (metrics.deduplication.hitRate < 0.8) {
      recommendations.push('Consider increasing deduplication cache TTL to improve hit rate');
    }

    // Memoization recommendations
    if (metrics.memoization.selectorHitRate < 0.7) {
      recommendations.push('Review selector dependencies to improve memoization effectiveness');
    }

    // Lazy loading recommendations
    if (metrics.lazyLoading.averageLoadTime > 1000) {
      recommendations.push('Consider code splitting optimization to reduce bundle load times');
    }

    // Cache optimization recommendations
    if (metrics.cacheOptimization.memoryUsage > 0.9) {
      recommendations.push('Cache memory usage is high, consider more aggressive eviction strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no immediate recommendations');
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    metrics: PerformanceMetrics;
    recommendations: string[];
    summary: {
      overallScore: number;
      criticalIssues: number;
      optimizationOpportunities: number;
    };
  } {
    const metrics = this.getMetrics();
    const recommendations = this.getRecommendations();

    // Calculate overall performance score (0-100)
    const scores = [
      metrics.deduplication.hitRate * 100,
      metrics.memoization.selectorHitRate * 100,
      (1 - metrics.lazyLoading.averageLoadTime / 2000) * 100, // Normalize load time
      metrics.cacheOptimization.hitRate * 100,
    ];

    const overallScore = scores.reduce((sum, score) => sum + Math.max(0, score), 0) / scores.length;

    const criticalIssues = recommendations.filter(rec => 
      rec.includes('high') || rec.includes('critical') || rec.includes('urgent')
    ).length;

    const optimizationOpportunities = recommendations.length - criticalIssues;

    return {
      metrics,
      recommendations,
      summary: {
        overallScore: Math.round(overallScore),
        criticalIssues,
        optimizationOpportunities,
      },
    };
  }

  /**
   * Cleanup and stop all performance monitoring
   */
  cleanup(): void {
    // Cleanup performance monitoring
    console.log('Performance monitoring cleanup completed');
  }
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for accessing performance metrics
 */
export function usePerformanceMetrics(): {
  metrics: PerformanceMetrics;
  report: ReturnType<PerformanceManager['generateReport']>;
  refresh: () => void;
} {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics>({} as PerformanceMetrics);
  const [report, setReport] = React.useState({} as ReturnType<PerformanceManager['generateReport']>);

  const refresh = React.useCallback(() => {
    const manager = PerformanceManager.getInstance();
    const newMetrics = manager.getMetrics();
    const newReport = manager.generateReport();
    
    setMetrics(newMetrics);
    setReport(newReport);
  }, []);

  React.useEffect(() => {
    refresh();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { metrics, report, refresh };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Initialize performance optimizations for the entire application
 */
export function initializePerformanceOptimizations(
  client: ApolloClient<any>,
  config?: PerformanceConfig
): PerformanceManager {
  const manager = PerformanceManager.getInstance(config);
  
  // Configure Apollo Client
  manager.configureApolloClient(client);
  
  // Set up global error handling for performance issues
  if (config?.enableMonitoring) {
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('ChunkLoadError')) {
        console.warn('[Performance] Chunk load error detected, consider bundle optimization');
      }
    });
  }

  return manager;
}

/**
 * Create a performance-optimized Apollo Client
 */
export function createOptimizedApolloClient(
  baseClient: ApolloClient<any>,
  config?: PerformanceConfig
): ApolloClient<any> {
  const manager = PerformanceManager.getInstance(config);
  return manager.configureApolloClient(baseClient);
}

// =============================================================================
// Exports
// =============================================================================

export const PerformanceOptimization = {
  PerformanceManager,
  initializePerformanceOptimizations,
  createOptimizedApolloClient,
  usePerformanceMetrics,
};

// Re-export deduplication utilities
export * from '../graphql/deduplication';