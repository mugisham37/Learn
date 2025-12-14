/**
 * GraphQL Complexity Monitoring
 *
 * This module provides utilities for monitoring and logging GraphQL query complexity
 * to help identify performance bottlenecks and optimize query patterns.
 *
 * Requirements: 15.6
 */

import { logger } from '../../shared/utils/logger.js';

import { 
  GraphQLRequestContextWillSendResponseTyped,
  GraphQLRequestContextDidResolveOperationTyped 
} from './types.js';

/**
 * Interface for complexity monitoring data
 */
export interface ComplexityMetrics {
  query: string;
  operationName?: string;
  complexity: number;
  executionTime?: number;
  userId?: string;
  userRole?: string;
  timestamp: Date;
  variables?: Record<string, unknown>;
}

/**
 * Interface for complexity monitoring configuration
 */
export interface ComplexityMonitoringConfig {
  logThreshold: number;
  alertThreshold: number;
  enableDetailedLogging: boolean;
  enablePerformanceTracking: boolean;
}

/**
 * Default monitoring configuration
 */
const DEFAULT_MONITORING_CONFIG: ComplexityMonitoringConfig = {
  logThreshold: 500, // Log queries with complexity > 500
  alertThreshold: 800, // Alert on queries with complexity > 800
  enableDetailedLogging: (process.env as Record<string, string | undefined>)['NODE_ENV'] !== 'production',
  enablePerformanceTracking: true,
};

/**
 * Complexity monitoring service
 */
export class ComplexityMonitor {
  private config: ComplexityMonitoringConfig;
  private metrics: ComplexityMetrics[] = [];
  private readonly maxMetricsHistory = 1000;

  constructor(config: Partial<ComplexityMonitoringConfig> = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
  }

  /**
   * Log a query's complexity metrics
   */
  logComplexity(metrics: ComplexityMetrics): void {
    // Store metrics for analysis
    this.storeMetrics(metrics);

    // Log based on complexity threshold
    if (metrics.complexity >= this.config.alertThreshold) {
      logger.error('GraphQL query complexity alert', {
        complexity: metrics.complexity,
        threshold: this.config.alertThreshold,
        operationName: metrics.operationName,
        userId: metrics.userId,
        userRole: metrics.userRole,
        executionTime: metrics.executionTime,
        timestamp: metrics.timestamp.toISOString(),
        query: this.config.enableDetailedLogging ? metrics.query : '[REDACTED]',
      });
    } else if (metrics.complexity >= this.config.logThreshold) {
      logger.warn('High complexity GraphQL query', {
        complexity: metrics.complexity,
        threshold: this.config.logThreshold,
        operationName: metrics.operationName,
        userId: metrics.userId,
        userRole: metrics.userRole,
        executionTime: metrics.executionTime,
        timestamp: metrics.timestamp.toISOString(),
        query: this.config.enableDetailedLogging ? this.sanitizeQuery(metrics.query) : '[REDACTED]',
      });
    } else if (this.config.enableDetailedLogging) {
      logger.debug('GraphQL query complexity', {
        complexity: metrics.complexity,
        operationName: metrics.operationName,
        userId: metrics.userId,
        executionTime: metrics.executionTime,
      });
    }
  }

  /**
   * Store metrics for analysis
   */
  private storeMetrics(metrics: ComplexityMetrics): void {
    this.metrics.push(metrics);

    // Keep only the most recent metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get complexity statistics
   */
  getComplexityStats(): {
    totalQueries: number;
    averageComplexity: number;
    maxComplexity: number;
    minComplexity: number;
    highComplexityQueries: number;
    alertQueries: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        averageComplexity: 0,
        maxComplexity: 0,
        minComplexity: 0,
        highComplexityQueries: 0,
        alertQueries: 0,
      };
    }

    const complexities = this.metrics.map((m) => m.complexity);
    const totalComplexity = complexities.reduce((sum, c) => sum + c, 0);

    return {
      totalQueries: this.metrics.length,
      averageComplexity: Math.round(totalComplexity / this.metrics.length),
      maxComplexity: Math.max(...complexities),
      minComplexity: Math.min(...complexities),
      highComplexityQueries: this.metrics.filter((m) => m.complexity >= this.config.logThreshold)
        .length,
      alertQueries: this.metrics.filter((m) => m.complexity >= this.config.alertThreshold).length,
    };
  }

  /**
   * Get top complex queries
   */
  getTopComplexQueries(limit = 10): ComplexityMetrics[] {
    return [...this.metrics].sort((a, b) => b.complexity - a.complexity).slice(0, limit);
  }

  /**
   * Get queries by user
   */
  getQueriesByUser(userId: string): ComplexityMetrics[] {
    return this.metrics.filter((m) => m.userId === userId);
  }

  /**
   * Clear stored metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Sanitize query string for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data from query strings
    return query
      .replace(/password:\s*"[^"]*"/gi, 'password: "[REDACTED]"')
      .replace(/token:\s*"[^"]*"/gi, 'token: "[REDACTED]"')
      .replace(/secret:\s*"[^"]*"/gi, 'secret: "[REDACTED]"')
      .replace(/email:\s*"[^@]*@[^"]*"/gi, 'email: "[REDACTED]"');
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<ComplexityMonitoringConfig>): void {
    this.config = { ...this.config, ...config };

    logger.info('Complexity monitoring configuration updated', {
      logThreshold: this.config.logThreshold,
      alertThreshold: this.config.alertThreshold,
      enableDetailedLogging: this.config.enableDetailedLogging,
      enablePerformanceTracking: this.config.enablePerformanceTracking,
    });
  }
}

/**
 * Global complexity monitor instance
 */
export const complexityMonitor = new ComplexityMonitor();

/**
 * Helper function to create complexity metrics
 */
export function createComplexityMetrics(
  query: string,
  complexity: number,
  context?: {
    operationName?: string;
    userId?: string;
    userRole?: string;
    executionTime?: number;
    variables?: Record<string, unknown>;
  }
): ComplexityMetrics {
  return {
    query,
    complexity,
    timestamp: new Date(),
    operationName: context?.operationName,
    userId: context?.userId,
    userRole: context?.userRole,
    executionTime: context?.executionTime,
    variables: context?.variables,
  };
}

/**
 * Middleware to track query execution time
 */
export function createExecutionTimeTracker(): {
  requestDidStart(): Promise<{
    willSendResponse(requestContext: GraphQLRequestContextWillSendResponseTyped): Promise<void>;
    didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void>;
  }>;
} {
  const startTimes = new Map<string, number>();

  return {
    requestDidStart(): Promise<{
      willSendResponse(requestContext: GraphQLRequestContextWillSendResponseTyped): Promise<void>;
      didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void>;
    }> {
      return Promise.resolve({
        willSendResponse(requestContext: GraphQLRequestContextWillSendResponseTyped): Promise<void> {
          return new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            const requestId = (requestContext.request.http as any)?.requestId || 'unknown';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const startTime = startTimes.get(requestId);

            if (startTime) {
              const executionTime = Date.now() - startTime;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              startTimes.delete(requestId);

              // Add execution time to context for complexity monitoring
              if (requestContext.contextValue) {
                requestContext.contextValue.executionTime = executionTime;
              }
            }

            resolve();
          });
        },

        didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void> {
          return new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            const requestId = (requestContext.request.http as any)?.requestId || 'unknown';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            startTimes.set(requestId, Date.now());
            resolve();
          });
        },
      });
    },
  };
}

/**
 * Export monitoring utilities
 */
export { DEFAULT_MONITORING_CONFIG };
