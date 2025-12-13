/**
 * Analytics Initialization Helper
 * 
 * Provides a convenient function to initialize all analytics-related services
 * including the analytics service, metrics calculator, queue, and scheduler.
 * 
 * Requirements:
 * - 12.5: Scheduled analytics aggregation
 * - 14.3: Analytics aggregation queue setup
 */

import { AnalyticsService } from '../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../modules/analytics/application/services/MetricsCalculator.js';
import { 
  AnalyticsEventsRepository,
  CourseAnalyticsRepository,
  StudentAnalyticsRepository
} from '../../modules/analytics/infrastructure/repositories/index.js';
import { logger } from '../utils/logger.js';

import { initializeAnalyticsScheduler, type SchedulerConfig } from './AnalyticsScheduler.js';

/**
 * Initialize all analytics services and scheduling
 * 
 * This function sets up the complete analytics infrastructure including:
 * - Analytics repositories
 * - Analytics service
 * - Metrics calculator
 * - Analytics queue
 * - Analytics scheduler with cron jobs
 * 
 * @param config Optional scheduler configuration
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeAnalytics(config?: Partial<SchedulerConfig>): Promise<void> {
  try {
    logger.info('Initializing analytics services...');

    // Initialize repositories
    const analyticsEventsRepository = new AnalyticsEventsRepository();
    const courseAnalyticsRepository = new CourseAnalyticsRepository();
    const studentAnalyticsRepository = new StudentAnalyticsRepository();

    // Create analytics repository interface
    const analyticsRepository = {
      events: analyticsEventsRepository,
      courseAnalytics: courseAnalyticsRepository,
      studentAnalytics: studentAnalyticsRepository,
    };

    // Initialize services
    const analyticsService = new AnalyticsService(analyticsRepository);
    const metricsCalculator = new MetricsCalculator();

    // Initialize scheduler (this also initializes the queue)
    await initializeAnalyticsScheduler(analyticsService, metricsCalculator, config);

    logger.info('Analytics services initialized successfully', {
      schedulerConfig: config,
    });
  } catch (error) {
    logger.error('Failed to initialize analytics services', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get default scheduler configuration for different environments
 */
export function getDefaultSchedulerConfig(environment: 'development' | 'staging' | 'production'): SchedulerConfig {
  const baseConfig: SchedulerConfig = {
    enableHourlyMetrics: true,
    enableDailyAnalytics: true,
    enableWeeklyReports: true,
    enableMonthlyReports: true,
    timezone: 'UTC',
  };

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        // In development, you might want to disable some jobs or run them less frequently
        enableMonthlyReports: false,
      };
    
    case 'staging':
      return {
        ...baseConfig,
        // In staging, you might want to test all jobs but with reduced frequency
      };
    
    case 'production':
    default:
      return baseConfig;
  }
}

/**
 * Validate scheduler configuration
 */
export function validateSchedulerConfig(config: Partial<SchedulerConfig>): string[] {
  const errors: string[] = [];

  if (config.timezone && !isValidTimezone(config.timezone)) {
    errors.push(`Invalid timezone: ${config.timezone}`);
  }

  return errors;
}

/**
 * Check if a timezone string is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}