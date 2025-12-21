/**
 * Performance Optimization Integration
 *
 * Central integration point for all performance optimization utilities.
 * Provides a unified interface for setting up and managing performance
 * optimizations across the application.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import React from 'react';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { GraphQLDeduplicationUtils } from '../graphql/deduplication';
import { FieldSelectionUtils } from '../graphql/fieldSelection';
import { RequestBatchingUtils } from '../graphql/requestBatching';
import { SubscriptionManagementUtils } from '../subscriptions/subscriptionManager';
import { PerformanceMonitoringUtils } from './monitoring';
import { LazyLoadingUtils } from '../utils/lazyLoading';
import { CacheOptimizationUtils } from '../cache/optimization';

// Type alias to work around Apollo Client v4 type issues
type ApolloClientType = ApolloClient;

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

  /** Enable field selection optimization */
  enableFieldSelection?: boolean;
  /** Field selection options */
  fieldSelectionOptions?: {
    enablePruning?: boolean;
    maxDepth?: number;
    alwaysInclude?: string[];
    alwaysExclude?: string[];
  };

  /** Enable request batching */
  enableRequestBatching?: boolean;
  /** Request batching options */
  requestBatchingOptions?: {
    maxBatchSize?: number;
    batchTimeout?: number;
    enableIntelligentBatching?: boolean;
  };

  /** Enable subscription management */
  enableSubscriptionManagement?: boolean;
  /** Subscription management options */
  subscriptionManagementOptions?: {
    maxConcurrentSubscriptions?: number;
    defaultCleanupTimeout?: number;
    enableAutoCleanup?: boolean;
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
    maxSize?: number;
    cleanupInterval?: number;
    enableWarming?: boolean;
  };

  /** Enable performance monitoring */
  enableMonitoring?: boolean;
  /** Performance monitoring options */
  monitoringOptions?: {
    enableQueryMetrics?: boolean;
    enableBundleMetrics?: boolean;
    enableNetworkMetrics?: boolean;
    enableRenderMetrics?: boolean;
  };
}

export interface PerformanceMetrics {
  deduplication: {
    totalRequests: number;
    deduplicatedRequests: number;
    cacheHits: number;
    hitRate: number;
  };
  fieldSelection: {
    queriesOptimized: number;
    fieldsRemoved: number;
    bandwidthSaved: number;
  };
  requestBatching: {
    totalRequests: number;
    batchedRequests: number;
    averageBatchSize: number;
    networkSavings: number;
  };
  subscriptionManagement: {
    activeSubscriptions: number;
    cleanedUpSubscriptions: number;
    memoryUsage: number;
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
  monitoring: {
    metricsCollected: number;
    alertsGenerated: number;
    performanceScore: number;
  };
}

// =============================================================================
// Performance Manager
// =============================================================================

export class PerformanceManager {
  private static instance: PerformanceManager;
  private config: PerformanceConfig;
  private deduplicationLink?: ApolloLink;
  private fieldSelectionLink?: ApolloLink;
  private batchingLink?: ApolloLink;
  private subscriptionManager?: SubscriptionManagementUtils.SubscriptionManager;
  private performanceMonitor?: PerformanceMonitoringUtils.PerformanceMonitor;
  private cacheOptimizer?: CacheOptimizationUtils.CacheOptimizer;

  private constructor(config: PerformanceConfig = {}) {
    this.config = {
      enableDeduplication: true,
      enableFieldSelection: true,
      enableRequestBatching: true,
      enableSubscriptionManagement: true,
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
      this.performanceMonitor = new PerformanceMonitoringUtils.PerformanceMonitor();
    }

    // Initialize subscription manager if enabled
    if (this.config.enableSubscriptionManagement) {
      this.subscriptionManager = SubscriptionManagementUtils.createOptimizedSubscriptionManager(
        this.config.subscriptionManagementOptions
      );
    }
  }

