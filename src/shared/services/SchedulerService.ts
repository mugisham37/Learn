/**
 * Unified Scheduler Service
 * 
 * Coordinates all scheduled tasks including analytics, session cleanup,
 * log pruning, and secret rotation. Provides a centralized interface
 * for managing all cron jobs in the application.
 * 
 * Requirements: 14.7 - Scheduled tasks execution
 */

import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

import { 
  getAnalyticsScheduler, 
  initializeAnalyticsScheduler,
  type SchedulerConfig as AnalyticsSchedulerConfig 
} from './AnalyticsScheduler.js';
import { cronJobService, type CronJobConfig } from './CronJobService.js';
import { 
  getLogPruningService, 
  initializeLogPruningService,
  type LogPruningConfig 
} from './LogPruningService.js';
import { 
  getSessionCleanupService, 
  initializeSessionCleanupService,
  type SessionCleanupConfig 
} from './SessionCleanupService.js';

/**
 * Unified scheduler configuration
 */
export interface UnifiedSchedulerConfig {
  /** Whether to enable scheduled tasks */
  enabled: boolean;
  /** Timezone for all scheduled tasks */
  timezone: string;
  /** Analytics scheduler configuration */
  analytics: Partial<AnalyticsSchedulerConfig>;
  /** Session cleanup configuration */
  sessionCleanup: Partial<SessionCleanupConfig>;
  /** Log pruning configuration */
  logPruning: Partial<LogPruningConfig>;
  /** Custom cron jobs */
  customJobs: CronJobConfig[];
}

/**
 * Default scheduler configuration
 */
const DEFAULT_CONFIG: UnifiedSchedulerConfig = {
  enabled: config.nodeEnv === 'production',
  timezone: 'UTC',
  analytics: {
    enableHourlyMetrics: true,
    enableDailyAnalytics: true,
    enableWeeklyReports: true,
    enableMonthlyReports: true,
    timezone: 'UTC',
  },
  sessionCleanup: {
    expiredTokenRetentionDays: 7,
    unverifiedAccountRetentionDays: 30,
    passwordResetTokenRetentionHours: 24,
  },
  logPruning: {
    retentionDays: 30,
    maxFileSizeMB: 100,
    maxFiles: 10,
    compressOldLogs: true,
  },
  customJobs: [],
};

/**
 * Scheduler status information
 */
export interface SchedulerStatus {
  isInitialized: boolean;
  isEnabled: boolean;
  environment: string;
  timezone: string;
  totalJobs: number;
  activeJobs: number;
  failedJobs: number;
  lastHealthCheck: Date | null;
  services: {
    cronJobService: boolean;
    analyticsScheduler: boolean;
    sessionCleanup: boolean;
    logPruning: boolean;
  };
}

/**
 * Unified Scheduler Service Implementation
 */
export class SchedulerService {
  private config: UnifiedSchedulerConfig;
  private isInitialized: boolean = false;
  private lastHealthCheck: Date | null = null;

  constructor(config: Partial<UnifiedSchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the unified scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Scheduler service already initialized');
      return;
    }

