/**
 * Health Check Utilities
 *
 * Comprehensive health checks for all infrastructure dependencies
 * including database, Redis, and Elasticsearch.
 *
 * Requirements: 17.1
 */

import { checkRedisHealth, checkSessionRedisHealth } from '../../infrastructure/cache/index.js';
import { checkDatabaseHealth } from '../../infrastructure/database/index.js';
import { checkElasticsearchHealth } from '../../infrastructure/search/index.js';
import { checkRateLimitHealth } from '../middleware/rateLimiting.js';

import { getConnectionHealth } from './connectionHealth.js';

/**
 * Check secrets manager health
 */
async function checkSecretsManagerHealth(): Promise<boolean> {
  try {
    const { secretsManager } = await import('../services/SecretsManager.js');
    return await secretsManager.healthCheck();
  } catch (error) {
    return false;
  }
}

/**
 * Check S3 health
 */
async function checkS3Health(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  bucketAccessible?: boolean;
}> {
  try {
    const { S3Service } = await import('../services/S3Service.js');
    const s3Service = new S3Service();
    return await s3Service.healthCheck();
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'S3 service initialization failed',
      bucketAccessible: false,
    };
  }
}

/**
 * Overall health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual service health check result
 */
export interface ServiceHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Complete system health check result
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    sessionRedis: ServiceHealth;
    elasticsearch: ServiceHealth;
    rateLimit: ServiceHealth;
    secretsManager: ServiceHealth;
    s3: ServiceHealth;
  };
  connectionPools?: {
    monitoring: boolean;
    writePool: {
      utilization: number;
      connections: number;
      waiting: number;
    };
    readPool: {
      utilization: number;
      connections: number;
      waiting: number;
    };
    recommendations: string[];
  };
  summary: {
    healthy: number;
    total: number;
    criticalFailures: string[];
  };
}

/**
 * Services that are critical for application functionality
 * If any of these fail, the overall status should be 'unhealthy'
 */
const CRITICAL_SERVICES = ['database', 'redis', 'secretsManager', 's3'] as const;

/**
 * Services that are important but not critical
 * If these fail, the overall status should be 'degraded'
 */
const NON_CRITICAL_SERVICES = ['sessionRedis', 'elasticsearch', 'rateLimit'] as const;

/**
 * Performs comprehensive health checks on all infrastructure dependencies
 */