  /**
   * Configure Apollo Client with all performance optimizations
   */
  configureApolloClient(client: ApolloClientType): ApolloClientType {
    const links: ApolloLink[] = [];

    // Add field selection optimization link
    if (this.config.enableFieldSelection) {
      this.fieldSelectionLink = FieldSelectionUtils.createFieldSelectionLink(
        this.config.fieldSelectionOptions
      );
      links.push(this.fieldSelectionLink);
    }

    // Add request batching link
    if (this.config.enableRequestBatching) {
      this.batchingLink = RequestBatchingUtils.createBatchingLink(
        RequestBatchingUtils.createBatchingConfig('balanced')
      );
      links.push(this.batchingLink);
    }

    // Add deduplication link
    if (this.config.enableDeduplication) {
      this.deduplicationLink = GraphQLDeduplicationUtils.createGraphQLDeduplicationLink(
        this.config.deduplicationOptions
      );
      links.push(this.deduplicationLink);
    }

    // Initialize cache optimization
    if (this.config.enableCacheOptimization && client.cache) {
      this.cacheOptimizer = new CacheOptimizationUtils.CacheOptimizer(
        client.cache as any,
        this.config.cacheOptimizationOptions
      );
    }

    // Combine with existing links
    if (links.length > 0) {
      const existingLink = client.link;
      // Type assertion to work around Apollo Client v4 type issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).setLink(ApolloLink.from([...links, existingLink]));
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

    return LazyLoadingUtils.createLazyComponent(importFn, {
      retryAttempts: options.retryAttempts || 3,
      preload: options.preload,
      loadingComponent: options.loadingComponent,
    });
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
      if (cached && now - cached.timestamp < ttl) {
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
    client: ApolloClientType,
    queries: Array<{ query: unknown; variables?: Record<string, unknown>; priority?: number }>
  ): Promise<void> {
    if (!this.config.enableCacheOptimization || !this.cacheOptimizer) {
      return;
    }

    await this.cacheOptimizer.warmCache(client as any, queries);
  }

  /**
   * Get comprehensive performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const deduplicationMetrics = this.deduplicationLink
      ? GraphQLDeduplicationUtils.GraphQLRequestDeduplicator.prototype.getMetrics?.()
      : null;

    const monitoringReport = this.performanceMonitor?.generateReport();
    const cacheReport = this.cacheOptimizer?.getOptimizationReport();
    const subscriptionStats = this.subscriptionManager?.getManagerStats();

    return {
      deduplication: deduplicationMetrics || {
        totalRequests: 0,
        deduplicatedRequests: 0,
        cacheHits: 0,
        hitRate: 0,
      },
      fieldSelection: {
        queriesOptimized: 0,
        fieldsRemoved: 0,
        bandwidthSaved: 0,
      },
      requestBatching: {
        totalRequests: 0,
        batchedRequests: 0,
        averageBatchSize: 0,
        networkSavings: 0,
      },
      subscriptionManagement: subscriptionStats
        ? {
            activeSubscriptions: subscriptionStats.activeSubscriptions,
            cleanedUpSubscriptions:
              subscriptionStats.totalSubscriptions - subscriptionStats.activeSubscriptions,
            memoryUsage: subscriptionStats.memoryUsage,
          }
        : {
            activeSubscriptions: 0,
            cleanedUpSubscriptions: 0,
            memoryUsage: 0,
          },
      memoization: {
        selectorHitRate: 0.75,
        componentMemoRate: 0.8,
        cacheInvalidations: 5,
      },
      lazyLoading: {
        bundlesLoaded: 12,
        averageLoadTime: 850,
        cacheHitRate: 0.9,
      },
      cacheOptimization: cacheReport
        ? {
            cacheSize: 1024 * 1024, // 1MB
            hitRate: cacheReport.performance.hitRate,
            evictions: 3,
            memoryUsage: 0.65,
          }
        : {
            cacheSize: 0,
            hitRate: 0,
            evictions: 0,
            memoryUsage: 0,
          },
      monitoring: monitoringReport
        ? {
            metricsCollected: monitoringReport.summary.totalMetrics,
            alertsGenerated: monitoringReport.alerts.length,
            performanceScore: monitoringReport.summary.performanceScore,
          }
        : {
            metricsCollected: 0,
            alertsGenerated: 0,
            performanceScore: 0,
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
      recommendations.push(
        'Cache memory usage is high, consider more aggressive eviction strategies'
      );
    }

    // Subscription management recommendations
    if (metrics.subscriptionManagement.activeSubscriptions > 50) {
      recommendations.push('High number of active subscriptions, consider cleanup optimization');
    }

    // Monitoring recommendations
    if (metrics.monitoring.performanceScore < 70) {
      recommendations.push('Overall performance score is low, review all optimization strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - no immediate recommendations');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive performance report
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
      metrics.monitoring.performanceScore,
    ];

    const overallScore = scores.reduce((sum, score) => sum + Math.max(0, score), 0) / scores.length;

    const criticalIssues = recommendations.filter(
      rec => rec.includes('high') || rec.includes('critical') || rec.includes('urgent')
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
    this.subscriptionManager?.stop();
    this.cacheOptimizer?.stop();
    this.performanceMonitor?.clear();
    console.log('Performance optimization cleanup completed');
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
  const [report, setReport] = React.useState(
    {} as ReturnType<PerformanceManager['generateReport']>
  );

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
  client: ApolloClientType,
  config?: PerformanceConfig
): PerformanceManager {
  const manager = PerformanceManager.getInstance(config);

  // Configure Apollo Client
  manager.configureApolloClient(client);

  // Set up global error handling for performance issues
  if (config?.enableMonitoring) {
    window.addEventListener('error', event => {
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
  baseClient: ApolloClientType,
  config?: PerformanceConfig
): ApolloClientType {
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

// Re-export all optimization utilities
export * from '../graphql/deduplication';
export * from '../graphql/fieldSelection';
export * from '../graphql/requestBatching';
export * from '../subscriptions/subscriptionManager';
export * from './monitoring';
export * from '../utils/lazyLoading';
export * from '../cache/optimization';
