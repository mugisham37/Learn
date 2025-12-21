/**
 * Performance Monitoring and Metrics
 *
 * Comprehensive performance monitoring, metrics collection, and analytics
 * for GraphQL operations, subscriptions, and overall application performance.
 *
 * Requirements: 11.5
 */

import React from 'react';
import { DocumentNode, print } from 'graphql';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'query' | 'mutation' | 'subscription' | 'bundle' | 'network' | 'cache' | 'render';
  metadata?: Record<string, unknown>;
}

export interface QueryPerformanceMetric extends PerformanceMetric {
  category: 'query' | 'mutation' | 'subscription';
  queryName: string;
  queryHash: string;
  variables: Record<string, unknown>;
  responseSize: number;
  cacheHit: boolean;
  networkTime: number;
  parseTime: number;
  validationTime: number;
}

export interface BundlePerformanceMetric extends PerformanceMetric {
  category: 'bundle';
  bundleName: string;
  bundleSize: number;
  loadTime: number;
  cached: boolean;
  compressionRatio: number;
}

export interface NetworkPerformanceMetric extends PerformanceMetric {
  category: 'network';
  endpoint: string;
  method: string;
  statusCode: number;
  requestSize: number;
  responseSize: number;
  latency: number;
  ttfb: number; // Time to first byte
}

export interface CachePerformanceMetric extends PerformanceMetric {
  category: 'cache';
  operation: 'hit' | 'miss' | 'eviction' | 'write';
  cacheKey: string;
  cacheSize: number;
  hitRate: number;
}

export interface RenderPerformanceMetric extends PerformanceMetric {
  category: 'render';
  componentName: string;
  renderTime: number;
  reRenderCount: number;
  propsChanged: boolean;
  stateChanged: boolean;
}

