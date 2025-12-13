/**
 * Metrics Endpoint Middleware
 *
 * Provides HTTP endpoints for accessing application metrics.
 * Useful for monitoring dashboards and health checks.
 *
 * Requirements: 17.6
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { applicationMetricsService } from '../services/ApplicationMetricsService.js';
import { cloudWatchService } from '../services/CloudWatchService.js';
import { requireAuth, requireRole } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Metrics response interface
 */
interface MetricsResponse {
  timestamp: string;
  uptime: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    count: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
  };
  errorRate: {
    errorRate: number;
    errorCount: number;
    totalRequests: number;
    errorsByType: Record<string, number>;
  };
  database: {
    queryCount: number;
    averageDuration: number;
    slowQueries: number;
    queriesByOperation: Record<string, { count: number; averageDuration: number }>;
  };
  externalServices: {
    callCount: number;
    averageDuration: number;
    errorCount: number;
    servicesByName: Record<string, { count: number; averageDuration: number; errorRate: number }>;
  };
  resources: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    uptime: number;
    loadAverage: number[];
  };
  cache: {
    hitRate: number;
    hitCount: number;
    missCount: number;
    cachesByType: Record<string, { hits: number; misses: number; hitRate: number }>;
  };
}

/**
 * Register metrics endpoints
 */
export function registerMetricsEndpoints(server: FastifyInstance): void {
  // Public metrics endpoint (basic metrics only)
  server.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await getBasicMetrics();
      return reply.send(metrics);
    } catch (error) {
      logger.error('Failed to get basic metrics', { error });
      return reply.code(500).send({ error: 'Failed to retrieve metrics' });
    }
  });

  // Admin metrics endpoint (detailed metrics)
  server.get(
    '/admin/metrics',
    {
      preHandler: [requireAuth, requireRole(['admin'])],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = await getDetailedMetrics();
        return reply.send(metrics);
      } catch (error) {
        logger.error('Failed to get detailed metrics', { error });
        return reply.code(500).send({ error: 'Failed to retrieve detailed metrics' });
      }
    }
  );

  // Metrics health endpoint
  server.get('/metrics/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await getMetricsHealth();
      const statusCode = health.healthy ? 200 : 503;
      return reply.code(statusCode).send(health);
    } catch (error) {
      logger.error('Failed to get metrics health', { error });
      return reply.code(503).send({
        healthy: false,
        error: 'Failed to check metrics health',
      });
    }
  });

  // Prometheus-style metrics endpoint
  server.get('/metrics/prometheus', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const prometheusMetrics = await getPrometheusMetrics();
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(prometheusMetrics);
    } catch (error) {
      logger.error('Failed to get Prometheus metrics', { error });
      return reply.code(500).send('# Failed to retrieve metrics\n');
    }
  });

  logger.info('Metrics endpoints registered');
}

/**
 * Get basic metrics (public endpoint)
 */
async function getBasicMetrics(): Promise<Partial<MetricsResponse>> {
  const responseTimeMetrics = applicationMetricsService.getResponseTimePercentiles();
  const throughputMetrics = applicationMetricsService.getThroughputMetrics();
  const resourceMetrics = applicationMetricsService.getResourceMetrics();

  return {
    timestamp: new Date().toISOString(),
    uptime: resourceMetrics.uptime,
    responseTime: {
      p50: responseTimeMetrics.p50,
      p95: responseTimeMetrics.p95,
      p99: responseTimeMetrics.p99,
      count: responseTimeMetrics.count,
    },
    throughput: {
      requestsPerSecond: throughputMetrics.requestsPerSecond,
      totalRequests: throughputMetrics.totalRequests,
    },
    resources: {
      memory: {
        heapUsed: resourceMetrics.memoryUsage.heapUsed,
        heapTotal: resourceMetrics.memoryUsage.heapTotal,
        rss: resourceMetrics.memoryUsage.rss,
        external: resourceMetrics.memoryUsage.external,
      },
      cpu: {
        user: resourceMetrics.cpuUsage.user,
        system: resourceMetrics.cpuUsage.system,
      },
      uptime: resourceMetrics.uptime,
      loadAverage: resourceMetrics.loadAverage,
    },
  };
}

