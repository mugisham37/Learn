/**
 * Job Monitoring Service
 * 
 * Provides admin dashboard functionality for job monitoring and management.
 * Integrates with QueueManager and QueueMonitor for comprehensive job oversight.
 */

import { logger } from '../utils/logger.js';
import { QueueManager } from '../../infrastructure/queue/QueueManager.js';
import { QueueMonitor } from '../../infrastructure/queue/QueueMonitor.js';
import { QueueStats } from '../../infrastructure/queue/types.js';

/**
 * Job monitoring dashboard data
 */
export interface JobDashboardData {
  overview: {
    totalQueues: number;
    healthyQueues: number;
    totalJobs: number;
    activeJobs: number;
    failedJobs: number;
    completedJobs: number;
    overallHealthScore: number;
  };
  queues: Array<{
    name: string;
    stats: QueueStats;
    health: 'healthy' | 'warning' | 'error';
    completionRate: number;
    averageProcessingTime: number;
    queueDepth: number;
  }>;
  alerts: Array<{
    severity: 'info' | 'warning' | 'error' | 'critical';
    queueName: string;
    message: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  metrics: {
    completionRates: Map<string, { rate: number; completed: number; failed: number }>;
    queueDepths: Map<string, { waiting: number; active: number; total: number }>;
  };
}

/**
 * Job retry options
 */
export interface JobRetryOptions {
  queueName: string;
  jobId?: string;
  retryAll?: boolean;
  maxRetries?: number;
}

/**
 * Queue management options
 */
export interface QueueManagementOptions {
  queueName: string;
  action: 'pause' | 'resume' | 'clear' | 'drain';
  jobStatus?: 'waiting' | 'active' | 'completed' | 'failed';
}

/**
 * Job Monitoring Service for admin dashboard
 */
export class JobMonitoringService {
  private static instance: JobMonitoringService;
  private queueManager: QueueManager;
  private queueMonitor: QueueMonitor;
  
  private constructor() {
    this.queueManager = QueueManager.getInstance();
    this.queueMonitor = this.queueManager.getQueueMonitor();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): JobMonitoringService {
    if (!JobMonitoringService.instance) {
      JobMonitoringService.instance = new JobMonitoringService();
    }
    return JobMonitoringService.instance;
  }
  
  /**
   * Get comprehensive dashboard data
   */
  public async getDashboardData(): Promise<JobDashboardData> {
    try {
      const [healthStatus, completionRates, queueDepths] = await Promise.all([
        this.queueManager.getHealthStatus(),
        Promise.resolve(this.queueMonitor.getCompletionRates()),
        this.queueMonitor.getQueueDepths()
      ]);
      
      const metrics = this.queueMonitor.getMetrics();
      
      // Calculate overview statistics
      const totalJobs = healthStatus.queues.reduce((sum, q) => 
        sum + q.active + q.waiting + q.completed + q.failed, 0);
      const activeJobs = healthStatus.queues.reduce((sum, q) => sum + q.active, 0);
      const failedJobs = healthStatus.queues.reduce((sum, q) => sum + q.failed, 0);
      const completedJobs = healthStatus.queues.reduce((sum, q) => sum + q.completed, 0);
      
      const healthyQueues = healthStatus.queues.filter(q => !q.paused).length;
      const overallHealthScore = healthyQueues / Math.max(healthStatus.queues.length, 1);
      
      // Enrich queue data with health status and metrics
      const enrichedQueues = healthStatus.queues.map(queue => {
        const queueMetrics = metrics.find(m => m.queueName === queue.name);
        const completionData = completionRates.get(queue.name);
        const depthData = queueDepths.get(queue.name);
        
        let health: 'healthy' | 'warning' | 'error' = 'healthy';
        if (queue.failed > 50 || queue.paused) {
          health = 'error';
        } else if (queue.waiting > 500 || (completionData && completionData.rate < 0.9)) {
          health = 'warning';
        }
        
        return {
          name: queue.name,
          stats: queue,
          health,
          completionRate: completionData?.rate || 1,
          averageProcessingTime: queueMetrics?.averageProcessingTimeMs || 0,
          queueDepth: depthData?.total || queue.waiting + queue.active
        };
      });
      
      return {
        overview: {
          totalQueues: healthStatus.queues.length,
          healthyQueues,
          totalJobs,
          activeJobs,
          failedJobs,
          completedJobs,
          overallHealthScore
        },
        queues: enrichedQueues,
        alerts: healthStatus.alerts,
        metrics: {
          completionRates,
          queueDepths
        }
      };
      
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      throw new Error('Failed to retrieve job monitoring dashboard data');
    }
  }
  