export async function performSystemHealthCheck(): Promise<SystemHealth> {
  // Run all health checks in parallel for better performance
  const [
    databaseHealth,
    redisHealth,
    sessionRedisHealth,
    elasticsearchHealth,
    rateLimitHealth,
    secretsManagerHealth,
    s3Health,
  ] = await Promise.allSettled([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkSessionRedisHealth(),
    checkElasticsearchHealth(),
    checkRateLimitHealth(),
    checkSecretsManagerHealth(),
    checkS3Health(),
  ]);

  // Process database health check result
  const database: ServiceHealth =
    databaseHealth.status === 'fulfilled'
      ? {
          healthy: databaseHealth.value.healthy,
          latencyMs: databaseHealth.value.latencyMs,
          error: databaseHealth.value.error,
          details: {
            writePool: databaseHealth.value.writePool,
            readPool: databaseHealth.value.readPool,
          },
        }
      : {
          healthy: false,
          error:
            databaseHealth.reason instanceof Error
              ? databaseHealth.reason.message
              : 'Database health check failed',
        };

  // Process Redis health check result
  const redis: ServiceHealth =
    redisHealth.status === 'fulfilled'
      ? {
          healthy: redisHealth.value.healthy,
          latencyMs: redisHealth.value.latency,
          error: redisHealth.value.error,
        }
      : {
          healthy: false,
          error:
            redisHealth.reason instanceof Error
              ? redisHealth.reason.message
              : 'Redis health check failed',
        };

  // Process session Redis health check result
  const sessionRedis: ServiceHealth =
    sessionRedisHealth.status === 'fulfilled'
      ? {
          healthy: sessionRedisHealth.value.healthy,
          latencyMs: sessionRedisHealth.value.latency,
          error: sessionRedisHealth.value.error,
        }
      : {
          healthy: false,
          error:
            sessionRedisHealth.reason instanceof Error
              ? sessionRedisHealth.reason.message
              : 'Session Redis health check failed',
        };

  // Process Elasticsearch health check result
  const elasticsearch: ServiceHealth =
    elasticsearchHealth.status === 'fulfilled'
      ? {
          healthy: elasticsearchHealth.value.healthy,
          latencyMs: elasticsearchHealth.value.latencyMs,
          error: elasticsearchHealth.value.error,
          details: {
            cluster: elasticsearchHealth.value.cluster,
            indices: elasticsearchHealth.value.indices,
          },
        }
      : {
          healthy: false,
          error:
            elasticsearchHealth.reason instanceof Error
              ? elasticsearchHealth.reason.message
              : 'Elasticsearch health check failed',
        };

  // Process rate limiting health check result
  const rateLimit: ServiceHealth =
    rateLimitHealth.status === 'fulfilled'
      ? {
          healthy: rateLimitHealth.value.healthy,
          error: rateLimitHealth.value.error,
        }
      : {
          healthy: false,
          error:
            rateLimitHealth.reason instanceof Error
              ? rateLimitHealth.reason.message
              : 'Rate limiting health check failed',
        };

  // Process secrets manager health check result
  const secretsManager: ServiceHealth =
    secretsManagerHealth.status === 'fulfilled'
      ? {
          healthy: secretsManagerHealth.value,
          error: secretsManagerHealth.value ? undefined : 'Secrets manager health check failed',
        }
      : {
          healthy: false,
          error:
            secretsManagerHealth.reason instanceof Error
              ? secretsManagerHealth.reason.message
              : 'Secrets manager health check failed',
        };

  // Process S3 health check result
  const s3: ServiceHealth =
    s3Health.status === 'fulfilled'
      ? {
          healthy: s3Health.value.healthy,
          latencyMs: s3Health.value.latencyMs,
          error: s3Health.value.error,
          details: {
            bucketAccessible: s3Health.value.bucketAccessible,
          },
        }
      : {
          healthy: false,
          error:
            s3Health.reason instanceof Error ? s3Health.reason.message : 'S3 health check failed',
        };

  const services = {
    database,
    redis,
    sessionRedis,
    elasticsearch,
    rateLimit,
    secretsManager,
    s3,
  };

  // Calculate overall health status
  const healthyServices = Object.values(services).filter((service) => service.healthy);
  const totalServices = Object.keys(services).length;

  // Check for critical service failures
  const criticalFailures: string[] = [];
  for (const serviceName of CRITICAL_SERVICES) {
    if (!services[serviceName].healthy) {
      criticalFailures.push(serviceName);
    }
  }

  // Determine overall status
  let status: HealthStatus;
  if (criticalFailures.length > 0) {
    status = 'unhealthy';
  } else {
    // Check non-critical services
    const nonCriticalFailures = NON_CRITICAL_SERVICES.filter(
      (serviceName) => !services[serviceName].healthy
    );
    status = nonCriticalFailures.length > 0 ? 'degraded' : 'healthy';
  }

  // Get connection pool information if monitoring is enabled
  let connectionPools;
  try {
    if (process.env['ENABLE_CONNECTION_MONITORING'] === 'true') {
      const connectionHealth = await getConnectionHealth();
      connectionPools = {
        monitoring: connectionHealth.monitoring.enabled,
        writePool: {
          utilization: connectionHealth.database.writePool.utilization,
          connections: connectionHealth.database.writePool.totalConnections,
          waiting: connectionHealth.database.writePool.waitingClients,
        },
        readPool: {
          utilization: connectionHealth.database.readPool.utilization,
          connections: connectionHealth.database.readPool.totalConnections,
          waiting: connectionHealth.database.readPool.waitingClients,
        },
        recommendations: connectionHealth.monitoring.recommendations,
      };
    }
  } catch (error) {
    // Connection monitoring is optional, don't fail health check if it fails
    console.warn('Failed to get connection pool information:', error);
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    services,
    connectionPools,
    summary: {
      healthy: healthyServices.length,
      total: totalServices,
      criticalFailures,
    },
  };
}

/**
 * Performs a quick health check (basic connectivity only)
 * Useful for load balancer health checks where speed is important
 */
export async function performQuickHealthCheck(): Promise<{
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  latencyMs: number;
}> {
  const startTime = Date.now();

  try {
    // Just check if we can connect to critical services quickly
    const [databaseResult, redisResult, s3Result] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkS3Health(),
    ]);

    const databaseHealthy = databaseResult.status === 'fulfilled' && databaseResult.value.healthy;
    const redisHealthy = redisResult.status === 'fulfilled' && redisResult.value.healthy;
    const s3Healthy = s3Result.status === 'fulfilled' && s3Result.value.healthy;

    const status = databaseHealthy && redisHealthy && s3Healthy ? 'ok' : 'error';
    const latencyMs = Date.now() - startTime;

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Gets service readiness status
 * Used for Kubernetes readiness probes
 */
export async function checkReadiness(): Promise<{
  ready: boolean;
  services: string[];
  notReady: string[];
}> {
  const health = await performSystemHealthCheck();

  const readyServices: string[] = [];
  const notReadyServices: string[] = [];

  Object.entries(health.services).forEach(([serviceName, serviceHealth]) => {
    if (serviceHealth.healthy) {
      readyServices.push(serviceName);
    } else {
      notReadyServices.push(serviceName);
    }
  });

  // Application is ready if all critical services are healthy
  const ready = health.summary.criticalFailures.length === 0;

  return {
    ready,
    services: readyServices,
    notReady: notReadyServices,
  };
}

/**
 * Gets service liveness status
 * Used for Kubernetes liveness probes
 */
export function checkLiveness(): {
  alive: boolean;
  uptime: number;
  timestamp: string;
} {
  // Liveness is simpler - just check if the process is running
  // and can perform basic operations
  try {
    const uptime = process.uptime();

    // If we can get uptime and current time, we're alive
    return {
      alive: true,
      uptime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      alive: false,
      uptime: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
