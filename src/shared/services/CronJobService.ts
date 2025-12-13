/**
 * Cron Job Service
 * 
 * Manages scheduled tasks including secret rotation, analytics aggregation,
 * and maintenance tasks.
 * 
 * Requirements: 13.7, 14.7
 */

import cron from 'node-cron';

import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

import { getAnalyticsScheduler } from './AnalyticsScheduler.js';
import { getLogPruningService } from './LogPruningService.js';
import { secretRotationService } from './SecretRotationService.js';
import { getSessionCleanupService } from './SessionCleanupService.js';

/**
 * Cron job configuration
 */
export interface CronJobConfig {
  /** Job name */
  name: string;
  /** Cron expression */
  schedule: string;
  /** Job function */
  task: () => Promise<void>;
  /** Whether job is enabled */
  enabled: boolean;
  /** Timezone for scheduling */
  timezone?: string;
}

/**
 * Cron task type
 */
type CronTask = ReturnType<typeof cron.schedule>;

/**
 * Cron Job Service
 */
export class CronJobService {
  private static instance: CronJobService;
  private jobs = new Map<string, CronTask>();
  private isEnabled: boolean;

  private constructor() {
    this.isEnabled = config.nodeEnv === 'production';
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CronJobService {
    if (!CronJobService.instance) {
      CronJobService.instance = new CronJobService();
    }
    return CronJobService.instance;
  }

  /**
   * Schedule a cron job
   */
  public scheduleJob(jobConfig: CronJobConfig): void {
    if (!this.isEnabled && jobConfig.enabled) {
      logger.info(`Cron job disabled in ${config.nodeEnv} environment`, {
        jobName: jobConfig.name,
      });
      return;
    }

    if (!jobConfig.enabled) {
      logger.info('Cron job is disabled', { jobName: jobConfig.name });
      return;
    }

    try {
      const task = cron.schedule(
        jobConfig.schedule,
        async () => {
          logger.info('Starting cron job', { jobName: jobConfig.name });
          try {
            await jobConfig.task();
            logger.info('Cron job completed successfully', { jobName: jobConfig.name });
          } catch (error) {
            logger.error('Cron job failed', {
              jobName: jobConfig.name,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        },
        {
          timezone: jobConfig.timezone || 'UTC',
        }
      );

      this.jobs.set(jobConfig.name, task);
      void task.start();

      logger.info('Cron job scheduled', {
        jobName: jobConfig.name,
        schedule: jobConfig.schedule,
        timezone: jobConfig.timezone || 'UTC',
      });
    } catch (error) {
      logger.error('Failed to schedule cron job', {
        jobName: jobConfig.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Initialize default cron jobs
   */
  public initializeDefaultJobs(): void {
    // Daily analytics updates - midnight UTC (handled by AnalyticsScheduler)
    this.scheduleJob({
      name: 'daily-analytics-updates',
      schedule: '0 0 * * *',
      task: async () => {
        const analyticsScheduler = getAnalyticsScheduler();
        await analyticsScheduler.triggerDailyAnalytics();
      },
      enabled: this.isEnabled,
    });

    // Weekly trend reports - Sunday at 1 AM UTC (handled by AnalyticsScheduler)
    this.scheduleJob({
      name: 'weekly-trend-reports',
      schedule: '0 1 * * 0',
      task: async () => {
        const analyticsScheduler = getAnalyticsScheduler();
        await analyticsScheduler.triggerWeeklyReports();
      },
      enabled: this.isEnabled,
    });

    // Monthly executive summaries - 1st of month at 2 AM UTC (handled by AnalyticsScheduler)
    this.scheduleJob({
      name: 'monthly-executive-summaries',
      schedule: '0 2 1 * *',
      task: async () => {
        const analyticsScheduler = getAnalyticsScheduler();
        await analyticsScheduler.triggerMonthlyReports();
      },
      enabled: this.isEnabled,
    });

    // Daily session cleanup - 3 AM UTC
    this.scheduleJob({
      name: 'daily-session-cleanup',
      schedule: '0 3 * * *',
      task: async () => {
        const sessionCleanupService = getSessionCleanupService();
        await sessionCleanupService.executeCleanup();
      },
      enabled: this.isEnabled,
    });

    // Daily log pruning - 4 AM UTC
    this.scheduleJob({
      name: 'daily-log-pruning',
      schedule: '0 4 * * *',
      task: async () => {
        const logPruningService = getLogPruningService();
        await logPruningService.executePruning();
      },
      enabled: this.isEnabled,
    });

    // Secret rotation job - 5 AM UTC
    this.scheduleJob({
      name: 'secret-rotation',
      schedule: '0 5 * * *',
      task: async () => {
        await secretRotationService.rotateExpiredSecrets();
      },
      enabled: this.isEnabled,
    });

    logger.info('Default cron jobs initialized', {
      enabled: this.isEnabled,
      environment: config.nodeEnv,
      jobs: Array.from(this.jobs.keys()),
    });
  }

  /**
   * Stop a specific job
   */
  public stopJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      void job.stop();
      this.jobs.delete(jobName);
      logger.info('Cron job stopped', { jobName });
    }
  }

  /**
   * Stop all jobs
   */
  public stopAllJobs(): void {
    for (const [jobName, job] of this.jobs) {
      void job.stop();
      logger.info('Cron job stopped', { jobName });
    }
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  public getJobStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [jobName, job] of this.jobs) {
      status[jobName] = job.getStatus() === 'scheduled';
    }
    return status;
  }
}

/**
 * Global cron job service instance
 */
export const cronJobService = CronJobService.getInstance();