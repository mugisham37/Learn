/**
 * Cron Job Service
 * 
 * Manages scheduled tasks including secret rotation, analytics aggregation,
 * and maintenance tasks.
 * 
 * Requirements: 13.7, 14.7
 */

import cron from 'node-cron';
import { secretRotationService } from './SecretRotationService.js';
import { logger } from '../utils/logger.js';
import { config } from '../../config/index.js';

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
 * Cron Job Service
 */
export class CronJobService {
  private static instance: CronJobService;
  private jobs = new Map<string, cron.ScheduledTask>();
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
          scheduled: false,
          timezone: jobConfig.timezone || 'UTC',
        }
      );

      this.jobs.set(jobConfig.name, task);
      task.start();

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
    // Secret rotation job - daily at 2 AM UTC
    this.scheduleJob({
      name: 'secret-rotation',
      schedule: '0 2 * * *',
      task: async () => {
        await secretRotationService.rotateExpiredSecrets();
      },
      enabled: this.isEnabled,
    });

    logger.info('Default cron jobs initialized', {
      enabled: this.isEnabled,
      environment: config.nodeEnv,
    });
  }

  /**
   * Stop a specific job
   */
  public stopJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      logger.info('Cron job stopped', { jobName });
    }
  }

  /**
   * Stop all jobs
   */
  public stopAllJobs(): void {
    for (const [jobName, job] of this.jobs) {
      job.stop();
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