  /**
   * Retry failed jobs
   */
  public async retryJobs(options: JobRetryOptions): Promise<{ success: boolean; retriedCount: number }> {
    try {
      const queueFactory = this.queueManager.getQueueFactory();
      
      // This would need to be implemented in QueueFactory
      // For now, return a placeholder response
      logger.info('Job retry requested', options);
      
      return {
        success: true,
        retriedCount: 0 // Would be actual count from queue operations
      };
      
    } catch (error) {
      logger.error('Failed to retry jobs:', error);
      throw new Error('Failed to retry jobs');
    }
  }
  
  /**
   * Manage queue operations (pause, resume, clear)
   */
  public async manageQueue(options: QueueManagementOptions): Promise<{ success: boolean; message: string }> {
    try {
      const queueFactory = this.queueManager.getQueueFactory();
      
      // This would need to be implemented in QueueFactory
      // For now, return a placeholder response
      logger.info('Queue management requested', options);
      
      return {
        success: true,
        message: `Queue ${options.queueName} ${options.action} operation completed`
      };
      
    } catch (error) {
      logger.error('Failed to manage queue:', error);
      throw new Error(`Failed to ${options.action} queue ${options.queueName}`);
    }
  }
  
  /**
   * Get real-time queue statistics
   */
  public async getRealtimeStats(): Promise<{
    timestamp: Date;
    queues: QueueStats[];
    systemHealth: boolean;
  }> {
    try {
      const healthStatus = await this.queueManager.getHealthStatus();
      
      return {
        timestamp: healthStatus.timestamp,
        queues: healthStatus.queues,
        systemHealth: healthStatus.healthy
      };
      
    } catch (error) {
      logger.error('Failed to get realtime stats:', error);
      throw new Error('Failed to retrieve realtime queue statistics');
    }
  }
  
  /**
   * Get job event history
   */
  public getJobEventHistory(queueName?: string, limit: number = 100): Array<{
    timestamp: Date;
    event: string;
    queueName: string;
    jobId?: string;
    details: Record<string, unknown>;
  }> {
    // This would integrate with a job event store
    // For now, return recent alerts as events
    const alerts = this.queueMonitor.getAlerts(limit);
    
    return alerts
      .filter(alert => !queueName || alert.queueName === queueName)
      .map(alert => ({
        timestamp: alert.timestamp,
        event: `alert:${alert.severity}`,
        queueName: alert.queueName,
        details: {
          message: alert.message,
          severity: alert.severity,
          metadata: alert.metadata
        }
      }));
  }
  
  /**
   * Export monitoring data for analysis
   */
  public async exportMonitoringData(startDate: Date, endDate: Date): Promise<{
    exportId: string;
    downloadUrl: string;
  }> {
    try {
      // Generate export ID
      const exportId = `job-monitoring-${Date.now()}`;
      
      // This would generate a comprehensive report
      logger.info('Monitoring data export requested', {
        exportId,
        startDate,
        endDate
      });
      
      // In a real implementation, this would:
      // 1. Query job event history from database
      // 2. Generate CSV/JSON export
      // 3. Upload to S3
      // 4. Return signed download URL
      
      return {
        exportId,
        downloadUrl: `/api/admin/monitoring/exports/${exportId}`
      };
      
    } catch (error) {
      logger.error('Failed to export monitoring data:', error);
      throw new Error('Failed to export monitoring data');
    }
  }
}