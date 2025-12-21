/**
 * Performance Optimization Integration Example
 * 
 * Demonstrates how to integrate all performance optimization features
 * in a real application setup with comprehensive monitoring and analytics.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import React from 'react';
import { DocumentNode } from 'graphql';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { 
  PerformanceManager, 
  initializePerformanceOptimizations,
  PerformanceMonitoringUtils,
  FieldSelectionUtils,
  RequestBatchingUtils,
  SubscriptionManagementUtils,
} from './index';

// =============================================================================
// Complete Apollo Client Setup with Performance Optimizations
// =============================================================================

/**
 * Create a fully optimized Apollo Client with all performance features enabled
 */
export function createOptimizedApolloClient(): ApolloClient<unknown> {
  // Create HTTP link
  const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  });

  // Create authentication link
  const authLink = setContext((_, { headers }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    };
  });

  // Create performance monitoring
  const performanceMonitor = new PerformanceMonitoringUtils.PerformanceMonitor({
    query: {
      maxResponseTime: 2000,
      maxResponseSize: 1024 * 1024, // 1MB
      minCacheHitRate: 0.8,
    },
    bundle: {
      maxLoadTime: 3000,
      maxBundleSize: 5 * 1024 * 1024, // 5MB
      minCompressionRatio: 0.7,
    },
    network: {
      maxLatency: 1000,
      maxTTFB: 500,
      minSuccessRate: 0.95,
    },
  });

  // Create error link with performance monitoring
  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        console.error(`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`);
        
        // Record error metrics
        performanceMonitor.recordMetric({
          name: 'graphql_error',
          value: 1,
          unit: 'count',
          category: 'query',
          metadata: { message, path, operation: operation.operationName },
        });
      });
    }

    if (networkError) {
      console.error(`Network error: ${networkError}`);
      
      // Record network error metrics
      performanceMonitor.recordNetworkPerformance(
        operation.getContext().uri || 'unknown',
        'POST',
        'status' in networkError ? (networkError as any).status : 0,
        JSON.stringify(operation.variables || {}).length,
        0,
        Date.now(),
        Date.now()
      );
    }
  });

  // Create field selection link
  const fieldSelectionLink = FieldSelectionUtils.createFieldSelectionLink({
    enablePruning: true,
    maxDepth: 10,
    alwaysInclude: ['id', '__typename'],
    enableComplexityAnalysis: true,
    maxComplexity: 1000,
  });

  // Create request batching link
  const batchingLink = RequestBatchingUtils.createBatchingLink(
    RequestBatchingUtils.createBatchingConfig('balanced')
  );

  // Create cache with optimized type policies
  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Implement pagination for common queries
          courses: {
            keyArgs: ['filter'],
            merge(existing = { edges: [] }, incoming) {
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
          users: {
            keyArgs: ['filter'],
            merge(existing = { edges: [] }, incoming) {
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
      // Normalize entities for better caching
      User: {
        fields: {
          courses: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
      Course: {
        fields: {
          modules: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  });

  // Create Apollo Client
  const client = new ApolloClient({
    link: fieldSelectionLink
      .concat(batchingLink)
      .concat(errorLink)
      .concat(authLink)
      .concat(httpLink),
    cache,
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
        notifyOnNetworkStatusChange: true,
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });

  // Initialize performance optimizations
  const performanceManager = initializePerformanceOptimizations(client, {
    enableDeduplication: true,
    enableFieldSelection: true,
    enableRequestBatching: true,
    enableSubscriptionManagement: true,
    enableMemoization: true,
    enableLazyLoading: true,
    enableCacheOptimization: true,
    enableMonitoring: true,
    deduplicationOptions: {
      maxCacheSize: 200,
      ttl: 30000,
      enableBatching: true,
    },
    fieldSelectionOptions: {
      enablePruning: true,
      maxDepth: 10,
      alwaysInclude: ['id', '__typename'],
    },
    requestBatchingOptions: {
      maxBatchSize: 10,
      batchTimeout: 100,
      enableIntelligentBatching: true,
    },
    subscriptionManagementOptions: {
      maxConcurrentSubscriptions: 25,
      defaultCleanupTimeout: 60000,
      enableAutoCleanup: true,
    },
    monitoringOptions: {
      enableQueryMetrics: true,
      enableBundleMetrics: true,
      enableNetworkMetrics: true,
      enableRenderMetrics: true,
    },
  });

  // Set up performance monitoring for queries
  const originalQuery = client.query.bind(client);
  client.query = async (options) => {
    const startTime = performance.now();
    
    try {
      const result = await originalQuery(options);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      const responseSize = JSON.stringify(result.data || {}).length;
      
      // Record query performance
      performanceMonitor.recordQueryPerformance(
        options.query,
        options.variables || {},
        responseTime,
        responseSize,
        result.loading === false // Rough cache hit detection
      );
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Record failed query
      performanceMonitor.recordMetric({
        name: 'query_error',
        value: responseTime,
        unit: 'ms',
        category: 'query',
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          query: options.query.loc?.source.body || 'unknown'
        },
      });
      
      throw error;
    }
  };

  return client;
}

// =============================================================================
// Performance Dashboard Component Example
// =============================================================================

/**
 * Example React component for displaying performance metrics
 */
export function PerformanceDashboard(): JSX.Element {
  const { metrics, report, refresh } = PerformanceManager.getInstance().usePerformanceMetrics();

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
          title="Query Deduplication"
          value={`${(metrics.deduplication?.hitRate * 100 || 0).toFixed(1)}%`}
          subtitle="Hit Rate"
          color="blue"
        />
        <MetricCard
          title="Field Selection"
          value={metrics.fieldSelection?.fieldsRemoved || 0}
          subtitle="Fields Optimized"
          color="green"
        />
        <MetricCard
          title="Request Batching"
          value={metrics.requestBatching?.averageBatchSize?.toFixed(1) || '0'}
          subtitle="Avg Batch Size"
          color="purple"
        />
        <MetricCard
          title="Cache Optimization"
          value={`${(metrics.cacheOptimization?.hitRate * 100 || 0).toFixed(1)}%`}
          subtitle="Cache Hit Rate"
          color="orange"
        />
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
          <div className="space-y-2">
            {report.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800"
              >
                {recommendation}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {report.summary?.criticalIssues > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-red-600">Critical Issues</h3>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              {report.summary.criticalIssues} critical performance issues detected.
              Please review and address immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Metric card component
 */
function MetricCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}): JSX.Element {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-75">{subtitle}</div>
    </div>
  );
}

// =============================================================================
// Performance Hooks Examples
// =============================================================================

/**
 * Example hook for monitoring component performance
 */
export function useComponentPerformance(componentName: string) {
  const performanceManager = PerformanceManager.getInstance();
  const renderStartTime = React.useRef<number>(0);
  const renderCount = React.useRef<number>(0);

  React.useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current++;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      
      // Record render performance if manager has monitoring enabled
      if (performanceManager) {
        performanceManager.recordMetric({
          name: `${componentName}_render_time`,
          value: renderTime,
          unit: 'ms',
          category: 'render',
          metadata: {
            componentName,
            renderCount: renderCount.current,
          },
        });
      }
    };
  });

  return {
    renderCount: renderCount.current,
    recordCustomMetric: (name: string, value: number, unit: string = 'ms') => {
      performanceManager?.recordMetric({
        name: `${componentName}_${name}`,
        value,
        unit,
        category: 'render',
        metadata: { componentName },
      });
    },
  };
}

/**
 * Example hook for optimized GraphQL queries
 */
export function useOptimizedQuery<T>(
  query: DocumentNode,
  variables?: Record<string, unknown>
) {
  const performanceManager = PerformanceManager.getInstance();
  const [metrics, setMetrics] = React.useState<{
    responseTime: number;
    cacheHit: boolean;
    optimized: boolean;
  } | null>(null);

  // Use field selection optimization
  const optimizedQuery = React.useMemo(() => {
    if (performanceManager) {
      const optimizer = new FieldSelectionUtils.FieldSelectionOptimizer();
      const result = optimizer.optimizeQuery(query);
      
      setMetrics(prev => ({
        ...prev,
        optimized: result.fieldsRemoved.length > 0,
      }));
      
      return result.optimizedQuery;
    }
    return query;
  }, [query, performanceManager]);

  // Track query performance
  const trackPerformance = React.useCallback((responseTime: number, cacheHit: boolean) => {
    setMetrics(prev => ({
      ...prev,
      responseTime,
      cacheHit,
    }));
  }, []);

  return {
    query: optimizedQuery,
    variables,
    metrics,
    trackPerformance,
  };
}

// =============================================================================
// Exports
// =============================================================================

export const PerformanceIntegrationExample = {
  createOptimizedApolloClient,
  PerformanceDashboard,
  useComponentPerformance,
  useOptimizedQuery,
};

// Re-export for convenience
export { createOptimizedApolloClient, PerformanceDashboard };