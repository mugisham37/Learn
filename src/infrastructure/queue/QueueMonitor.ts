/**
 * Queue Monitor Implementation
 * 
 * Monitoring and alerting system for BullMQ queues with health checks,
 * performance metrics, and failure detection.
 */

import { logger } from '../../shared/utils/logger.js';

import { QueueFactory } from './QueueFactory.js';
import { QueueStats, QueueEventListener, JobEventData } from './types.js';

/**
 * Queue health thresholds for alerting
 */
interface HealthThresholds {
  maxWaitingJobs: number;
  maxFailedJobs: number;
  maxStalledJobs: number;
  maxProcessingTimeMs: number;
  minSuccessRate: number;
}

/**
 * Queue performance metrics
 */
interface QueueMetrics {
  queueName: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTimeMs: number;
  successRate: number;
  lastUpdated: Date;
}

/**
 * Alert severity levels
 */
type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert interface
 */
interface Alert {
  severity: AlertSeverity;
  queueName: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Queue Monitor for health checks and alerting
 * 
 * Monitors queue performance, detects issues, and triggers alerts
 * based on configurable thresholds.
 */
export class QueueMonitor implements QueueEventListener {
  private metrics = new Map<string, QueueMetrics>();
  private alerts: Alert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  private readonly defaultThresholds: HealthThresholds = {
    maxWaitingJobs: 1000,
    maxFailedJobs: 100,
    maxStalledJobs: 10,
    maxProcessingTimeMs: 300000, // 5 minutes
    minSuccessRate: 0.95, // 95%
  };
  
  constructor(
    private readonly queueFactory: QueueFactory,
    private readonly thresholds: Partial<HealthThresholds> = {}
  ) {
    this.thresholds = { ...this.defaultThresholds, ...thresholds };
  }
  
  /**
   * Start monitoring all queues
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Queue monitoring is already running');
      return;
    }
    
    this.isMonitoring = true;
    
    // Initial health check
    this.performHealthCheck().catch(error => {
      logger.error('Initial health check failed:', error);
    });
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Periodic health check failed:', error);
      });
    }, intervalMs);
    
    logger.info(`Started queue monitoring with ${intervalMs}ms interval`);
  }
  
  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.isMonitoring = false;
    logger.info('Stopped queue monitoring');
  }
  
  /**
   * Get current queue metrics
   */
  public getMetrics(): QueueMetrics[] {
    return Array.from(this.metrics.values());
  }
  
  /**
   * Get recent alerts
   */
  public getAlerts(limit: number = 50): Alert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Clear old alerts
   */
  public clearOldAlerts(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }
  
  /**
   * Perform health check on all queues
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const queueStats = await this.queueFactory.getAllQueueStats();
      
      for (const stats of queueStats) {
        this.checkQueueHealth(stats);
        this.updateMetrics(stats);
      }
      
      // Clean up old alerts
      this.clearOldAlerts();
      
    } catch (error) {
      logger.error('Health check failed:', error);
      this.createAlert('error', 'system', 'Health check failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  /**
   * Check individual queue health against thresholds
   */
  private checkQueueHealth(stats: QueueStats): void {
    const thresholds = this.thresholds as HealthThresholds;
    
    // Check waiting jobs
    if (stats.waiting > thresholds.maxWaitingJobs) {
      this.createAlert(
        'warning',
        stats.name,
        `High number of waiting jobs: ${stats.waiting}`,
        { waiting: stats.waiting, threshold: thresholds.maxWaitingJobs }
      );
    }
    
    // Check failed jobs
    if (stats.failed > thresholds.maxFailedJobs) {
      this.createAlert(
        'error',
        stats.name,
        `High number of failed jobs: ${stats.failed}`,
        { failed: stats.failed, threshold: thresholds.maxFailedJobs }
      );
    }
    
    // Check if queue is paused unexpectedly
    if (stats.paused) {
      this.createAlert(
        'warning',
        stats.name,
        'Queue is paused',
        { paused: true }
      );
    }
    
    // Check success rate
    const metrics = this.metrics.get(stats.name);
    if (metrics && metrics.successRate < thresholds.minSuccessRate) {
      this.createAlert(
        'error',
        stats.name,
        `Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`,
        { 
          successRate: metrics.successRate, 
          threshold: thresholds.minSuccessRate,
          totalJobs: metrics.totalJobs,
          failedJobs: metrics.failedJobs
        }
      );
    }
  }
  
