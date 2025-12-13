/**
 * Analytics Cache Warming Service
 *
 * Implements proactive cache warming strategies for analytics data to ensure
 * fast response times for frequently accessed metrics and dashboards.
 *
 * Requirements: 12.6, 15.2
 */

import type { IAnalyticsService } from '../../application/services/IAnalyticsService.js';
import type { Role, DateRange } from '../../../../shared/types/index.js';


import { analyticsCacheService } from './AnalyticsCacheService.js';

/**
 * Cache warming configuration
 */
interface CacheWarmingConfig {
  // Dashboard warming
  warmDashboards: boolean;
  maxUsersToWarm: number;

  // Analytics warming
  warmCourseAnalytics: boolean;
  warmStudentAnalytics: boolean;
  maxAnalyticsToWarm: number;

  // Reports warming
  warmReports: boolean;
  reportDateRanges: DateRange[];

  // Trending data warming
  warmTrendingData: boolean;
  trendingLimits: number[];

  // Batch processing
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
}

/**
 * Default cache warming configuration
 */
const DEFAULT_WARMING_CONFIG: CacheWarmingConfig = {
  warmDashboards: true,
  maxUsersToWarm: 100,

  warmCourseAnalytics: true,
  warmStudentAnalytics: true,
  maxAnalyticsToWarm: 50,

  warmReports: false, // Reports are expensive, only warm on demand
  reportDateRanges: [],

  warmTrendingData: true,
  trendingLimits: [10, 20, 50],

  batchSize: 10,
  delayBetweenBatches: 100,
};

/**
 * Analytics Cache Warming Service
 *
 * Provides intelligent cache warming strategies to ensure optimal performance
 * for frequently accessed analytics data.
 */
export class AnalyticsCacheWarmingService {
  constructor(
    private analyticsService: IAnalyticsService,
    private config: CacheWarmingConfig = DEFAULT_WARMING_CONFIG
  ) {}

