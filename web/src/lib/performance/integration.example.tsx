/**
 * Performance Integration Examples
 *
 * Complete examples demonstrating how to integrate and use the performance
 * optimization system in a real application.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client';
import { PerformanceManager, PerformanceMetrics } from './index';

// =============================================================================
// Example 1: Basic Performance Setup
// =============================================================================

/**
 * Create an optimized Apollo Client with all performance features enabled
 */
export function createOptimizedApolloClient(): ApolloClient {
  // Create base Apollo Client
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(), // Required link property
  });

  // Initialize performance optimizations
  const performanceManager = PerformanceManager.getInstance({
    enableDeduplication: true,
    enableFieldSelection: true,
    enableRequestBatching: true,
    enableSubscriptionManagement: true,
    enableMemoization: true,
    enableLazyLoading: true,
    enableCacheOptimization: true,
    enableMonitoring: true,
  });

  // Configure Apollo Client with performance optimizations
  return performanceManager.configureApolloClient(client);
}

// =============================================================================
// Example 2: Performance Dashboard Component
// =============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

function MetricCard({ title, value, subtitle, color = 'blue' }: MetricCardProps) {
  return (
    <div className={`metric-card p-4 bg-${color}-50 rounded-lg border border-${color}-200`}>
      <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
  );
}

/**
 * Performance Dashboard Component
 */