  /**
   * Update queue metrics
   */
  private updateMetrics(stats: QueueStats): void {
    const existing = this.metrics.get(stats.name);
    const totalJobs = stats.completed + stats.failed + stats.active + stats.waiting;
    
    const metrics: QueueMetrics = {
      queueName: stats.name,
      totalJobs,
      completedJobs: stats.completed,
      failedJobs: stats.failed,
      averageProcessingTimeMs: existing?.averageProcessingTimeMs || 0,
      successRate: totalJobs > 0 ? stats.completed / totalJobs : 1,
      lastUpdated: new Date(),
    };
    
    this.metrics.set(stats.name, metrics);
  }
  
  /**
   * Create and log an alert
   */
  private createAlert(
    severity: AlertSeverity,
    queueName: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const alert: Alert = {
      severity,
      queueName,
      message,
      timestamp: new Date(),
      metadata,
    };
    
    this.alerts.push(alert);
    
    // Log based on severity
    const logMessage = `Queue Alert [${severity.toUpperCase()}] ${queueName}: ${message}`;
    const logMetadata = { queueName, severity, ...metadata };
    
    switch (severity) {
      case 'critical':
      case 'error':
        logger.error(logMessage, logMetadata);
        break;
      case 'warning':
        logger.warn(logMessage, logMetadata);
        break;
      case 'info':
      default:
        logger.info(logMessage, logMetadata);
        break;
    }
    
    // Keep only recent alerts in memory
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }
  }
  
  /**
   * QueueEventListener implementation - Job completed
   */
  public onJobCompleted(data: JobEventData): void {
    const metrics = this.metrics.get(data.queueName);
    if (metrics) {
      // Update average processing time (simple moving average)
      const processingTime = Date.now() - data.timestamp.getTime();
      metrics.averageProcessingTimeMs = 
        (metrics.averageProcessingTimeMs + processingTime) / 2;
      
      // Check for slow jobs
      const thresholds = this.thresholds as HealthThresholds;
      if (processingTime > thresholds.maxProcessingTimeMs) {
        this.createAlert(
          'warning',
          data.queueName,
          `Slow job processing: ${processingTime}ms`,
          { 
            jobId: data.jobId, 
            processingTime,
            threshold: thresholds.maxProcessingTimeMs
          }
        );
      }
    }
  }
  
  /**
   * QueueEventListener implementation - Job failed
   */
  public onJobFailed(data: JobEventData): void {
    this.createAlert(
      'error',
      data.queueName,
      `Job failed: ${data.error?.message || 'Unknown error'}`,
      { 
        jobId: data.jobId,
        error: data.error?.message,
        stack: data.error?.stack
      }
    );
  }
  
  /**
   * QueueEventListener implementation - Job stalled
   */
  public onJobStalled(data: JobEventData): void {
    this.createAlert(
      'warning',
      data.queueName,
      `Job stalled: ${data.jobId}`,
      { jobId: data.jobId }
    );
  }
  
  /**
   * QueueEventListener implementation - Job progress
   */
  public onJobProgress(data: JobEventData & { progress: number }): void {
    // Log progress for long-running jobs
    if (data.progress % 25 === 0) { // Log at 25%, 50%, 75%, 100%
      logger.debug(`Job ${data.jobId} progress: ${data.progress}%`, {
        queueName: data.queueName,
        jobId: data.jobId,
        progress: data.progress
      });
    }
  }
}