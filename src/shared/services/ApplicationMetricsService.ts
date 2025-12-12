/**
 * Application Metrics Service
 * 
 * Collects and tracks comprehensive application performance metrics including
 * response times, throughput, error rates, database performance, external service
 * latency, resource utilization, and cache hit rates.
 * 
 * Requirements: 17.6
 */

import { EventEmitter } from 'events';
import * as os from 'os';

import { logger } from '../utils/logger.js';
import { cloudWatchService } from './CloudWatchService.js';

/**
 * Response time percentile data
 */
interface ResponseTimePercentiles {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  sum: number;
}

/**
 * Throughput metrics
 */
interface ThroughputMetrics {
  requestsPerSecond: number;
  totalRequests: number;
  windowStart: number;
}

/**
 * Error rate metrics
 */
interface ErrorRateMetrics {
  errorCount: number;
  totalRequests: number;
  errorRate: number;
  errorsByType: Map<string, number>;
}

/**
 * Database performance metrics
 */
interface DatabaseMetrics {
  queryCount: number;
  totalDuration: number;
  averageDuration: number;
  slowQueries: number;
  queriesByOperation: Map<string, { count: number; totalDuration: number }>;
}

/**
 * External service metrics
 */
interface ExternalServiceMetrics {
  callCount: number;
  totalDuration: number;
  averageDuration: number;
  errorCount: number;
  servicesByName: Map<string, { count: number; totalDuration: number; errors: number }>;
}

/**
 * Resource utilization metrics
 */
interface ResourceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  loadAverage: number[];
}

/**
 * Cache performance metrics
 */
interface CacheMetrics {
  hitCount: number;
  missCount: number;
  hitRate: number;
  cachesByType: Map<string, { hits: number; misses: number }>;
}

/**
 * Application metrics service interface
 */
export interface IApplicationMetricsService {
  // Response time tracking
  recordResponseTime(endpoint: string, method: string, duration: number): void;
  getResponseTimePercentiles(endpoint?: string): ResponseTimePercentiles;
  
  // Throughput tracking
  recordRequest(endpoint: string, method: string): void;
  getThroughputMetrics(): ThroughputMetrics;
  
  // Error rate tracking
  recordError(endpoint: string, method: string, errorType: string): void;
  getErrorRateMetrics(): ErrorRateMetrics;
  
  // Database performance tracking
  recordDatabaseQuery(operation: string, table: string, duration: number): void;
  getDatabaseMetrics(): DatabaseMetrics;
  
  // External service tracking
  recordExternalServiceCall(serviceName: string, operation: string, duration: number, success: boolean): void;
  getExternalServiceMetrics(): ExternalServiceMetrics;
  
  // Resource utilization
  getResourceMetrics(): ResourceMetrics;
  
  // Cache performance
  recordCacheHit(cacheType: string): void;
  recordCacheMiss(cacheType: string): void;
  getCacheMetrics(): CacheMetrics;
  
  // Metrics publishing
  publishMetrics(): Promise<void>;
  startMetricsCollection(): void;
  stopMetricsCollection(): void;
}

/**
 * Application metrics service implementation
 */
export class ApplicationMetricsService extends EventEmitter implements IApplicationMetricsService {
  private responseTimes: Map<string, number[]> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private errorsByType: Map<string, number> = new Map();
  private databaseQueries: Array<{ operation: string; table: string; duration: number; timestamp: number }> = [];
  private externalServiceCalls: Array<{ service: string; operation: string; duration: number; success: boolean; timestamp: number }> = [];
  private cacheHits: Map<string, number> = new Map();
  private cacheMisses: Map<string, number> = new Map();
  
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly windowSize = 60000; // 1 minute window
  private readonly maxDataPoints = 1000; // Limit memory usage
  
  constructor() {
    super();
    this.startMetricsCollection();
  }

  /**
   * Record API response time
   */
  recordResponseTime(endpoint: string, method: string, duration: number): void {
    const key = `${method}:${endpoint}`;
    
    if (!this.responseTimes.has(key)) {
      this.responseTimes.set(key, []);
    }
    
    const times = this.responseTimes.get(key)!;
    times.push(duration);
    
    // Keep only recent data points to prevent memory leaks
    if (times.length > this.maxDataPoints) {
      times.splice(0, times.length - this.maxDataPoints);
    }
    
    this.emit('responseTime', { endpoint, method, duration });
  }

  /**
   * Get response time percentiles
   */
  getResponseTimePercentiles(endpoint?: string): ResponseTimePercentiles {
    const allTimes: number[] = [];
    
    if (endpoint) {
      // Get times for specific endpoint
      for (const [key, times] of this.responseTimes.entries()) {
        if (key.includes(endpoint)) {
          allTimes.push(...times);
        }
      }
    } else {
      // Get all response times
      for (const times of this.responseTimes.values()) {
        allTimes.push(...times);
      }
    }
    
    if (allTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0, sum: 0 };
    }
    
    allTimes.sort((a, b) => a - b);
    
    const count = allTimes.length;
    const sum = allTimes.reduce((acc, time) => acc + time, 0);
    