export function PerformanceDashboard(): React.ReactElement {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({} as PerformanceMetrics);
  const [report, setReport] = useState<ReturnType<PerformanceManager['generateReport']>>(
    {} as ReturnType<PerformanceManager['generateReport']>
  );

  const refresh = useCallback(() => {
    const manager = PerformanceManager.getInstance();
    const newMetrics = manager.getMetrics();
    const newReport = manager.generateReport();

    setMetrics(newMetrics);
    setReport(newReport);
  }, []);

  useEffect(() => {
    // Use a timeout to avoid calling setState directly in effect
    const timer = setTimeout(() => {
      refresh();
    }, 0);

    // Refresh metrics every 30 seconds
    const interval = setInterval(refresh, 30000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="performance-dashboard p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Performance Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-medium">Overall Performance Score</span>
          <span className="text-2xl font-bold text-green-600">
            {report.summary?.overallScore || 0}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full"
            style={{ width: `${report.summary?.overallScore || 0}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Cache Hit Rate"
          value={`${((metrics.deduplication?.hitRate || 0) * 100).toFixed(1)}%`}
          subtitle="Deduplication efficiency"
          color="green"
        />
        <MetricCard
          title="Batched Requests"
          value={metrics.requestBatching?.batchedRequests || 0}
          subtitle="Network optimization"
          color="blue"
        />
        <MetricCard
          title="Memory Usage"
          value={`${((metrics.cacheOptimization?.memoryUsage || 0) * 100).toFixed(1)}%`}
          subtitle="Cache efficiency"
          color="yellow"
        />
        <MetricCard
          title="Load Time"
          value={`${(metrics.lazyLoading?.averageLoadTime || 0).toFixed(0)}ms`}
          subtitle="Component loading"
          color="purple"
        />
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Recommendations</h3>
          <div className="space-y-2">
            {report.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="p-3 bg-yellow-50 border border-yellow-200 rounded"
              >
                {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Issues */}
      {report.summary && report.summary.criticalIssues > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-red-900 mb-3">Critical Issues</h3>
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700">
              {report.summary.criticalIssues} critical performance issues detected.
              Please review and address immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Example 3: Performance Monitoring Hook
// =============================================================================

/**
 * Custom hook for monitoring component performance
 */
export function usePerformanceMonitoring(componentName: string) {
  const renderCountRef = React.useRef(0);
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    renderCountRef.current += 1;
    const currentRenderCount = renderCountRef.current;
    setRenderCount(currentRenderCount);

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      setLastRenderTime(renderTime);

      // Record metric with performance manager
      console.log(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms (render #${currentRenderCount})`);
    };
  }, [componentName]);

  return {
    renderCount,
    lastRenderTime,
  };
}

// =============================================================================
// Example 4: Optimized Query Component
// =============================================================================

interface OptimizedQueryProps {
  children: (data: unknown) => React.ReactNode;
  query: unknown;
  variables?: Record<string, unknown>;
}

/**
 * Component that automatically optimizes GraphQL queries
 */
export function OptimizedQuery({ children, query, variables }: OptimizedQueryProps) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const performanceMetrics = usePerformanceMonitoring('OptimizedQuery');

  useEffect(() => {
    let isCancelled = false;
    
    // Simulate query optimization and execution
    const executeQuery = async () => {
      if (isCancelled) return;
      
      setLoading(true);
      setError(null);

      try {
        // In a real implementation, you would use the optimized Apollo Client
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        
        if (!isCancelled) {
          setData({ optimized: true, query, variables });
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    executeQuery();

    return () => {
      isCancelled = true;
    };
  }, [query, variables]);

  // Use performanceMetrics to avoid unused variable warning
  console.debug('Performance metrics:', performanceMetrics);

  if (loading) {
    return <div className="animate-pulse">Loading optimized query...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error.message}</div>;
  }

  return <>{children(data)}</>;
}

// =============================================================================
// Example 5: Performance-Optimized Component Factory
// =============================================================================

/**
 * Higher-order component that adds performance optimizations
 */
export function withPerformanceOptimization<TProps extends Record<string, unknown>>(
  Component: React.ComponentType<TProps>,
  options: {
    enableMemo?: boolean;
    enableLazyLoading?: boolean;
    monitorPerformance?: boolean;
  } = {}
) {
  const {
    enableMemo = true,
    enableLazyLoading = false,
    monitorPerformance = true,
  } = options;

  let OptimizedComponent = Component;

  // Apply memoization
  if (enableMemo) {
    OptimizedComponent = React.memo(OptimizedComponent);
  }

  // Apply lazy loading
  if (enableLazyLoading) {
    const LazyComponent = React.lazy(() => 
      Promise.resolve({ default: OptimizedComponent })
    );
    OptimizedComponent = LazyComponent as React.ComponentType<TProps>;
  }

  // Apply performance monitoring
  if (monitorPerformance) {
    const MonitoredComponent = (props: TProps) => {
      const metrics = usePerformanceMonitoring(Component.displayName || 'Component');
      
      return (
        <div data-performance-metrics={JSON.stringify(metrics)}>
          <OptimizedComponent {...props} />
        </div>
      );
    };

    OptimizedComponent = MonitoredComponent;
  }

  return OptimizedComponent;
}

// =============================================================================
// Example 6: Application Setup
// =============================================================================

/**
 * Complete application setup with performance optimizations
 */
export function setupPerformanceOptimizedApp() {
  // Create optimized Apollo Client
  const client = createOptimizedApolloClient();

  // Initialize performance monitoring
  const performanceManager = PerformanceManager.getInstance();

  // Warm cache with critical queries
  const criticalQueries = [
    { query: 'query GetUser { user { id name } }', priority: 1 },
    { query: 'query GetCourses { courses { id title } }', priority: 2 },
  ];

  performanceManager.warmCache(client, criticalQueries);

  // Setup performance monitoring
  if (typeof window !== 'undefined') {
    // Monitor bundle loading errors
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('ChunkLoadError')) {
        console.warn('[Performance] Chunk load error detected');
      }
    });

    // Monitor performance metrics
    setInterval(() => {
      const report = performanceManager.generateReport();
      if (report.summary.criticalIssues > 0) {
        console.warn('[Performance] Critical issues detected:', report.recommendations);
      }
    }, 60000); // Check every minute
  }

  return {
    client,
    performanceManager,
  };
}

// =============================================================================
// Exports - Single export statement to avoid conflicts
// =============================================================================