    try {
      logger.info('Initializing unified scheduler service', {
        config: {
          enabled: this.config.enabled,
          timezone: this.config.timezone,
          environment: config.nodeEnv,
        },
      });

      if (!this.config.enabled) {
        logger.info('Scheduled tasks disabled for this environment', {
          environment: config.nodeEnv,
        });
        this.isInitialized = true;
        return;
      }

      // Initialize session cleanup service
      initializeSessionCleanupService(this.config.sessionCleanup);
      logger.info('Session cleanup service initialized');

      // Initialize log pruning service
      initializeLogPruningService(this.config.logPruning);
      logger.info('Log pruning service initialized');

      // Initialize analytics scheduler (requires analytics services)
      try {
        const { AnalyticsService } = await import('../../modules/analytics/application/services/AnalyticsService.js');
        const { MetricsCalculator } = await import('../../modules/analytics/application/services/MetricsCalculator.js');
        
        // Create analytics service instances (these should be properly injected in production)
        // Note: In production, this should be properly injected with dependencies
        // For now, we'll skip analytics service initialization if dependencies are missing
        logger.warn('Analytics service initialization skipped - missing repository dependency');
        return;
        const metricsCalculator = new MetricsCalculator();
        
        await initializeAnalyticsScheduler(analyticsService, metricsCalculator, this.config.analytics);
        logger.info('Analytics scheduler initialized');
      } catch (error) {
        logger.warn('Analytics scheduler initialization skipped', {
          reason: 'Analytics services not available',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Initialize default cron jobs
      cronJobService.initializeDefaultJobs();

      // Schedule custom jobs
      for (const customJob of this.config.customJobs) {
        cronJobService.scheduleJob(customJob);
      }

      this.isInitialized = true;
      logger.info('Unified scheduler service initialized successfully', {
        totalJobs: this.getTotalJobCount(),
      });
    } catch (error) {
      logger.error('Failed to initialize unified scheduler service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<SchedulerStatus> {
    const cronJobStatus = cronJobService.getJobStatus();
    const activeJobs = Object.values(cronJobStatus).filter(Boolean).length;
    const totalJobs = Object.keys(cronJobStatus).length;

    // Perform health checks
    const services = {
      cronJobService: true, // Always available
      analyticsScheduler: false,
      sessionCleanup: false,
      logPruning: false,
    };

    try {
      const analyticsScheduler = getAnalyticsScheduler();
      const healthCheck = await analyticsScheduler.healthCheck();
      services.analyticsScheduler = healthCheck.scheduler && healthCheck.queue;
    } catch {
      services.analyticsScheduler = false;
    }

    try {
      const sessionCleanupService = getSessionCleanupService();
      services.sessionCleanup = await sessionCleanupService.healthCheck();
    } catch {
      services.sessionCleanup = false;
    }

    try {
      const logPruningService = getLogPruningService();
      services.logPruning = await logPruningService.healthCheck();
    } catch {
      services.logPruning = false;
    }

    this.lastHealthCheck = new Date();

    return {
      isInitialized: this.isInitialized,
      isEnabled: this.config.enabled,
      environment: config.nodeEnv,
      timezone: this.config.timezone,
      totalJobs,
      activeJobs,
      failedJobs: totalJobs - activeJobs,
      lastHealthCheck: this.lastHealthCheck,
      services,
    };
  }

  /**
   * Get detailed statistics from all services
   */
  async getDetailedStats(): Promise<{
    scheduler: SchedulerStatus;
    analytics: unknown;
    sessionCleanup: unknown;
    logPruning: unknown;
  }> {
    const stats = {
      scheduler: await this.getStatus(),
      analytics: null as unknown,
      sessionCleanup: null as unknown,
      logPruning: null as unknown,
    };

    // Get analytics stats
    try {
      const analyticsScheduler = getAnalyticsScheduler();
      stats.analytics = {
        status: analyticsScheduler.getStatus(),
        queueStats: await analyticsScheduler.getQueueStats(),
      };
    } catch (error) {
      logger.debug('Failed to get analytics stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Get session cleanup stats
    try {
      const sessionCleanupService = getSessionCleanupService();
      stats.sessionCleanup = await sessionCleanupService.getCleanupStats();
    } catch (error) {
      logger.debug('Failed to get session cleanup stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Get log pruning stats
    try {
      const logPruningService = getLogPruningService();
      stats.logPruning = await logPruningService.getPruningStats();
    } catch (error) {
      logger.debug('Failed to get log pruning stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return stats;
  }

  /**
   * Manually trigger a specific scheduled task
   */
  async triggerTask(taskName: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Scheduler service not initialized');
    }

    try {
      switch (taskName) {
        case 'daily-analytics-updates': {
          const analyticsScheduler = getAnalyticsScheduler();
          await analyticsScheduler.triggerDailyAnalytics();
          break;
        }

        case 'weekly-trend-reports': {
          const weeklyScheduler = getAnalyticsScheduler();
          await weeklyScheduler.triggerWeeklyReports();
          break;
        }

        case 'monthly-executive-summaries': {
          const monthlyScheduler = getAnalyticsScheduler();
          await monthlyScheduler.triggerMonthlyReports();
          break;
        }

        case 'daily-session-cleanup': {
          const sessionCleanupService = getSessionCleanupService();
          await sessionCleanupService.executeCleanup();
          break;
        }

        case 'daily-log-pruning': {
          const logPruningService = getLogPruningService();
          await logPruningService.executePruning();
          break;
        }

        default:
          logger.warn('Unknown task name for manual trigger', { taskName });
          return false;
      }

      logger.info('Manually triggered scheduled task', { taskName });
      return true;
    } catch (error) {
      logger.error('Failed to manually trigger task', {
        taskName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop a specific scheduled task
   */
  stopTask(taskName: string): boolean {
    if (!this.isInitialized) {
      throw new Error('Scheduler service not initialized');
    }

    cronJobService.stopJob(taskName);
    logger.info('Stopped scheduled task', { taskName });
    return true;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks(): void {
    if (!this.isInitialized) {
      throw new Error('Scheduler service not initialized');
    }

    cronJobService.stopAllJobs();
    logger.info('Stopped all scheduled tasks');
  }

  /**
   * Add a custom scheduled job
   */
  addCustomJob(jobConfig: CronJobConfig): void {
    if (!this.isInitialized) {
      throw new Error('Scheduler service not initialized');
    }

    cronJobService.scheduleJob(jobConfig);
    logger.info('Added custom scheduled job', {
      name: jobConfig.name,
      schedule: jobConfig.schedule,
    });
  }

  /**
   * Get total job count
   */
  private getTotalJobCount(): number {
    const cronJobStatus = cronJobService.getJobStatus();
    return Object.keys(cronJobStatus).length;
  }

  /**
   * Perform health check on all scheduler components
   */
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      
      // Check if all critical services are healthy
      const criticalServices = [
        status.services.cronJobService,
        status.services.sessionCleanup,
        status.services.logPruning,
      ];

      const allCriticalHealthy = criticalServices.every(service => service);
      
      if (!allCriticalHealthy) {
        logger.warn('Some scheduler services are unhealthy', {
          services: status.services,
        });
      }

      return allCriticalHealthy;
    } catch (error) {
      logger.error('Scheduler health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down unified scheduler service...');

    try {
      // Stop all cron jobs
      cronJobService.stopAllJobs();

      // Shutdown analytics scheduler
      try {
        const analyticsScheduler = getAnalyticsScheduler();
        await analyticsScheduler.shutdown();
      } catch (error) {
        logger.warn('Analytics scheduler shutdown error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      this.isInitialized = false;
      logger.info('Unified scheduler service shutdown completed');
    } catch (error) {
      logger.error('Scheduler service shutdown error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Singleton instance of SchedulerService
 */
let schedulerServiceInstance: SchedulerService | null = null;

/**
 * Get the singleton SchedulerService instance
 */
export function getSchedulerService(): SchedulerService {
  if (!schedulerServiceInstance) {
    schedulerServiceInstance = new SchedulerService();
  }
  return schedulerServiceInstance;
}

/**
 * Initialize scheduler service with custom config
 */
export function initializeSchedulerService(config?: Partial<UnifiedSchedulerConfig>): SchedulerService {
  schedulerServiceInstance = new SchedulerService(config);
  return schedulerServiceInstance;
}

/**
 * Shutdown scheduler service
 */
export async function shutdownSchedulerService(): Promise<void> {
  if (schedulerServiceInstance) {
    await schedulerServiceInstance.shutdown();
    schedulerServiceInstance = null;
  }
}