  /**
   * Warms all critical analytics caches
   *
   * This is the main entry point for cache warming, typically called:
   * - On application startup
   * - After major data updates
   * - On a scheduled basis (e.g., every hour)
   */
  async warmAllCaches(): Promise<{
    warmed: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;

    try {
      console.log('Starting analytics cache warming...');

      // Warm in parallel but with controlled concurrency
      const warmingTasks = [];

      if (this.config.warmDashboards) {
        warmingTasks.push(this.warmDashboardCaches());
      }

      if (this.config.warmCourseAnalytics) {
        warmingTasks.push(this.warmCourseAnalyticsCaches());
      }

      if (this.config.warmStudentAnalytics) {
        warmingTasks.push(this.warmStudentAnalyticsCaches());
      }

      if (this.config.warmTrendingData) {
        warmingTasks.push(this.warmTrendingDataCaches());
      }

      if (this.config.warmReports && this.config.reportDateRanges.length > 0) {
        warmingTasks.push(this.warmReportCaches());
      }

      // Execute warming tasks and collect results
      const results = await Promise.allSettled(warmingTasks);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          warmed += result.value.warmed;
          failed += result.value.failed;
        } else {
          console.error('Cache warming task failed:', result.reason);
          failed++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Cache warming completed: ${warmed} warmed, ${failed} failed, ${duration}ms`);

      return { warmed, failed, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Cache warming failed:', error);
      return { warmed, failed: failed + 1, duration };
    }
  }

  /**
   * Warms dashboard caches for active users
   */
  async warmDashboardCaches(): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    try {
      // Get active user IDs (this would typically come from a user service)
      const activeUserIds = await this.getActiveUserIds(this.config.maxUsersToWarm);
      const roles: Role[] = ['student', 'educator', 'admin'];

      console.log(`Warming dashboard caches for ${activeUserIds.length} users...`);

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < activeUserIds.length; i += this.config.batchSize) {
        const batch = activeUserIds.slice(i, i + this.config.batchSize);

        const batchPromises = batch.flatMap((userId) =>
          roles.map(async (role) => {
            try {
              // Check if already cached
              const cached = await analyticsCacheService.getDashboardMetrics(userId, role);
              if (!cached) {
                // Warm the cache
                await this.analyticsService.getDashboardMetrics(userId, role);
                warmed++;
              }
            } catch (error) {
              console.error(
                `Failed to warm dashboard cache for user ${userId}, role ${role}:`,
                error
              );
              failed++;
            }
          })
        );

        await Promise.allSettled(batchPromises);

        // Add delay between batches to prevent overwhelming the system
        if (i + this.config.batchSize < activeUserIds.length) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      console.log(`Dashboard cache warming completed: ${warmed} warmed, ${failed} failed`);
      return { warmed, failed };
    } catch (error) {
      console.error('Dashboard cache warming failed:', error);
      return { warmed, failed: failed + 1 };
    }
  }

  /**
   * Warms course analytics caches for popular courses
   */
  async warmCourseAnalyticsCaches(): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    try {
      // Get popular course IDs (this would typically come from a course service)
      const popularCourseIds = await this.getPopularCourseIds(this.config.maxAnalyticsToWarm);

      console.log(`Warming course analytics caches for ${popularCourseIds.length} courses...`);

      // Process in batches
      for (let i = 0; i < popularCourseIds.length; i += this.config.batchSize) {
        const batch = popularCourseIds.slice(i, i + this.config.batchSize);

        const batchPromises = batch.map(async (courseId) => {
          try {
            // Check if already cached
            const cached = await analyticsCacheService.getCourseAnalytics(courseId);
            if (!cached) {
              // Warm the cache
              await this.analyticsService.updateCourseAnalytics(courseId);
              warmed++;
            }
          } catch (error) {
            console.error(`Failed to warm course analytics cache for course ${courseId}:`, error);
            failed++;
          }
        });

        await Promise.allSettled(batchPromises);

        if (i + this.config.batchSize < popularCourseIds.length) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      console.log(`Course analytics cache warming completed: ${warmed} warmed, ${failed} failed`);
      return { warmed, failed };
    } catch (error) {
      console.error('Course analytics cache warming failed:', error);
      return { warmed, failed: failed + 1 };
    }
  }

  /**
   * Warms student analytics caches for active students
   */
  async warmStudentAnalyticsCaches(): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    try {
      // Get active student IDs
      const activeStudentIds = await this.getActiveStudentIds(this.config.maxAnalyticsToWarm);

      console.log(`Warming student analytics caches for ${activeStudentIds.length} students...`);

      // Process in batches
      for (let i = 0; i < activeStudentIds.length; i += this.config.batchSize) {
        const batch = activeStudentIds.slice(i, i + this.config.batchSize);

        const batchPromises = batch.map(async (studentId) => {
          try {
            // Check if already cached
            const cached = await analyticsCacheService.getStudentAnalytics(studentId);
            if (!cached) {
              // Warm the cache
              await this.analyticsService.updateStudentAnalytics(studentId);
              warmed++;
            }
          } catch (error) {
            console.error(
              `Failed to warm student analytics cache for student ${studentId}:`,
              error
            );
            failed++;
          }
        });

        await Promise.allSettled(batchPromises);

        if (i + this.config.batchSize < activeStudentIds.length) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      console.log(`Student analytics cache warming completed: ${warmed} warmed, ${failed} failed`);
      return { warmed, failed };
    } catch (error) {
      console.error('Student analytics cache warming failed:', error);
      return { warmed, failed: failed + 1 };
    }
  }

  /**
   * Warms trending data caches
   */
  async warmTrendingDataCaches(): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    try {
      // Define common date ranges for trending data
      const now = new Date();
      const dateRanges: DateRange[] = [
        // Last 7 days
        {
          startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: now,
        },
        // Last 30 days
        {
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: now,
        },
        // Last 90 days
        {
          startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          endDate: now,
        },
      ];

      console.log('Warming trending data caches...');

      const warmingPromises = [];

      // Warm trending courses for different limits and date ranges
      for (const limit of this.config.trendingLimits) {
        for (const dateRange of dateRanges) {
          warmingPromises.push(
            this.warmTrendingCourses(limit, dateRange)
              .then(() => {
                warmed++;
              })
              .catch((error) => {
                console.error(`Failed to warm trending courses cache (limit: ${limit}):`, error);
                failed++;
              })
          );
        }
      }

      // Warm top performers for different limits
      for (const limit of this.config.trendingLimits) {
        warmingPromises.push(
          this.warmTopPerformers(limit)
            .then(() => {
              warmed++;
            })
            .catch((error) => {
              console.error(`Failed to warm top performers cache (limit: ${limit}):`, error);
              failed++;
            })
        );
      }

      await Promise.allSettled(warmingPromises);

      console.log(`Trending data cache warming completed: ${warmed} warmed, ${failed} failed`);
      return { warmed, failed };
    } catch (error) {
      console.error('Trending data cache warming failed:', error);
      return { warmed, failed: failed + 1 };
    }
  }

  /**
   * Warms report caches for specified date ranges
   */
  async warmReportCaches(): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    try {
      // Get popular course and student IDs for report warming
      const [popularCourseIds, activeStudentIds] = await Promise.all([
        this.getPopularCourseIds(10), // Limit to top 10 for reports
        this.getActiveStudentIds(10), // Limit to top 10 for reports
      ]);

      console.log('Warming report caches...');

      const warmingPromises = [];

      // Warm course reports
      for (const courseId of popularCourseIds) {
        for (const dateRange of this.config.reportDateRanges) {
          warmingPromises.push(
            this.warmCourseReport(courseId, dateRange)
              .then(() => {
                warmed++;
              })
              .catch((error) => {
                console.error(`Failed to warm course report cache for course ${courseId}:`, error);
                failed++;
              })
          );
        }
      }

      // Warm student reports
      for (const studentId of activeStudentIds) {
        for (const dateRange of this.config.reportDateRanges) {
          warmingPromises.push(
            this.warmStudentReport(studentId, dateRange)
              .then(() => {
                warmed++;
              })
              .catch((error) => {
                console.error(
                  `Failed to warm student report cache for student ${studentId}:`,
                  error
                );
                failed++;
              })
          );
        }
      }

      await Promise.allSettled(warmingPromises);

      console.log(`Report cache warming completed: ${warmed} warmed, ${failed} failed`);
      return { warmed, failed };
    } catch (error) {
      console.error('Report cache warming failed:', error);
      return { warmed, failed: failed + 1 };
    }
  }

  /**
   * Warms trending courses cache
   */
  private async warmTrendingCourses(limit: number, dateRange: DateRange): Promise<void> {
    const cached = await analyticsCacheService.getTrendingCourses(limit, dateRange);
    if (!cached) {
      await this.analyticsService.getTrendingCourses(limit, dateRange);
    }
  }

  /**
   * Warms top performers cache
   */
  private async warmTopPerformers(limit: number): Promise<void> {
    const cached = await analyticsCacheService.getTopPerformers(limit);
    if (!cached) {
      await this.analyticsService.getTopPerformingStudents(limit);
    }
  }

  /**
   * Warms course report cache
   */
  private async warmCourseReport(courseId: string, dateRange: DateRange): Promise<void> {
    const cached = await analyticsCacheService.getCourseReport(courseId, dateRange);
    if (!cached) {
      await this.analyticsService.generateCourseReport(courseId, dateRange);
    }
  }

  /**
   * Warms student report cache
   */
  private async warmStudentReport(studentId: string, dateRange: DateRange): Promise<void> {
    const cached = await analyticsCacheService.getStudentReport(studentId, dateRange);
    if (!cached) {
      await this.analyticsService.generateStudentReport(studentId, dateRange);
    }
  }

  /**
   * Gets active user IDs for dashboard warming
   * In a real implementation, this would query the user service
   */
  private async getActiveUserIds(_limit: number): Promise<string[]> {
    // Placeholder implementation - in reality, this would query the database
    // for users who have been active recently
    return Promise.resolve([]);
  }

  /**
   * Gets popular course IDs for analytics warming
   * In a real implementation, this would query based on enrollment counts
   */
  private async getPopularCourseIds(_limit: number): Promise<string[]> {
    // Placeholder implementation - in reality, this would query the database
    // for courses with the highest enrollment counts or activity
    return Promise.resolve([]);
  }

  /**
   * Gets active student IDs for analytics warming
   * In a real implementation, this would query based on recent activity
   */
  private async getActiveStudentIds(_limit: number): Promise<string[]> {
    // Placeholder implementation - in reality, this would query the database
    // for students who have been active recently
    return Promise.resolve([]);
  }

  /**
   * Utility method to add delay between batches
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Updates the warming configuration
   */
  updateConfig(config: Partial<CacheWarmingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current warming configuration
   */
  getConfig(): CacheWarmingConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance of the cache warming service
 */
export let analyticsCacheWarmingService: AnalyticsCacheWarmingService;

/**
 * Initializes the cache warming service with the analytics service
 */
export function initializeAnalyticsCacheWarmingService(analyticsService: IAnalyticsService): void {
  analyticsCacheWarmingService = new AnalyticsCacheWarmingService(analyticsService);
}