export interface PerformanceThresholds {
  query: {
    maxResponseTime: number;
    maxResponseSize: number;
    minCacheHitRate: number;
  };
  bundle: {
    maxLoadTime: number;
    maxBundleSize: number;
    minCompressionRatio: number;
  };
  network: {
    maxLatency: number;
    maxTTFB: number;
    minSuccessRate: number;
  };
  render: {
    maxRenderTime: number;
    maxReRenderCount: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  category: PerformanceMetric['category'];
  message: string;
  metric: PerformanceMetric;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceReport {
  summary: {
    totalMetrics: number;
    averageResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    performanceScore: number;
  };
  categories: {
    [K in PerformanceMetric['category']]: {
      count: number;
      averageValue: number;
      trends: Array<{ timestamp: Date; value: number }>;
    };
  };
  alerts: PerformanceAlert[];
  recommendations: string[];
}

// =============================================================================
// Performance Monitor
// =============================================================================

class PerformanceMonitorClass {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private maxMetrics: number;
  private observers: Array<(metric: PerformanceMetric) => void> = [];

  constructor(thresholds?: Partial<PerformanceThresholds>, maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics;
    this.thresholds = {
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
      render: {
        maxRenderTime: 16, // 60fps = 16.67ms per frame
        maxReRenderCount: 5,
      },
      ...thresholds,
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      id: this.generateMetricId(),
      timestamp: new Date(),
    };

    // Add to metrics array
    this.metrics.push(fullMetric);

    // Manage metrics size
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check thresholds and create alerts
    this.checkThresholds(fullMetric);

    // Notify observers
    this.observers.forEach(observer => observer(fullMetric));
  }

  /**
   * Record query performance
   */
  recordQueryPerformance(
    query: DocumentNode,
    variables: Record<string, unknown>,
    responseTime: number,
    responseSize: number,
    cacheHit: boolean,
    additionalMetrics?: {
      networkTime?: number;
      parseTime?: number;
      validationTime?: number;
    }
  ): void {
    const queryString = print(query);
    const queryName = this.extractQueryName(query) || 'anonymous';
    const queryHash = this.hashString(queryString);

    const metric: QueryPerformanceMetric = {
      id: this.generateMetricId(),
      name: `${queryName}_response_time`,
      value: responseTime,
      unit: 'ms',
      timestamp: new Date(),
      category: 'query',
      queryName,
      queryHash,
      variables,
      responseSize,
      cacheHit,
      networkTime: additionalMetrics?.networkTime || responseTime,
      parseTime: additionalMetrics?.parseTime || 0,
      validationTime: additionalMetrics?.validationTime || 0,
    };

    this.recordMetric(metric);
  }

  /**
   * Record bundle performance
   */
  recordBundlePerformance(
    bundleName: string,
    bundleSize: number,
    loadTime: number,
    cached: boolean,
    compressionRatio: number = 1
  ): void {
    const metric: BundlePerformanceMetric = {
      id: this.generateMetricId(),
      name: `${bundleName}_load_time`,
      value: loadTime,
      unit: 'ms',
      timestamp: new Date(),
      category: 'bundle',
      bundleName,
      bundleSize,
      loadTime,
      cached,
      compressionRatio,
    };

    this.recordMetric(metric);
  }

  /**
   * Record network performance
   */
  recordNetworkPerformance(
    endpoint: string,
    method: string,
    statusCode: number,
    requestSize: number,
    responseSize: number,
    latency: number,
    ttfb: number
  ): void {
    const metric: NetworkPerformanceMetric = {
      id: this.generateMetricId(),
      name: `${method}_${endpoint}_latency`,
      value: latency,
      unit: 'ms',
      timestamp: new Date(),
      category: 'network',
      endpoint,
      method,
      statusCode,
      requestSize,
      responseSize,
      latency,
      ttfb,
    };

    this.recordMetric(metric);
  }

  /**
   * Record cache performance
   */
  recordCachePerformance(
    operation: CachePerformanceMetric['operation'],
    cacheKey: string,
    cacheSize: number,
    hitRate: number
  ): void {
    const metric: CachePerformanceMetric = {
      id: this.generateMetricId(),
      name: `cache_${operation}`,
      value: operation === 'hit' ? 1 : 0,
      unit: 'count',
      timestamp: new Date(),
      category: 'cache',
      operation,
      cacheKey,
      cacheSize,
      hitRate,
    };

    this.recordMetric(metric);
  }

  /**
   * Record render performance
   */
  recordRenderPerformance(
    componentName: string,
    renderTime: number,
    reRenderCount: number,
    propsChanged: boolean,
    stateChanged: boolean
  ): void {
    const metric: RenderPerformanceMetric = {
      id: this.generateMetricId(),
      name: `${componentName}_render_time`,
      value: renderTime,
      unit: 'ms',
      timestamp: new Date(),
      category: 'render',
      componentName,
      renderTime,
      reRenderCount,
      propsChanged,
      stateChanged,
    };

    this.recordMetric(metric);
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkThresholds(metric: PerformanceMetric): void {
    let alertType: PerformanceAlert['type'] | null = null;
    let message = '';
    let threshold = 0;

    switch (metric.category) {
      case 'query':
        const queryMetric = metric as QueryPerformanceMetric;
        if (queryMetric.value > this.thresholds.query.maxResponseTime) {
          alertType =
            queryMetric.value > this.thresholds.query.maxResponseTime * 2 ? 'critical' : 'warning';
          message = `Query ${queryMetric.queryName} response time (${queryMetric.value}ms) exceeds threshold`;
          threshold = this.thresholds.query.maxResponseTime;
        }
        break;

      case 'bundle':
        const bundleMetric = metric as BundlePerformanceMetric;
        if (bundleMetric.loadTime > this.thresholds.bundle.maxLoadTime) {
          alertType =
            bundleMetric.loadTime > this.thresholds.bundle.maxLoadTime * 2 ? 'critical' : 'warning';
          message = `Bundle ${bundleMetric.bundleName} load time (${bundleMetric.loadTime}ms) exceeds threshold`;
          threshold = this.thresholds.bundle.maxLoadTime;
        }
        break;

      case 'network':
        const networkMetric = metric as NetworkPerformanceMetric;
        if (networkMetric.latency > this.thresholds.network.maxLatency) {
          alertType =
            networkMetric.latency > this.thresholds.network.maxLatency * 2 ? 'critical' : 'warning';
          message = `Network latency (${networkMetric.latency}ms) to ${networkMetric.endpoint} exceeds threshold`;
          threshold = this.thresholds.network.maxLatency;
        }
        break;

      case 'render':
        const renderMetric = metric as RenderPerformanceMetric;
        if (renderMetric.renderTime > this.thresholds.render.maxRenderTime) {
          alertType =
            renderMetric.renderTime > this.thresholds.render.maxRenderTime * 2
              ? 'critical'
              : 'warning';
          message = `Component ${renderMetric.componentName} render time (${renderMetric.renderTime}ms) exceeds threshold`;
          threshold = this.thresholds.render.maxRenderTime;
        }
        break;
    }

    if (alertType) {
      const alert: PerformanceAlert = {
        id: this.generateMetricId(),
        type: alertType,
        category: metric.category,
        message,
        metric,
        threshold,
        timestamp: new Date(),
        resolved: false,
      };

      this.alerts.push(alert);

      // Keep only recent alerts
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-1000);
      }
    }
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange?: { start: Date; end: Date }): PerformanceReport {
    let filteredMetrics = this.metrics;

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    // Calculate summary statistics
    const totalMetrics = filteredMetrics.length;
    const queryMetrics = filteredMetrics.filter(
      m => m.category === 'query'
    ) as QueryPerformanceMetric[];
    const networkMetrics = filteredMetrics.filter(
      m => m.category === 'network'
    ) as NetworkPerformanceMetric[];

    const averageResponseTime =
      queryMetrics.length > 0
        ? queryMetrics.reduce((sum, m) => sum + m.value, 0) / queryMetrics.length
        : 0;

    const cacheHits = queryMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = queryMetrics.length > 0 ? cacheHits / queryMetrics.length : 0;

    const errors = networkMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = networkMetrics.length > 0 ? errors / networkMetrics.length : 0;

    // Calculate performance score (0-100)
    const responseTimeScore = Math.max(0, 100 - averageResponseTime / 20);
    const cacheScore = cacheHitRate * 100;
    const errorScore = Math.max(0, 100 - errorRate * 100);
    const performanceScore = (responseTimeScore + cacheScore + errorScore) / 3;

    // Group metrics by category
    const categories = {} as PerformanceReport['categories'];
    const categoryNames: PerformanceMetric['category'][] = [
      'query',
      'mutation',
      'subscription',
      'bundle',
      'network',
      'cache',
      'render',
    ];

    categoryNames.forEach(category => {
      const categoryMetrics = filteredMetrics.filter(m => m.category === category);
      const averageValue =
        categoryMetrics.length > 0
          ? categoryMetrics.reduce((sum, m) => sum + m.value, 0) / categoryMetrics.length
          : 0;

      // Create trend data (last 24 hours, hourly buckets)
      const trends = this.createTrendData(categoryMetrics);

      categories[category] = {
        count: categoryMetrics.length,
        averageValue,
        trends,
      };
    });

    // Get recent alerts
    const recentAlerts = this.alerts.filter(alert => !alert.resolved);

    // Generate recommendations
    const recommendations = this.generateRecommendations(filteredMetrics, recentAlerts);

    return {
      summary: {
        totalMetrics,
        averageResponseTime,
        cacheHitRate,
        errorRate,
        performanceScore,
      },
      categories,
      alerts: recentAlerts,
      recommendations,
    };
  }

  /**
   * Create trend data for metrics
   */
  private createTrendData(metrics: PerformanceMetric[]): Array<{ timestamp: Date; value: number }> {
    // Group metrics by hour
    const hourlyBuckets = new Map<string, PerformanceMetric[]>();

    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();

      if (!hourlyBuckets.has(key)) {
        hourlyBuckets.set(key, []);
      }
      const bucket = hourlyBuckets.get(key);
      if (bucket) {
        bucket.push(metric);
      }
    });

