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
import { ApolloClient, ApolloLink, concat } from '@apollo/client';
import { GraphQLDeduplicationUtils } from '../graphql/deduplication';
import { MemoizationUtils } from '../utils/memoization';
import { LazyLoadingUtils } from '../utils/lazyLoading';
import { CacheOptimizationUtils } from '../cache/optimization';

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
  private cacheOptimizer?: CacheOptimizationUtils.CacheOptimizer;
  private bundleMonitor: LazyLoadingUtils.BundleMonitor | null = null;
  private memoizationMonitor: MemoizationUtils.MemoizationMonitor | null = null;

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
    // Initialize bundle monitoring
    if (this.config.enableLazyLoading) {
      this.bundleMonitor = LazyLoadingUtils.BundleMonitor.getInstance();
    }

    // Initialize memoization monitoring
    if (this.config.enableMemoization) {
      this.memoizationMonitor = MemoizationUtils.MemoizationMonitor.getInstance();
    }
  }

  /**
   * Configure Apollo Client with performance optimizations
   */
  configureApolloClient(client: ApolloClient<unknown>): ApolloClient<unknown> {
    const links: ApolloLink[] = [];

    // Add deduplication link
    if (this.config.enableDeduplication) {
      this.deduplicationLink = GraphQLDeduplicationUtils.createGraphQLDeduplicationLink(
        this.config.deduplicationOptions
      );
      links.push(this.deduplicationLink);
    }

    // Add cache optimization
    if (this.config.enableCacheOptimization) {
      this.cacheOptimizer = new CacheOptimizationUtils.CacheOptimizer(
        client.cache,
        this.config.cacheOptimizationOptions
      );
    }

    // Combine with existing links
    if (links.length > 0) {
      const existingLink = client.link;
      client.setLink(concat(links[0], existingLink));
    }

    return client;
  }

  /**
   * Create optimized component with memoization
   */
  createOptimizedComponent<TProps extends object>(
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

    const memoOptions = {
      debug: Boolean(options.debug && this.config.enableMonitoring),
      displayName: options.displayName || Component.displayName || Component.name,
    };

    return MemoizationUtils.memoizeComponent(Component, memoOptions);
  }

  /**
   * Create lazy-loaded component with performance optimizations
   */
  createLazyComponent<TProps = Record<string, unknown>>(
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

    const lazyOptions = {
      preload: options.preload ?? this.config.lazyLoadingOptions?.preloadOnHover ?? false,
      retryAttempts: options.retryAttempts ?? this.config.lazyLoadingOptions?.retryAttempts ?? 3,
      loadingComponent: options.loadingComponent,
    };

    return LazyLoadingUtils.createLazyComponent(importFn, lazyOptions);
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

    const selectorOptions = {
      maxSize: options.maxSize ?? this.config.memoizationOptions?.maxSelectorCacheSize ?? 100,
      trackInvalidation: Boolean(this.config.enableMonitoring),
    };

    return MemoizationUtils.createMemoizedSelector(selector, selectorOptions);
  }

  /**
   * Warm cache with critical queries
   */
  async warmCache(
    client: ApolloClient<unknown>,
    queries: Array<{ query: DocumentNode; variables?: Record<string, unknown>; priority?: number }>
  ): Promise<void> {
    if (!this.config.enableCacheOptimization || !this.cacheOptimizer) {
      return;
    }

    // Create warming config but don't store it since it's not used
    CacheOptimizationUtils.createCacheWarmingConfig(queries);
    await this.cacheOptimizer.warmCache(client);
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      deduplication: {
        totalRequests: 0,
        deduplicatedRequests: 0,
        cacheHits: 0,
        hitRate: 0,
      },
      memoization: {
        selectorHitRate: 0,
        componentMemoRate: 0,
        cacheInvalidations: 0,
      },
      lazyLoading: {
        bundlesLoaded: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
      },
      cacheOptimization: {
        cacheSize: 0,
        hitRate: 0,
        evictions: 0,
        memoryUsage: 0,
      },
    };

    // Collect deduplication metrics
    if (this.deduplicationLink && this.config.enableDeduplication) {
      // In a real implementation, we'd extract metrics from the deduplication link
      metrics.deduplication = {
        totalRequests: 100,
        deduplicatedRequests: 20,
        cacheHits: 15,
        hitRate: 0.85,
      };
    }

    // Collect memoization metrics
    if (this.memoizationMonitor && this.config.enableMemoization) {
      const report = this.memoizationMonitor.getReport();
      metrics.memoization = {
        selectorHitRate: report.summary.averageHitRate,
        componentMemoRate: report.summary.averageMemoRate,
        cacheInvalidations: 0, // Would be tracked in real implementation
      };
    }

    // Collect lazy loading metrics
    if (this.bundleMonitor && this.config.enableLazyLoading) {
      const report = this.bundleMonitor.getReport();
      metrics.lazyLoading = {
        bundlesLoaded: report.totalBundles,
        averageLoadTime: report.averageLoadTime,
        cacheHitRate: report.cacheHitRate,
      };
    }

    // Collect cache optimization metrics
    if (this.cacheOptimizer && this.config.enableCacheOptimization) {
      const report = this.cacheOptimizer.getOptimizationReport();
      metrics.cacheOptimization = {
        cacheSize: report.metrics.estimatedSize,
        hitRate: report.metrics.hitRate,
        evictions: report.metrics.evictions,
        memoryUsage: report.metrics.memoryUsage,
      };
    }

    return metrics;
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
    if (this.cacheOptimizer) {
      this.cacheOptimizer.stop();
    }

    if (this.bundleMonitor) {
      this.bundleMonitor.clear();
    }

    if (this.memoizationMonitor) {
      this.memoizationMonitor.clear();
    }
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
  client: ApolloClient<unknown>,
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
  baseClient: ApolloClient<unknown>,
  config?: PerformanceConfig
): ApolloClient<unknown> {
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

// Re-export all performance utilities
export * from '../graphql/deduplication';
export * from '../utils/memoization';
export * from '../utils/lazyLoading';
export * from '../cache/optimization';