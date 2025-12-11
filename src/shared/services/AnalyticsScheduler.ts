/**
 * Analytics Scheduler Implementation
 * 
 * Implements scheduled analytics jobs using node-cron for timing and BullMQ for execution.
 * Schedules hourly real-time metrics, daily course/student analytics, weekly trend reports,
 * and monthly executive summaries according to requirements.
 * 
 * Requirements:
 * - 12.5: Scheduled analytics aggregation (hourly, daily, weekly, monthly)
 * - 14.3: Analytics aggregation on cron triggers
 * - 14.7: Scheduled tasks execution (daily at midnight UTC, weekly on Sunday, monthly on 1st)
 */

import * as cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { getAnalyticsQueue, initializeAnalyticsQueue } from './AnalyticsQueue.js';
import { AnalyticsService } from '../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../modules/analytics/application/services/MetricsCalculator.js';
import type { DateRange } from '../types/index.js';

/**
 * Scheduler configuration interface
 */
export interface SchedulerConfig {
  enableHourlyMetrics: boolean;
  enableDailyAnalytics: boolean;
  enableWeeklyReports: boolean;
  enableMonthlyReports: boolean;
  timezone: string;
}

/**
 * Default scheduler configuration
 */
const DEFAULT_CONFIG: SchedulerConfig = {
  enableHourlyMetrics: true,
  enableDailyAnalytics: true,
  enableWeeklyReports: true,
  enableMonthlyReports: true,
  timezone: 'UTC',
};

/**
 * Analytics Scheduler Implementation
 * 
 * Manages scheduled analytics jobs using node-cron for timing coordination
 * and BullMQ for reliable job execution. Provides comprehensive scheduling
 * for all analytics aggregation requirements.
 */
