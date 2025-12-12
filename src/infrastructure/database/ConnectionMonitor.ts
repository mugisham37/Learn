/**
 * Database Connection Monitor
 * 
 * Monitors database connection pools for usage patterns, leaks, and performance.
 * Provides metrics and alerts for connection pool optimization.
 * 
 * Requirements: 15.7
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

export interface ConnectionMetrics {
  timestamp: Date;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  poolSize: number;
  utilizationPercentage: number;
}

export interface ConnectionAlert {
  type: 'HIGH_UTILIZATION' | 'CONNECTION_LEAK' | 'LONG_WAIT_TIME' | 'POOL_EXHAUSTION';
  message: string;
  timestamp: Date;
  metrics: ConnectionMetrics;
}

export interface MonitoringConfig {
  // Thresholds for alerts
  highUtilizationThreshold: number; // Percentage (default: 80%)
  longWaitTimeThreshold: number; // Milliseconds (default: 5000ms)
  leakDetectionWindow: number; // Minutes (default: 10 minutes)
  metricsCollectionInterval: number; // Milliseconds (default: 30 seconds)
  
  // Alert settings
  enableAlerts: boolean;
  alertCooldown: number; // Milliseconds between same alert types
}

export class ConnectionMonitor extends EventEmitter {
  private writePool: Pool | null = null;
  private readPool: Pool | null = null;
  private config: MonitoringConfig;
  private metricsHistory: Map<string, ConnectionMetrics[]> = new Map();
  private lastAlerts: Map<string, Date> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      highUtilizationThreshold: 80,
      longWaitTimeThreshold: 5000,
      leakDetectionWindow: 10,
      metricsCollectionInterval: 30000,
      enableAlerts: true,
      alertCooldown: 300000, // 5 minutes
      ...config,
    };
  }

  /**
   * Initialize monitoring for connection pools
   */
  public initialize(writePool: Pool, readPool: Pool): void {
    this.writePool = writePool;
    this.readPool = readPool;
    
    // Initialize metrics history
    this.metricsHistory.set('write', []);
    this.metricsHistory.set('read', []);
    
    console.log('Connection monitor initialized');
  }

  /**
   * Start monitoring connection pools
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Connection monitoring is already running');
      return;
    }

    if (!this.writePool || !this.readPool) {
      throw new Error('Connection pools must be initialized before starting monitoring');
    }

    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    console.log(`Connection monitoring started with ${this.config.metricsCollectionInterval}ms interval`);
  }

  /**
   * Stop monitoring connection pools
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('Connection monitoring stopped');
  }

  /**
   * Collect current metrics from both pools
   */
  private collectMetrics(): void {
    if (!this.writePool || !this.readPool) return;

    const writeMetrics = this.getPoolMetrics(this.writePool, 'write');
    const readMetrics = this.getPoolMetrics(this.readPool, 'read');

    // Store metrics in history
    this.addMetricsToHistory('write', writeMetrics);
    this.addMetricsToHistory('read', readMetrics);

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkForAlerts('write', writeMetrics);
      this.checkForAlerts('read', readMetrics);
    }

    // Emit metrics event
    this.emit('metrics', { write: writeMetrics, read: readMetrics });
  }

  /**
   * Get metrics for a specific pool
   */
  private getPoolMetrics(pool: Pool, poolName: string): ConnectionMetrics {
    const totalConnections = pool.totalCount;
    const idleConnections = pool.idleCount;
    const waitingClients = pool.waitingCount;
    const poolSize = pool.options.max || 20;
    const utilizationPercentage = (totalConnections / poolSize) * 100;

    return {
      timestamp: new Date(),
      totalConnections,
      idleConnections,
      waitingClients,
      poolSize,
      utilizationPercentage,
    };
  }

  /**
   * Add metrics to history and maintain window size
   */
  private addMetricsToHistory(poolName: string, metrics: ConnectionMetrics): void {
    const history = this.metricsHistory.get(poolName) || [];
    history.push(metrics);

    // Keep only metrics within the leak detection window
    const cutoffTime = new Date(Date.now() - this.config.leakDetectionWindow * 60 * 1000);
    const filteredHistory = history.filter(m => m.timestamp > cutoffTime);
    
    this.metricsHistory.set(poolName, filteredHistory);
  }

  /**
   * Check for various alert conditions
   */
  private checkForAlerts(poolName: string, metrics: ConnectionMetrics): void {
    // High utilization alert
    if (metrics.utilizationPercentage > this.config.highUtilizationThreshold) {
      this.emitAlert('HIGH_UTILIZATION', {
        type: 'HIGH_UTILIZATION',
        message: `${poolName} pool utilization is ${metrics.utilizationPercentage.toFixed(1)}% (threshold: ${this.config.highUtilizationThreshold}%)`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Long wait time alert
    if (metrics.waitingClients > 0) {
      this.emitAlert('LONG_WAIT_TIME', {
        type: 'LONG_WAIT_TIME',
        message: `${poolName} pool has ${metrics.waitingClients} waiting clients`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Pool exhaustion alert
    if (metrics.totalConnections >= metrics.poolSize && metrics.waitingClients > 0) {
      this.emitAlert('POOL_EXHAUSTION', {
        type: 'POOL_EXHAUSTION',
        message: `${poolName} pool is exhausted (${metrics.totalConnections}/${metrics.poolSize} connections, ${metrics.waitingClients} waiting)`,
        timestamp: new Date(),
        metrics,
      });
    }

    // Connection leak detection
    this.checkForConnectionLeaks(poolName, metrics);
  }

  /**
   * Detect potential connection leaks
   */
  private checkForConnectionLeaks(poolName: string, currentMetrics: ConnectionMetrics): void {
    const history = this.metricsHistory.get(poolName) || [];
    
    if (history.length < 5) return; // Need enough data points

    // Check if connections are consistently high with low idle count
    const recentMetrics = history.slice(-5);
    const avgUtilization = recentMetrics.reduce((sum, m) => sum + m.utilizationPercentage, 0) / recentMetrics.length;
    const avgIdleRatio = recentMetrics.reduce((sum, m) => sum + (m.idleConnections / m.totalConnections), 0) / recentMetrics.length;

    // Potential leak: high utilization with very few idle connections over time
    if (avgUtilization > 70 && avgIdleRatio < 0.2 && currentMetrics.totalConnections > currentMetrics.poolSize * 0.8) {
      this.emitAlert('CONNECTION_LEAK', {
        type: 'CONNECTION_LEAK',
        message: `Potential connection leak detected in ${poolName} pool (avg utilization: ${avgUtilization.toFixed(1)}%, avg idle ratio: ${(avgIdleRatio * 100).toFixed(1)}%)`,
        timestamp: new Date(),
        metrics: currentMetrics,
      });
    }
  }

  /**
   * Emit alert with cooldown logic
   */
  private emitAlert(alertType: string, alert: ConnectionAlert): void {
    const lastAlert = this.lastAlerts.get(alertType);
    const now = new Date();

    // Check cooldown
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.config.alertCooldown) {
      return; // Still in cooldown period
    }

    this.lastAlerts.set(alertType, now);
    this.emit('alert', alert);
    
    // Log alert
    console.warn(`[Connection Monitor Alert] ${alert.message}`);
  }

  /**
   * Get current metrics for both pools
   */
  public getCurrentMetrics(): { write: ConnectionMetrics | null; read: ConnectionMetrics | null } {
    if (!this.writePool || !this.readPool) {
      return { write: null, read: null };
    }

    return {
      write: this.getPoolMetrics(this.writePool, 'write'),
      read: this.getPoolMetrics(this.readPool, 'read'),
    };
  }

  /**
   * Get metrics history for a specific pool
   */
  public getMetricsHistory(poolName: 'write' | 'read', minutes: number = 60): ConnectionMetrics[] {
    const history = this.metricsHistory.get(poolName) || [];
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    return history.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Get connection pool statistics summary
   */
  public getPoolStatistics(poolName: 'write' | 'read'): {
    current: ConnectionMetrics | null;
    averageUtilization: number;
    peakUtilization: number;
    totalAlerts: number;
    lastAlert: Date | null;
  } {
    const current = poolName === 'write' 
      ? (this.writePool ? this.getPoolMetrics(this.writePool, 'write') : null)
      : (this.readPool ? this.getPoolMetrics(this.readPool, 'read') : null);

    const history = this.metricsHistory.get(poolName) || [];
    
    const averageUtilization = history.length > 0
      ? history.reduce((sum, m) => sum + m.utilizationPercentage, 0) / history.length
      : 0;

    const peakUtilization = history.length > 0
      ? Math.max(...history.map(m => m.utilizationPercentage))
      : 0;

    // Count alerts in the last hour (simplified)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = Array.from(this.lastAlerts.values()).filter(date => date > oneHourAgo);

    return {
      current,
      averageUtilization,
      peakUtilization,
      totalAlerts: recentAlerts.length,
      lastAlert: recentAlerts.length > 0 ? Math.max(...recentAlerts.map(d => d.getTime())) as any : null,
    };
  }

  /**
   * Force a connection pool analysis
   */
  public analyzeConnectionPools(): {
    write: ReturnType<ConnectionMonitor['getPoolStatistics']>;
    read: ReturnType<ConnectionMonitor['getPoolStatistics']>;
    recommendations: string[];
  } {
    const writeStats = this.getPoolStatistics('write');
    const readStats = this.getPoolStatistics('read');
    const recommendations: string[] = [];

    // Generate recommendations based on statistics
    if (writeStats.averageUtilization > 80) {
      recommendations.push('Consider increasing write pool size - high average utilization detected');
    }

    if (readStats.averageUtilization > 80) {
      recommendations.push('Consider increasing read pool size - high average utilization detected');
    }

    if (writeStats.peakUtilization > 95) {
      recommendations.push('Write pool frequently reaches capacity - consider increasing max connections');
    }

    if (readStats.peakUtilization > 95) {
      recommendations.push('Read pool frequently reaches capacity - consider increasing max connections');
    }

    if (writeStats.totalAlerts > 10) {
      recommendations.push('High number of write pool alerts - investigate connection usage patterns');
    }

    if (readStats.totalAlerts > 10) {
      recommendations.push('High number of read pool alerts - investigate connection usage patterns');
    }

    if (recommendations.length === 0) {
      recommendations.push('Connection pools are operating within normal parameters');
    }

    return {
      write: writeStats,
      read: readStats,
      recommendations,
    };
  }
}

/**
 * Global connection monitor instance
 */
export const connectionMonitor = new ConnectionMonitor();