    return {
      p50: this.getPercentile(allTimes, 50),
      p95: this.getPercentile(allTimes, 95),
      p99: this.getPercentile(allTimes, 99),
      count,
      sum,
    };
  }

  /**
   * Record incoming request
   */
  recordRequest(endpoint: string, method: string): void {
    const key = `${method}:${endpoint}`;
    const current = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, current + 1);
    
    this.emit('request', { endpoint, method });
  }

  /**
   * Get throughput metrics
   */
  getThroughputMetrics(): ThroughputMetrics {
    const now = Date.now();
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    
    // Calculate requests per second over the last minute
    const requestsPerSecond = totalRequests / (this.windowSize / 1000);
    
    return {
      requestsPerSecond,
      totalRequests,
      windowStart: now - this.windowSize,
    };
  }

  /**
   * Record error occurrence
   */
  recordError(endpoint: string, method: string, errorType: string): void {
    const key = `${method}:${endpoint}`;
    
    // Increment error count for endpoint
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);
    
    // Increment error count by type
    const typeCount = this.errorsByType.get(errorType) || 0;
    this.errorsByType.set(errorType, typeCount + 1);
    
    this.emit('error', { endpoint, method, errorType });
  }

  /**
   * Get error rate metrics
   */
  getErrorRateMetrics(): ErrorRateMetrics {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    return {
      errorCount: totalErrors,
      totalRequests,
      errorRate,
      errorsByType: new Map(this.errorsByType),
    };
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    const now = Date.now();
    
    this.databaseQueries.push({
      operation,
      table,
      duration,
      timestamp: now,
    });
    
    // Clean old queries to prevent memory leaks
    const cutoff = now - this.windowSize;
    this.databaseQueries = this.databaseQueries.filter(query => query.timestamp > cutoff);
    
    this.emit('databaseQuery', { operation, table, duration });
  }

  /**
   * Get database performance metrics
   */
  getDatabaseMetrics(): DatabaseMetrics {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const recentQueries = this.databaseQueries.filter(query => query.timestamp > cutoff);
    
    const queryCount = recentQueries.length;
    const totalDuration = recentQueries.reduce((sum, query) => sum + query.duration, 0);
    const averageDuration = queryCount > 0 ? totalDuration / queryCount : 0;
    const slowQueries = recentQueries.filter(query => query.duration > 1000).length; // > 1 second
    
    const queriesByOperation = new Map<string, { count: number; totalDuration: number }>();
    
    for (const query of recentQueries) {
      const key = `${query.operation}:${query.table}`;
      const existing = queriesByOperation.get(key) || { count: 0, totalDuration: 0 };
      queriesByOperation.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + query.duration,
      });
    }
    
    return {
      queryCount,
      totalDuration,
      averageDuration,
      slowQueries,
      queriesByOperation,
    };
  }

  /**
   * Record external service call
   */
  recordExternalServiceCall(serviceName: string, operation: string, duration: number, success: boolean): void {
    const now = Date.now();
    
    this.externalServiceCalls.push({
      service: serviceName,
      operation,
      duration,
      success,
      timestamp: now,
    });
    
    // Clean old calls to prevent memory leaks
    const cutoff = now - this.windowSize;
    this.externalServiceCalls = this.externalServiceCalls.filter(call => call.timestamp > cutoff);
    
    this.emit('externalServiceCall', { serviceName, operation, duration, success });
  }

  /**
   * Get external service metrics
   */
  getExternalServiceMetrics(): ExternalServiceMetrics {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    const recentCalls = this.externalServiceCalls.filter(call => call.timestamp > cutoff);
    
    const callCount = recentCalls.length;
    const totalDuration = recentCalls.reduce((sum, call) => sum + call.duration, 0);
    const averageDuration = callCount > 0 ? totalDuration / callCount : 0;
    const errorCount = recentCalls.filter(call => !call.success).length;
    
    const servicesByName = new Map<string, { count: number; totalDuration: number; errors: number }>();
    
    for (const call of recentCalls) {
      const key = `${call.service}:${call.operation}`;
      const existing = servicesByName.get(key) || { count: 0, totalDuration: 0, errors: 0 };
      servicesByName.set(key, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + call.duration,
        errors: existing.errors + (call.success ? 0 : 1),
      });
    }
    
    return {
      callCount,
      totalDuration,
      averageDuration,
      errorCount,
      servicesByName,
    };
  }

  /**
   * Get current resource utilization metrics
   */
  getResourceMetrics(): ResourceMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      loadAverage: process.platform === 'linux' ? os.loadavg() : [0, 0, 0],
    };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(cacheType: string): void {
    const current = this.cacheHits.get(cacheType) || 0;
    this.cacheHits.set(cacheType, current + 1);
    
    this.emit('cacheHit', { cacheType });
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(cacheType: string): void {
    const current = this.cacheMisses.get(cacheType) || 0;
    this.cacheMisses.set(cacheType, current + 1);
    
    this.emit('cacheMiss', { cacheType });
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics {
    const totalHits = Array.from(this.cacheHits.values()).reduce((sum, count) => sum + count, 0);
    const totalMisses = Array.from(this.cacheMisses.values()).reduce((sum, count) => sum + count, 0);
    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? (totalHits / total) * 100 : 0;
    
    const cachesByType = new Map<string, { hits: number; misses: number }>();
    
    // Combine hits and misses by cache type
    const allCacheTypes = new Set([...this.cacheHits.keys(), ...this.cacheMisses.keys()]);
    
    for (const cacheType of allCacheTypes) {
      cachesByType.set(cacheType, {
        hits: this.cacheHits.get(cacheType) || 0,
        misses: this.cacheMisses.get(cacheType) || 0,
      });
    }
    
    return {
      hitCount: totalHits,
      missCount: totalMisses,
      hitRate,
      cachesByType,
    };
  }

  /**
   * Publish all metrics to CloudWatch
   */
  async publishMetrics(): Promise<void> {
    try {
      // Publish response time percentiles
      const responseTimeMetrics = this.getResponseTimePercentiles();
      if (responseTimeMetrics.count > 0) {
        await cloudWatchService.putMetric('ResponseTimeP50', responseTimeMetrics.p50, 'Milliseconds');
        await cloudWatchService.putMetric('ResponseTimeP95', responseTimeMetrics.p95, 'Milliseconds');
        await cloudWatchService.putMetric('ResponseTimeP99', responseTimeMetrics.p99, 'Milliseconds');
      }
      
      // Publish throughput metrics
      const throughputMetrics = this.getThroughputMetrics();
      await cloudWatchService.putMetric('RequestsPerSecond', throughputMetrics.requestsPerSecond, 'Count/Second');
      await cloudWatchService.putMetric('TotalRequests', throughputMetrics.totalRequests, 'Count');
      
      // Publish error rate metrics
      const errorMetrics = this.getErrorRateMetrics();
      await cloudWatchService.putMetric('ErrorRate', errorMetrics.errorRate, 'Percent');
      await cloudWatchService.putMetric('ErrorCount', errorMetrics.errorCount, 'Count');
      
      // Publish database metrics
      const dbMetrics = this.getDatabaseMetrics();
      if (dbMetrics.queryCount > 0) {
        await cloudWatchService.putMetric('DatabaseQueryCount', dbMetrics.queryCount, 'Count');
        await cloudWatchService.putMetric('DatabaseAverageQueryTime', dbMetrics.averageDuration, 'Milliseconds');
        await cloudWatchService.putMetric('DatabaseSlowQueries', dbMetrics.slowQueries, 'Count');
      }
      
      // Publish external service metrics
      const extMetrics = this.getExternalServiceMetrics();
      if (extMetrics.callCount > 0) {
        await cloudWatchService.putMetric('ExternalServiceCalls', extMetrics.callCount, 'Count');
        await cloudWatchService.putMetric('ExternalServiceAverageLatency', extMetrics.averageDuration, 'Milliseconds');
        await cloudWatchService.putMetric('ExternalServiceErrors', extMetrics.errorCount, 'Count');
      }
      
      // Publish resource metrics
      const resourceMetrics = this.getResourceMetrics();
      await cloudWatchService.putMetric('MemoryUsageHeapUsed', resourceMetrics.memoryUsage.heapUsed, 'Bytes');
      await cloudWatchService.putMetric('MemoryUsageHeapTotal', resourceMetrics.memoryUsage.heapTotal, 'Bytes');
      await cloudWatchService.putMetric('MemoryUsageRSS', resourceMetrics.memoryUsage.rss, 'Bytes');
      await cloudWatchService.putMetric('ProcessUptime', resourceMetrics.uptime, 'Seconds');
      
      // Publish cache metrics
      const cacheMetrics = this.getCacheMetrics();
      if (cacheMetrics.hitCount + cacheMetrics.missCount > 0) {
        await cloudWatchService.putMetric('CacheHitRate', cacheMetrics.hitRate, 'Percent');
        await cloudWatchService.putMetric('CacheHits', cacheMetrics.hitCount, 'Count');
        await cloudWatchService.putMetric('CacheMisses', cacheMetrics.missCount, 'Count');
      }
      
      logger.debug('Application metrics published to CloudWatch successfully');
    } catch (error) {
      logger.error('Failed to publish application metrics to CloudWatch', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Start automatic metrics collection and publishing
   */
  startMetricsCollection(): void {
    if (this.metricsInterval) {
      return;
    }
    
    // Publish metrics every minute
    this.metricsInterval = setInterval(() => {
      this.publishMetrics().catch(error => {
        logger.error('Error in metrics collection interval', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      });
    }, 60000);
    
    logger.info('Application metrics collection started');
  }

  /**
   * Stop automatic metrics collection
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      logger.info('Application metrics collection stopped');
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower] ?? 0;
    }
    
    const weight = index - lower;
    const lowerValue = sortedArray[lower] ?? 0;
    const upperValue = sortedArray[upper] ?? 0;
    return lowerValue * (1 - weight) + upperValue * weight;
  }
}

/**
 * Global application metrics service instance
 */
export const applicationMetricsService = new ApplicationMetricsService();