export class AnalyticsScheduler {
  private config: SchedulerConfig;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isInitialized: boolean = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the scheduler with analytics services
   */
  async initialize(analyticsService: AnalyticsService, metricsCalculator: MetricsCalculator): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Analytics scheduler already initialized');
      return;
    }

    try {
      // Initialize the analytics queue
      await initializeAnalyticsQueue(analyticsService, metricsCalculator);

      // Schedule all analytics jobs
      await this.scheduleAllJobs();

      this.isInitialized = true;
      logger.info('Analytics scheduler initialized successfully', {
        config: this.config,
        scheduledTasks: Array.from(this.scheduledTasks.keys()),
      });
    } catch (error) {
      logger.error('Failed to initialize analytics scheduler', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Schedule all analytics jobs based on configuration
   */
  private async scheduleAllJobs(): Promise<void> {
    // Schedule hourly real-time metrics (every hour at minute 0)
    if (this.config.enableHourlyMetrics) {
      this.scheduleHourlyMetrics();
    }

    // Schedule daily analytics (every day at midnight UTC)
    if (this.config.enableDailyAnalytics) {
      this.scheduleDailyAnalytics();
    }

    // Schedule weekly trend reports (every Sunday at 1 AM UTC)
    if (this.config.enableWeeklyReports) {
      this.scheduleWeeklyReports();
    }

    // Schedule monthly executive summaries (1st of every month at 2 AM UTC)
    if (this.config.enableMonthlyReports) {
      this.scheduleMonthlyReports();
    }

    // Schedule daily cleanup (every day at 3 AM UTC)
    this.scheduleDailyCleanup();

    logger.info('All analytics jobs scheduled successfully', {
      totalJobs: this.scheduledTasks.size,
    });
  }

  /**
   * Schedule hourly real-time metrics job
   * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
   */
  private scheduleHourlyMetrics(): void {
    const task = cron.schedule(
      '0 * * * *', // Every hour at minute 0
      async () => {
        try {
          logger.info('Starting scheduled hourly real-time metrics job');
          const analyticsQueue = getAnalyticsQueue();
          const jobId = await analyticsQueue.queueRealTimeMetrics();
          
          logger.info('Hourly real-time metrics job scheduled successfully', { jobId });
        } catch (error) {
          logger.error('Failed to schedule hourly real-time metrics job', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set('hourly-metrics', task);

    logger.info('Hourly real-time metrics job scheduled', {
      cron: '0 * * * *',
      timezone: this.config.timezone,
    });
  }

  /**
   * Schedule daily analytics jobs
   * Runs every day at midnight UTC
   */
  private scheduleDailyAnalytics(): void {
    const task = cron.schedule(
      '0 0 * * *', // Every day at midnight
      async () => {
        try {
          logger.info('Starting scheduled daily analytics jobs');
          const analyticsQueue = getAnalyticsQueue();
          
          // Queue course analytics job
          const courseJobId = await analyticsQueue.queueCourseAnalytics();
          logger.info('Daily course analytics job scheduled', { jobId: courseJobId });
          
          // Queue student analytics job
          const studentJobId = await analyticsQueue.queueStudentAnalytics();
          logger.info('Daily student analytics job scheduled', { jobId: studentJobId });
          
          logger.info('Daily analytics jobs scheduled successfully', {
            courseJobId,
            studentJobId,
          });
        } catch (error) {
          logger.error('Failed to schedule daily analytics jobs', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set('daily-analytics', task);

    logger.info('Daily analytics jobs scheduled', {
      cron: '0 0 * * *',
      timezone: this.config.timezone,
    });
  }

  /**
   * Schedule weekly trend reports
   * Runs every Sunday at 1 AM UTC
   */
  private scheduleWeeklyReports(): void {
    const task = cron.schedule(
      '0 1 * * 0', // Every Sunday at 1 AM
      async () => {
        try {
          logger.info('Starting scheduled weekly trend reports job');
          const analyticsQueue = getAnalyticsQueue();
          
          // Calculate date range for the past week
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          const dateRange: DateRange = { startDate, endDate };
          
          // Define report types to generate
          const reportTypes = [
            'enrollments',
            'completions',
            'quiz_attempts',
            'discussion_posts',
          ];
          
          const jobId = await analyticsQueue.queueTrendReports(dateRange, reportTypes);
          
          logger.info('Weekly trend reports job scheduled successfully', {
            jobId,
            dateRange,
            reportTypes,
          });
        } catch (error) {
          logger.error('Failed to schedule weekly trend reports job', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set('weekly-reports', task);

    logger.info('Weekly trend reports job scheduled', {
      cron: '0 1 * * 0',
      timezone: this.config.timezone,
    });
  }

  /**
   * Schedule monthly executive summaries
   * Runs on the 1st of every month at 2 AM UTC
   */
  private scheduleMonthlyReports(): void {
    const task = cron.schedule(
      '0 2 1 * *', // 1st of every month at 2 AM
      async () => {
        try {
          logger.info('Starting scheduled monthly executive summary job');
          const analyticsQueue = getAnalyticsQueue();
          
          // Calculate date range for the past month
          const endDate = new Date();
          const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
          
          const dateRange: DateRange = { startDate, endDate };
          
          const jobId = await analyticsQueue.queueExecutiveSummary(dateRange, true);
          
          logger.info('Monthly executive summary job scheduled successfully', {
            jobId,
            dateRange,
          });
        } catch (error) {
          logger.error('Failed to schedule monthly executive summary job', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set('monthly-reports', task);

    logger.info('Monthly executive summary job scheduled', {
      cron: '0 2 1 * *',
      timezone: this.config.timezone,
    });
  }

  /**
   * Schedule daily cleanup job
   * Runs every day at 3 AM UTC to clean up old jobs and logs
   */
  private scheduleDailyCleanup(): void {
    const task = cron.schedule(
      '0 3 * * *', // Every day at 3 AM
      async () => {
        try {
          logger.info('Starting scheduled daily cleanup job');
          const analyticsQueue = getAnalyticsQueue();
          
          // Clean up old analytics jobs
          await analyticsQueue.cleanupJobs();
          
          logger.info('Daily cleanup job completed successfully');
        } catch (error) {
          logger.error('Failed to execute daily cleanup job', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      },
      {
        timezone: this.config.timezone,
      }
    );

    this.scheduledTasks.set('daily-cleanup', task);

    logger.info('Daily cleanup job scheduled', {
      cron: '0 3 * * *',
      timezone: this.config.timezone,
    });
  }

  /**
   * Manually trigger real-time metrics job
   */
  async triggerRealTimeMetrics(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Analytics scheduler not initialized');
    }

    try {
      const analyticsQueue = getAnalyticsQueue();
      const jobId = await analyticsQueue.queueRealTimeMetrics();
      
      logger.info('Real-time metrics job triggered manually', { jobId });
      return jobId;
    } catch (error) {
      logger.error('Failed to trigger real-time metrics job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually trigger daily analytics jobs
   */
  async triggerDailyAnalytics(): Promise<{ courseJobId: string; studentJobId: string }> {
    if (!this.isInitialized) {
      throw new Error('Analytics scheduler not initialized');
    }

    try {
      const analyticsQueue = getAnalyticsQueue();
      
      const courseJobId = await analyticsQueue.queueCourseAnalytics();
      const studentJobId = await analyticsQueue.queueStudentAnalytics();
      
      logger.info('Daily analytics jobs triggered manually', {
        courseJobId,
        studentJobId,
      });
      
      return { courseJobId, studentJobId };
    } catch (error) {
      logger.error('Failed to trigger daily analytics jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually trigger weekly trend reports
   */
  async triggerWeeklyReports(dateRange?: DateRange): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Analytics scheduler not initialized');
    }

    try {
      const analyticsQueue = getAnalyticsQueue();
      
      // Use provided date range or default to past week
      const range = dateRange || {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      };
      
      const reportTypes = [
        'enrollments',
        'completions',
        'quiz_attempts',
        'discussion_posts',
      ];
      
      const jobId = await analyticsQueue.queueTrendReports(range, reportTypes);
      
      logger.info('Weekly trend reports job triggered manually', {
        jobId,
        dateRange: range,
        reportTypes,
      });
      
      return jobId;
    } catch (error) {
      logger.error('Failed to trigger weekly trend reports job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually trigger monthly executive summary
   */
  async triggerMonthlyReports(dateRange?: DateRange): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Analytics scheduler not initialized');
    }

    try {
      const analyticsQueue = getAnalyticsQueue();
      
      // Use provided date range or default to past month
      const range = dateRange || {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
        endDate: new Date(),
      };
      
      const jobId = await analyticsQueue.queueExecutiveSummary(range, true);
      
      logger.info('Monthly executive summary job triggered manually', {
        jobId,
        dateRange: range,
      });
      
      return jobId;
    } catch (error) {
      logger.error('Failed to trigger monthly executive summary job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isInitialized: boolean;
    config: SchedulerConfig;
    scheduledTasks: string[];
    taskStatuses: Record<string, boolean>;
  } {
    const taskStatuses: Record<string, boolean> = {};
    
    for (const [name, task] of Array.from(this.scheduledTasks.entries())) {
      taskStatuses[name] = task.getStatus() === 'scheduled';
    }

    return {
      isInitialized: this.isInitialized,
      config: this.config,
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
      taskStatuses,
    };
  }

  /**
   * Get analytics queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('Analytics scheduler not initialized');
    }

    try {
      const analyticsQueue = getAnalyticsQueue();
      return await analyticsQueue.getQueueStats();
    } catch (error) {
      logger.error('Failed to get analytics queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop a specific scheduled task
   */
  stopTask(taskName: string): boolean {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.stop();
      logger.info(`Stopped scheduled task: ${taskName}`);
      return true;
    }
    
    logger.warn(`Task not found: ${taskName}`);
    return false;
  }

  /**
   * Start a specific scheduled task
   */
  startTask(taskName: string): boolean {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.start();
      logger.info(`Started scheduled task: ${taskName}`);
      return true;
    }
    
    logger.warn(`Task not found: ${taskName}`);
    return false;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks(): void {
    for (const [name, task] of Array.from(this.scheduledTasks.entries())) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    
    logger.info('All scheduled tasks stopped');
  }

  /**
   * Start all scheduled tasks
   */
  startAllTasks(): void {
    for (const [name, task] of Array.from(this.scheduledTasks.entries())) {
      task.start();
      logger.info(`Started scheduled task: ${name}`);
    }
    
    logger.info('All scheduled tasks started');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down analytics scheduler...');
    
    try {
      // Stop all scheduled tasks
      this.stopAllTasks();
      
      // Clear scheduled tasks
      this.scheduledTasks.clear();
      
      // Shutdown analytics queue
      const analyticsQueue = getAnalyticsQueue();
      await analyticsQueue.shutdown();
      
      this.isInitialized = false;
      
      logger.info('Analytics scheduler shutdown completed');
    } catch (error) {
      logger.error('Analytics scheduler shutdown error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    scheduler: boolean;
    queue: boolean;
    tasks: Record<string, boolean>;
  }> {
    const health = {
      scheduler: this.isInitialized,
      queue: false,
      tasks: {} as Record<string, boolean>,
    };

    // Check queue health
    if (this.isInitialized) {
      try {
        const analyticsQueue = getAnalyticsQueue();
        health.queue = await analyticsQueue.healthCheck();
      } catch (error) {
        logger.error('Analytics queue health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Check task statuses
    for (const [name, task] of Array.from(this.scheduledTasks.entries())) {
      health.tasks[name] = task.getStatus() === 'scheduled';
    }

    return health;
  }
}

/**
 * Singleton instance of AnalyticsScheduler
 */
let analyticsSchedulerInstance: AnalyticsScheduler | null = null;

/**
 * Get the singleton AnalyticsScheduler instance
 */
export function getAnalyticsScheduler(): AnalyticsScheduler {
  if (!analyticsSchedulerInstance) {
    analyticsSchedulerInstance = new AnalyticsScheduler();
  }
  return analyticsSchedulerInstance;
}

/**
 * Initialize analytics scheduler (call this during application startup)
 */
export async function initializeAnalyticsScheduler(
  analyticsService: AnalyticsService,
  metricsCalculator: MetricsCalculator,
  config?: Partial<SchedulerConfig>
): Promise<AnalyticsScheduler> {
  if (!analyticsSchedulerInstance) {
    analyticsSchedulerInstance = new AnalyticsScheduler(config);
  }
  
  await analyticsSchedulerInstance.initialize(analyticsService, metricsCalculator);
  
  logger.info('Analytics scheduler initialized successfully');
  return analyticsSchedulerInstance;
}

/**
 * Shutdown analytics scheduler (call this during application shutdown)
 */
export async function shutdownAnalyticsScheduler(): Promise<void> {
  if (analyticsSchedulerInstance) {
    await analyticsSchedulerInstance.shutdown();
    analyticsSchedulerInstance = null;
  }
}