    // Calculate average for each hour
    return Array.from(hourlyBuckets.entries())
      .map(([timestamp, bucketMetrics]) => ({
        timestamp: new Date(timestamp),
        value: bucketMetrics.reduce((sum, m) => sum + m.value, 0) / bucketMetrics.length,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    metrics: PerformanceMetric[],
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Query performance recommendations
    const queryMetrics = metrics.filter(m => m.category === 'query') as QueryPerformanceMetric[];
    const slowQueries = queryMetrics.filter(m => m.value > this.thresholds.query.maxResponseTime);

    if (slowQueries.length > 0) {
      recommendations.push(
        `Optimize ${slowQueries.length} slow queries with response times > ${this.thresholds.query.maxResponseTime}ms`
      );
    }

    const lowCacheHitRate = queryMetrics.filter(m => !m.cacheHit).length / queryMetrics.length;
    if (lowCacheHitRate > 0.3) {
      recommendations.push(
        'Improve cache hit rate by optimizing cache policies and query structure'
      );
    }

    // Bundle performance recommendations
    const bundleMetrics = metrics.filter(m => m.category === 'bundle') as BundlePerformanceMetric[];
    const largeBundles = bundleMetrics.filter(
      m => m.bundleSize > this.thresholds.bundle.maxBundleSize
    );

    if (largeBundles.length > 0) {
      recommendations.push(
        `Reduce size of ${largeBundles.length} large bundles through code splitting`
      );
    }

    // Network performance recommendations
    const networkMetrics = metrics.filter(
      m => m.category === 'network'
    ) as NetworkPerformanceMetric[];
    const highLatency = networkMetrics.filter(m => m.latency > this.thresholds.network.maxLatency);

    if (highLatency.length > 0) {
      recommendations.push(`Investigate ${highLatency.length} high-latency network requests`);
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.type === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push(
        `Address ${criticalAlerts.length} critical performance issues immediately`
      );
    }

    return recommendations;
  }

  /**
   * Subscribe to performance metrics
   */
  subscribe(observer: (metric: PerformanceMetric) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics.length = 0;
    this.alerts.length = 0;
  }

  /**
   * Utility methods
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private extractQueryName(query: DocumentNode): string | null {
    const definition = query.definitions[0];
    if (definition && definition.kind === 'OperationDefinition' && definition.name) {
      return definition.name.value;
    }
    return null;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for monitoring performance metrics
 */
function usePerformanceMonitoringFunction(monitor: PerformanceMonitorClass): {
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  report: PerformanceReport;
  recordMetric: (metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) => void;
  resolveAlert: (alertId: string) => void;
} {
  const [metrics, setMetrics] = React.useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = React.useState<PerformanceAlert[]>([]);
  const [report, setReport] = React.useState<PerformanceReport>(monitor.generateReport());

  React.useEffect(() => {
    const unsubscribe = monitor.subscribe(() => {
      setMetrics(monitor.getMetrics());
      setAlerts(monitor.getAlerts());
      setReport(monitor.generateReport());
    });

    // Initial load
    setMetrics(monitor.getMetrics());
    setAlerts(monitor.getAlerts());

    return unsubscribe;
  }, [monitor]);

  const recordMetric = React.useCallback(
    (metric: Omit<PerformanceMetric, 'id' | 'timestamp'>) => {
      monitor.recordMetric(metric);
    },
    [monitor]
  );

  const resolveAlert = React.useCallback(
    (alertId: string) => {
      monitor.resolveAlert(alertId);
      setAlerts(monitor.getAlerts());
    },
    [monitor]
  );

  return {
    metrics,
    alerts,
    report,
    recordMetric,
    resolveAlert,
  };
}

/**
 * Hook for measuring component render performance
 */
export function useRenderPerformance(componentName: string, monitor?: PerformanceMonitorClass): void {
  const renderCount = React.useRef(0);

  React.useEffect(() => {
    const startTime = performance.now();
    const currentRenderCount = ++renderCount.current;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      if (monitor) {
        monitor.recordRenderPerformance(
          componentName,
          renderTime,
          currentRenderCount,
          false, // Would need actual props comparison
          false // Would need actual state comparison
        );
      }
    };
  }, [componentName, monitor]);
}

// =============================================================================
// Exports
// =============================================================================

export const PerformanceMonitoringUtils = {
  PerformanceMonitor: PerformanceMonitorClass,
  usePerformanceMonitoring: usePerformanceMonitoringFunction,
  useRenderPerformance,
};

// Re-export for convenience
export const PerformanceMonitor = PerformanceMonitorClass;
export const usePerformanceMonitoring = usePerformanceMonitoringFunction;
