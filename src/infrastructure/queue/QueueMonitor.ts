/**
 * Queue Monitor Implementation
 *
 * Monitoring and alerting system for BullMQ queues with health checks,
 * performance metrics, and failure detection.
 */

import { EventEmitter } from 'events';

import { AlertingService } from '../../shared/services/AlertingService.js';
import { JobEventLogger } from '../../shared/services/JobEventLogger.js';
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
export class QueueMonitor extends EventEmitter implements QueueEventListener {
  private metrics = new Map<string, QueueMetrics>();
  private alerts: Alert[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private completionRates = new Map<string, { completed: number; failed: number; window: Date }>();
  private alertingService: AlertingService;
  private jobEventLogger: JobEventLogger;

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
    super();
    this.thresholds = { ...this.defaultThresholds, ...thresholds };
    this.alertingService = AlertingService.getInstance();
    this.jobEventLogger = JobEventLogger.getInstance();
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
    this.performHealthCheck().catch((error) => {
      logger.error('Initial health check failed:', error);
    });

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck().catch((error) => {
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
    this.alerts = this.alerts.filter((alert) => alert.timestamp > cutoff);
  }

  /**
   * Get job completion rates for all queues
   */
  public getCompletionRates(): Map<string, { rate: number; completed: number; failed: number }> {
    const rates = new Map<string, { rate: number; completed: number; failed: number }>();

    for (const [queueName, data] of this.completionRates.entries()) {
      const total = data.completed + data.failed;
      const rate = total > 0 ? data.completed / total : 1;

      rates.set(queueName, {
        rate,
        completed: data.completed,
        failed: data.failed,
      });
    }

    return rates;
  }

  /**
   * Get queue depths for monitoring
   */
  public async getQueueDepths(): Promise<
    Map<string, { waiting: number; active: number; total: number }>
  > {
    const depths = new Map();

    try {
      const queueStats = await this.queueFactory.getAllQueueStats();

      for (const stats of queueStats) {
        depths.set(stats.name, {
          waiting: stats.waiting,
          active: stats.active,
          total: stats.waiting + stats.active,
        });
      }
    } catch (error) {
      logger.error('Failed to get queue depths:', error);
    }

    return depths;
  }

  /**
   * Check for stuck jobs (jobs that have been active too long)
   */
  public async checkForStuckJobs(): Promise<void> {
    try {
      const queueStats = await this.queueFactory.getAllQueueStats();
      const thresholds = this.thresholds as HealthThresholds;

      for (const stats of queueStats) {
        // If there are active jobs but no recent completions, they might be stuck
        if (stats.active > 0) {
          const metrics = this.metrics.get(stats.name);
          if (metrics) {
            const timeSinceLastUpdate = Date.now() - metrics.lastUpdated.getTime();

            if (timeSinceLastUpdate > thresholds.maxProcessingTimeMs) {
              this.createAlert(
                'error',
                stats.name,
                `Potential stuck jobs detected: ${stats.active} active jobs with no recent updates`,
                {
                  activeJobs: stats.active,
                  timeSinceLastUpdate,
                  threshold: thresholds.maxProcessingTimeMs,
                }
              );

              // Send critical alert for stuck jobs
              this.alertingService.createAlert(
                'critical',
                'Stuck Jobs Detected',
                `Queue ${stats.name} has ${stats.active} jobs that appear to be stuck (no updates for ${Math.round(timeSinceLastUpdate / 60000)} minutes)`,
                `queue:${stats.name}`,
                {
                  activeJobs: stats.active,
                  timeSinceLastUpdate,
                  threshold: thresholds.maxProcessingTimeMs,
                }
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check for stuck jobs:', error);
    }
  }

  /**
   * Emit alert event for external listeners
   */
  private emitAlert(alert: Alert): void {
    this.emit('alert', alert);

    // Also emit specific severity events
    this.emit(`alert:${alert.severity}`, alert);

    // Log alert details for comprehensive job event logging
    logger.info('Queue alert emitted', {
      severity: alert.severity,
      queueName: alert.queueName,
      message: alert.message,
      timestamp: alert.timestamp,
      metadata: alert.metadata,
    });
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
        this.updateCompletionRates(stats);
      }

      // Check for stuck jobs
      await this.checkForStuckJobs();

      // Clean up old alerts and completion rate data
      this.clearOldAlerts();
      this.cleanupOldCompletionData();
    } catch (error) {
      logger.error('Health check failed:', error);
      this.createAlert('error', 'system', 'Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check individual queue health against thresholds
   */
  private checkQueueHealth(stats: QueueStats): void {
    const thresholds = this.thresholds as HealthThresholds;

    // Check waiting jobs (queue depth monitoring)
    if (stats.waiting > thresholds.maxWaitingJobs) {
      this.createAlert('warning', stats.name, `High queue depth: ${stats.waiting} waiting jobs`, {
        waiting: stats.waiting,
        threshold: thresholds.maxWaitingJobs,
      });

      // Send system alert
      this.alertingService.createAlert(
        'warning',
        'High Queue Depth',
        `Queue ${stats.name} has ${stats.waiting} waiting jobs (threshold: ${thresholds.maxWaitingJobs})`,
        `queue:${stats.name}`,
        { waiting: stats.waiting, threshold: thresholds.maxWaitingJobs }
      );
    }

    // Check failed jobs
    if (stats.failed > thresholds.maxFailedJobs) {
      this.createAlert('error', stats.name, `High number of failed jobs: ${stats.failed}`, {
        failed: stats.failed,
        threshold: thresholds.maxFailedJobs,
      });
    }

    // Check if queue is paused unexpectedly
    if (stats.paused) {
      this.createAlert('warning', stats.name, 'Queue is paused', { paused: true });
    }

    // Check completion rate (failure rate monitoring)
    const completionData = this.completionRates.get(stats.name);
    if (completionData) {
      const total = completionData.completed + completionData.failed;
      if (total > 10) {
        // Only check if we have enough data
        const failureRate = completionData.failed / total;
        const maxFailureRate = 1 - thresholds.minSuccessRate;

        if (failureRate > maxFailureRate) {
          this.createAlert(
            'error',
            stats.name,
            `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
            {
              failureRate,
              maxFailureRate,
              totalJobs: total,
              failedJobs: completionData.failed,
              completedJobs: completionData.completed,
            }
          );

          // Send critical system alert for high failure rates
          this.alertingService.createAlert(
            'error',
            'High Job Failure Rate',
            `Queue ${stats.name} has a ${(failureRate * 100).toFixed(1)}% failure rate (${completionData.failed}/${total} jobs failed)`,
            `queue:${stats.name}`,
            {
              failureRate,
              maxFailureRate,
              totalJobs: total,
              failedJobs: completionData.failed,
              completedJobs: completionData.completed,
            }
          );
        }
      }
    }

    // Check success rate from metrics
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
          failedJobs: metrics.failedJobs,
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
   * Update completion rates for tracking job success/failure
   */
  private updateCompletionRates(stats: QueueStats): void {
    const existing = this.completionRates.get(stats.name);
    const now = new Date();

    // Reset window every hour
    const shouldReset = !existing || now.getTime() - existing.window.getTime() > 3600000;

    if (shouldReset) {
      this.completionRates.set(stats.name, {
        completed: stats.completed,
        failed: stats.failed,
        window: now,
      });
    } else {
      // Update with delta
      const deltaCompleted = Math.max(0, stats.completed - (existing.completed || 0));
      const deltaFailed = Math.max(0, stats.failed - (existing.failed || 0));

      existing.completed += deltaCompleted;
      existing.failed += deltaFailed;
    }
  }

  /**
   * Clean up old completion rate data
   */
  private cleanupOldCompletionData(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    for (const [queueName, data] of this.completionRates.entries()) {
      if (data.window < cutoff) {
        this.completionRates.delete(queueName);
      }
    }
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

    // Emit alert event for external listeners
    this.emitAlert(alert);

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
    // Comprehensive job event logging with JobEventLogger
    this.jobEventLogger.logJobCompleted(data.queueName, data.jobId, data.result || {});

    const metrics = this.metrics.get(data.queueName);
    if (metrics) {
      // Update average processing time (simple moving average)
      const processingTime = Date.now() - data.timestamp.getTime();
      metrics.averageProcessingTimeMs = (metrics.averageProcessingTimeMs + processingTime) / 2;

      // Check for slow jobs
      const thresholds = this.thresholds as HealthThresholds;
      if (processingTime > thresholds.maxProcessingTimeMs) {
        this.createAlert('warning', data.queueName, `Slow job processing: ${processingTime}ms`, {
          jobId: data.jobId,
          processingTime,
          threshold: thresholds.maxProcessingTimeMs,
        });
      }
    }

    // Emit job completed event
    this.emit('job:completed', data);
  }

  /**
   * QueueEventListener implementation - Job failed
   */
  public onJobFailed(data: JobEventData): void {
    // Comprehensive job event logging with JobEventLogger
    if (data.error) {
      this.jobEventLogger.logJobFailed(data.queueName, data.jobId, data.error);
    }

    this.createAlert(
      'error',
      data.queueName,
      `Job failed: ${data.error?.message || 'Unknown error'}`,
      {
        jobId: data.jobId,
        error: data.error?.message,
        stack: data.error?.stack,
      }
    );

    // Emit job failed event
    this.emit('job:failed', data);
  }

  /**
   * QueueEventListener implementation - Job stalled
   */
  public onJobStalled(data: JobEventData): void {
    // Comprehensive job event logging with JobEventLogger
    this.jobEventLogger.logJobStalled(data.queueName, data.jobId);

    this.createAlert('warning', data.queueName, `Job stalled: ${data.jobId}`, {
      jobId: data.jobId,
    });

    // Emit job stalled event
    this.emit('job:stalled', data);
  }

  /**
   * QueueEventListener implementation - Job progress
   */
  public onJobProgress(data: JobEventData & { progress: number }): void {
    // Comprehensive job event logging with JobEventLogger
    this.jobEventLogger.logJobProgress(data.queueName, data.jobId, data.progress);

    // Emit job progress event
    this.emit('job:progress', data);
  }
}