/**
 * Get detailed metrics (admin endpoint)
 */
async function getDetailedMetrics(): Promise<MetricsResponse> {
  const responseTimeMetrics = applicationMetricsService.getResponseTimePercentiles();
  const throughputMetrics = applicationMetricsService.getThroughputMetrics();
  const errorMetrics = applicationMetricsService.getErrorRateMetrics();
  const databaseMetrics = applicationMetricsService.getDatabaseMetrics();
  const externalServiceMetrics = applicationMetricsService.getExternalServiceMetrics();
  const resourceMetrics = applicationMetricsService.getResourceMetrics();
  const cacheMetrics = applicationMetricsService.getCacheMetrics();

  // Convert Maps to objects for JSON serialization
  const errorsByType: Record<string, number> = {};
  errorMetrics.errorsByType.forEach((count, type) => {
    errorsByType[type] = count;
  });

  const queriesByOperation: Record<string, { count: number; averageDuration: number }> = {};
  databaseMetrics.queriesByOperation.forEach((data, operation) => {
    queriesByOperation[operation] = {
      count: data.count,
      averageDuration: data.totalDuration / data.count,
    };
  });

  const servicesByName: Record<
    string,
    { count: number; averageDuration: number; errorRate: number }
  > = {};
  externalServiceMetrics.servicesByName.forEach((data, service) => {
    servicesByName[service] = {
      count: data.count,
      averageDuration: data.totalDuration / data.count,
      errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0,
    };
  });

  const cachesByType: Record<string, { hits: number; misses: number; hitRate: number }> = {};
  cacheMetrics.cachesByType.forEach((data, cacheType) => {
    const total = data.hits + data.misses;
    cachesByType[cacheType] = {
      hits: data.hits,
      misses: data.misses,
      hitRate: total > 0 ? (data.hits / total) * 100 : 0,
    };
  });

  return {
    timestamp: new Date().toISOString(),
    uptime: resourceMetrics.uptime,
    responseTime: {
      p50: responseTimeMetrics.p50,
      p95: responseTimeMetrics.p95,
      p99: responseTimeMetrics.p99,
      count: responseTimeMetrics.count,
    },
    throughput: {
      requestsPerSecond: throughputMetrics.requestsPerSecond,
      totalRequests: throughputMetrics.totalRequests,
    },
    errorRate: {
      errorRate: errorMetrics.errorRate,
      errorCount: errorMetrics.errorCount,
      totalRequests: errorMetrics.totalRequests,
      errorsByType,
    },
    database: {
      queryCount: databaseMetrics.queryCount,
      averageDuration: databaseMetrics.averageDuration,
      slowQueries: databaseMetrics.slowQueries,
      queriesByOperation,
    },
    externalServices: {
      callCount: externalServiceMetrics.callCount,
      averageDuration: externalServiceMetrics.averageDuration,
      errorCount: externalServiceMetrics.errorCount,
      servicesByName,
    },
    resources: {
      memory: {
        heapUsed: resourceMetrics.memoryUsage.heapUsed,
        heapTotal: resourceMetrics.memoryUsage.heapTotal,
        rss: resourceMetrics.memoryUsage.rss,
        external: resourceMetrics.memoryUsage.external,
      },
      cpu: {
        user: resourceMetrics.cpuUsage.user,
        system: resourceMetrics.cpuUsage.system,
      },
      uptime: resourceMetrics.uptime,
      loadAverage: resourceMetrics.loadAverage,
    },
    cache: {
      hitRate: cacheMetrics.hitRate,
      hitCount: cacheMetrics.hitCount,
      missCount: cacheMetrics.missCount,
      cachesByType,
    },
  };
}

