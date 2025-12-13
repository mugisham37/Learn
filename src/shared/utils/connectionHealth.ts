/**
 * Connection Health Utilities
 *
 * Provides health check utilities for database connections and connection pools
 * with detailed metrics and monitoring capabilities.
 *
 * Requirements: 15.7, 17.1
 */

import { checkDatabaseHealth, getConnectionMonitor } from '../../infrastructure/database/index.js';

export interface ConnectionHealthStatus {
  healthy: boolean;
  timestamp: Date;
  database: {
    healthy: boolean;
    writePool: {
      connected: boolean;
      utilization: number;
      totalConnections: number;
      idleConnections: number;
      waitingClients: number;
    };
    readPool: {
      connected: boolean;
      utilization: number;
      totalConnections: number;
      idleConnections: number;
      waitingClients: number;
    };
    latencyMs?: number;
    error?: string;
  };
  monitoring: {
    enabled: boolean;
    alerts: {
      total: number;
      recent: number;
    };
    recommendations: string[];
  };
  pgbouncer?: {
    enabled: boolean;
    status: 'healthy' | 'unhealthy' | 'unknown';
  };
}

/**
 * Comprehensive connection health check
 */
export async function getConnectionHealth(): Promise<ConnectionHealthStatus> {
  const timestamp = new Date();

  // Get database health
  const dbHealth = await checkDatabaseHealth();

  // Get connection monitor data
  const monitor = getConnectionMonitor();
  const analysis = monitor.analyzeConnectionPools();

  // Calculate utilization percentages
  const writeUtilization =
    dbHealth.writePool.totalConnections > 0
      ? (dbHealth.writePool.totalConnections /
          (dbHealth.writePool.totalConnections + dbHealth.writePool.idleConnections)) *
        100
      : 0;

  const readUtilization =
    dbHealth.readPool.totalConnections > 0
      ? (dbHealth.readPool.totalConnections /
          (dbHealth.readPool.totalConnections + dbHealth.readPool.idleConnections)) *
        100
      : 0;

  const status: ConnectionHealthStatus = {
    healthy: dbHealth.healthy,
    timestamp,
    database: {
      healthy: dbHealth.healthy,
      writePool: {
        connected: dbHealth.writePool.connected,
        utilization: writeUtilization,
        totalConnections: dbHealth.writePool.totalConnections,
        idleConnections: dbHealth.writePool.idleConnections,
        waitingClients: dbHealth.writePool.waitingClients,
      },
      readPool: {
        connected: dbHealth.readPool.connected,
        utilization: readUtilization,
        totalConnections: dbHealth.readPool.totalConnections,
        idleConnections: dbHealth.readPool.idleConnections,
        waitingClients: dbHealth.readPool.waitingClients,
      },
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error,
    },
    monitoring: {
      enabled: true, // Monitoring is always enabled in this implementation
      alerts: {
        total: analysis.write.totalAlerts + analysis.read.totalAlerts,
        recent: analysis.write.totalAlerts + analysis.read.totalAlerts, // Simplified for now
      },
      recommendations: analysis.recommendations,
    },
  };

  // Check PgBouncer status if enabled
  if (process.env['USE_PGBOUNCER'] === 'true') {
    status.pgbouncer = {
      enabled: true,
      status: await checkPgBouncerHealth(),
    };
  }

  return status;
}

/**
 * Check PgBouncer health status
 */
async function checkPgBouncerHealth(): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  try {
    // This would typically involve connecting to PgBouncer admin interface
    // For now, we'll do a simple connection test
    const { Pool } = await import('pg');
    const pgBouncerUrl = process.env['PGBOUNCER_URL'];

    if (!pgBouncerUrl) {
      return 'unknown';
    }

    const pool = new Pool({
      connectionString: pgBouncerUrl,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      return 'healthy';
    } catch (error) {
      await pool.end();
      return 'unhealthy';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get simplified health status for basic health checks
 */
export async function getBasicConnectionHealth(): Promise<{
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  try {
    const health = await getConnectionHealth();

    if (health.healthy) {
      return {
        healthy: true,
        message: 'All database connections are healthy',
        details: {
          writePool: health.database.writePool.connected,
          readPool: health.database.readPool.connected,
          latency: health.database.latencyMs,
        },
      };
    } else {
      return {
        healthy: false,
        message: health.database.error || 'Database connection issues detected',
        details: health.database,
      };
    }
  } catch (error) {
    return {
      healthy: false,
      message: 'Health check failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Connection pool performance metrics
 */
export interface PoolPerformanceMetrics {
  writePool: {
    averageUtilization: number;
    peakUtilization: number;
    currentConnections: number;
    maxConnections: number;
    waitingClients: number;
    connectionEstablishmentTime?: number;
  };
  readPool: {
    averageUtilization: number;
    peakUtilization: number;
    currentConnections: number;
    maxConnections: number;
    waitingClients: number;
    connectionEstablishmentTime?: number;
  };
  recommendations: string[];
  lastUpdated: Date;
}

/**
 * Get detailed performance metrics for connection pools
 */
export function getPoolPerformanceMetrics(): PoolPerformanceMetrics {
  const monitor = getConnectionMonitor();
  const analysis = monitor.analyzeConnectionPools();
  const currentMetrics = monitor.getCurrentMetrics();

  return {
    writePool: {
      averageUtilization: analysis.write.averageUtilization,
      peakUtilization: analysis.write.peakUtilization,
      currentConnections: currentMetrics.write?.totalConnections || 0,
      maxConnections: currentMetrics.write?.poolSize || 0,
      waitingClients: currentMetrics.write?.waitingClients || 0,
    },
    readPool: {
      averageUtilization: analysis.read.averageUtilization,
      peakUtilization: analysis.read.peakUtilization,
      currentConnections: currentMetrics.read?.totalConnections || 0,
      maxConnections: currentMetrics.read?.poolSize || 0,
      waitingClients: currentMetrics.read?.waitingClients || 0,
    },
    recommendations: analysis.recommendations,
    lastUpdated: new Date(),
  };
}