/**
 * Get metrics health status
 */
async function getMetricsHealth(): Promise<{ healthy: boolean; details: Record<string, any> }> {
  const cloudWatchHealthy = await cloudWatchService.isHealthy();
  const resourceMetrics = applicationMetricsService.getResourceMetrics();

  // Check if memory usage is reasonable (< 90% of heap)
  const memoryHealthy =
    resourceMetrics.memoryUsage.heapUsed < resourceMetrics.memoryUsage.heapTotal * 0.9;

  // Check if there are recent metrics
  const responseTimeMetrics = applicationMetricsService.getResponseTimePercentiles();
  const metricsActive = responseTimeMetrics.count > 0;

  const healthy = cloudWatchHealthy && memoryHealthy;

  return {
    healthy,
    details: {
      cloudWatch: cloudWatchHealthy,
      memory: {
        healthy: memoryHealthy,
        heapUsed: resourceMetrics.memoryUsage.heapUsed,
        heapTotal: resourceMetrics.memoryUsage.heapTotal,
        usagePercent:
          (resourceMetrics.memoryUsage.heapUsed / resourceMetrics.memoryUsage.heapTotal) * 100,
      },
      metrics: {
        active: metricsActive,
        dataPoints: responseTimeMetrics.count,
      },
      uptime: resourceMetrics.uptime,
    },
  };
}

/**
 * Get Prometheus-formatted metrics
 */
async function getPrometheusMetrics(): Promise<string> {
  const responseTimeMetrics = applicationMetricsService.getResponseTimePercentiles();
  const throughputMetrics = applicationMetricsService.getThroughputMetrics();
  const errorMetrics = applicationMetricsService.getErrorRateMetrics();
  const resourceMetrics = applicationMetricsService.getResourceMetrics();
  const cacheMetrics = applicationMetricsService.getCacheMetrics();

  const lines: string[] = [];

  // Response time metrics
  lines.push('# HELP http_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE http_request_duration_ms histogram');
  lines.push(`http_request_duration_ms{quantile="0.5"} ${responseTimeMetrics.p50}`);
  lines.push(`http_request_duration_ms{quantile="0.95"} ${responseTimeMetrics.p95}`);
  lines.push(`http_request_duration_ms{quantile="0.99"} ${responseTimeMetrics.p99}`);

  // Throughput metrics
  lines.push('# HELP http_requests_per_second HTTP requests per second');
  lines.push('# TYPE http_requests_per_second gauge');
  lines.push(`http_requests_per_second ${throughputMetrics.requestsPerSecond}`);

  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${throughputMetrics.totalRequests}`);

  // Error rate metrics
  lines.push('# HELP http_error_rate HTTP error rate percentage');
  lines.push('# TYPE http_error_rate gauge');
  lines.push(`http_error_rate ${errorMetrics.errorRate}`);

  // Memory metrics
  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${resourceMetrics.memoryUsage.rss}`);

  lines.push('# HELP nodejs_heap_size_used_bytes Process heap space used in bytes');
  lines.push('# TYPE nodejs_heap_size_used_bytes gauge');
  lines.push(`nodejs_heap_size_used_bytes ${resourceMetrics.memoryUsage.heapUsed}`);

  lines.push('# HELP nodejs_heap_size_total_bytes Process heap space total in bytes');
  lines.push('# TYPE nodejs_heap_size_total_bytes gauge');
  lines.push(`nodejs_heap_size_total_bytes ${resourceMetrics.memoryUsage.heapTotal}`);

  // Process uptime
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${resourceMetrics.uptime}`);

  // Cache metrics
  lines.push('# HELP cache_hit_rate Cache hit rate percentage');
  lines.push('# TYPE cache_hit_rate gauge');
  lines.push(`cache_hit_rate ${cacheMetrics.hitRate}`);

  return lines.join('\n') + '\n';
}
