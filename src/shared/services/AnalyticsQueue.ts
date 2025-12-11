/**
 * Analytics Queue Implementation
 * 
 * Implements BullMQ queue for analytics aggregation jobs with scheduled execution.
 * Handles real-time metrics, course analytics, student analytics, trend reports,
 * and executive summaries with appropriate concurrency and retry logic.
 * 
 * Requirements:
 * - 12.5: Scheduled analytics aggregation (hourly, daily, weekly, monthly)
 * - 14.3: Analytics aggregation queue with batch processing
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { redis } from '../../infrastructure/cache/index.js';
import { logger } from '../utils/logger.js';
import { AnalyticsService } from '../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../modules/analytics/application/services/MetricsCalculator.js';
import { getReadDb } from '../../infrastructure/database/index.js';
import { courses } from '../../infrastructure/database/schema/courses.schema.js';
import { users } from '../../infrastructure/database/schema/users.schema.js';
import { eq } from 'drizzle-orm';
import type { DateRange } from '../types/index.js';

/**
 * Analytics job data interfaces
 */
export interface RealTimeMetricsJobData {
  type: 'real-time-metrics';
  timestamp: Date;
}

export interface CourseAnalyticsJobData {
  type: 'course-analytics';
  courseIds?: string[];
  batchSize?: number;
}

export interface StudentAnalyticsJobData {
  type: 'student-analytics';
  userIds?: string[];
  batchSize?: number;
}

export interface TrendReportsJobData {
  type: 'trend-reports';
  dateRange: DateRange;
  reportTypes: string[];
}

export interface ExecutiveSummaryJobData {
  type: 'executive-summary';
  dateRange: DateRange;
  includeGrowthMetrics: boolean;
}

export type AnalyticsJobData = 
  | RealTimeMetricsJobData 
  | CourseAnalyticsJobData 
  | StudentAnalyticsJobData 
  | TrendReportsJobData 
  | ExecutiveSummaryJobData;

/**
 * Analytics Queue Configuration
 */
const ANALYTICS_QUEUE_NAME = 'analytics-queue';
const ANALYTICS_QUEUE_OPTIONS: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 25, // Keep last 25 failed jobs
    attempts: 3, // Retry 3 times for analytics jobs
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
  },
};

/**
 * Analytics Worker Configuration
 */
const ANALYTICS_WORKER_OPTIONS: WorkerOptions = {
  connection: redis,
  concurrency: 3, // Moderate concurrency for analytics processing
  maxStalledCount: 1,
  stalledInterval: 60000, // 60 seconds
};

/**
 * Analytics Queue Implementation
 * 
 * Manages analytics aggregation jobs with BullMQ, implements scheduled execution,
 * handles batch processing for large datasets, and provides comprehensive analytics
 * processing capabilities.
 */
export class AnalyticsQueue {
  private queue: Queue<AnalyticsJobData>;
  private worker: Worker<AnalyticsJobData>;
  private analyticsService: AnalyticsService;
  private metricsCalculator: MetricsCalculator;
  private db = getReadDb();

  constructor(analyticsService: AnalyticsService, metricsCalculator: MetricsCalculator) {
    this.analyticsService = analyticsService;
    this.metricsCalculator = metricsCalculator;
    this.queue = new Queue<AnalyticsJobData>(ANALYTICS_QUEUE_NAME, ANALYTICS_QUEUE_OPTIONS);
    this.worker = new Worker<AnalyticsJobData>(
      ANALYTICS_QUEUE_NAME,
      this.processAnalyticsJob.bind(this),
      ANALYTICS_WORKER_OPTIONS
    );

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for job lifecycle tracking
   */
  private setupEventListeners(): void {
    // Job started
    this.worker.on('active', (job: Job<AnalyticsJobData>) => {
      logger.info(`Analytics job ${job.id} started processing`, {
        jobId: job.id,
        type: job.data.type,
      });
    });

    // Job completed successfully
    this.worker.on('completed', (job: Job<AnalyticsJobData>, result: any) => {
      logger.info(`Analytics job ${job.id} completed successfully`, {
        jobId: job.id,
        type: job.data.type,
        result: typeof result === 'object' ? Object.keys(result) : result,
      });
    });

    // Job failed
    this.worker.on('failed', (job: Job<AnalyticsJobData> | undefined, error: Error) => {
      if (!job) {
        logger.error('Analytics job failed without job context', { error: error.message });
        return;
      }

      logger.error(`Analytics job ${job.id} failed`, {
        jobId: job.id,
        type: job.data.type,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });
    });

    // Job stalled
    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`Analytics job ${jobId} stalled`, { jobId });
    });

    // Queue error
    this.queue.on('error', (error: Error) => {
      logger.error('Analytics queue error', { error: error.message });
    });

    // Worker error
    this.worker.on('error', (error: Error) => {
      logger.error('Analytics worker error', { error: error.message });
    });
  }

  /**
   * Process analytics job based on type
   */
  private async processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<any> {
    const { type } = job.data;

    try {
      switch (type) {
        case 'real-time-metrics':
          return await this.processRealTimeMetrics(job.data as RealTimeMetricsJobData);
        case 'course-analytics':
          return await this.processCourseAnalytics(job.data as CourseAnalyticsJobData);
        case 'student-analytics':
          return await this.processStudentAnalytics(job.data as StudentAnalyticsJobData);
        case 'trend-reports':
          return await this.processTrendReports(job.data as TrendReportsJobData);
        case 'executive-summary':
          return await this.processExecutiveSummary(job.data as ExecutiveSummaryJobData);
        default:
          throw new Error(`Unknown analytics job type: ${type}`);
      }
    } catch (error) {
      logger.error(`Analytics job ${job.id} processing error`, {
        jobId: job.id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process real-time metrics job (hourly)
   */
  private async processRealTimeMetrics(data: RealTimeMetricsJobData): Promise<{
    processedAt: Date;
    metricsUpdated: string[];
  }> {
    logger.info('Processing real-time metrics', { timestamp: data.timestamp });

    const metricsUpdated: string[] = [];

    try {
      // Update platform-wide real-time metrics
      const dateRange: DateRange = {
        startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        endDate: new Date(),
      };

      // Get platform metrics for the last hour
      const platformMetrics = await this.analyticsService.getPlatformMetrics(dateRange);
      metricsUpdated.push('platform-metrics');

      // Update trending courses (last 24 hours)
      const trendingDateRange: DateRange = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        endDate: new Date(),
      };
      
      await this.analyticsService.getTrendingCourses(10, trendingDateRange);
      metricsUpdated.push('trending-courses');

      // Update top performing students
      await this.analyticsService.getTopPerformingStudents(10);
      metricsUpdated.push('top-performers');

      logger.info('Real-time metrics processing completed', {
        metricsUpdated,
        platformMetrics: {
          totalUsers: platformMetrics.totalUsers,
          totalCourses: platformMetrics.totalCourses,
          totalEnrollments: platformMetrics.totalEnrollments,
        },
      });

      return {
        processedAt: new Date(),
        metricsUpdated,
      };
    } catch (error) {
      logger.error('Real-time metrics processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metricsUpdated,
      });
      throw error;
    }
  }

  /**
   * Process course analytics job (daily)
   */
  private async processCourseAnalytics(data: CourseAnalyticsJobData): Promise<{
    processedCourses: number;
    batchesProcessed: number;
  }> {
    logger.info('Processing course analytics', { 
      courseIds: data.courseIds?.length || 'all',
      batchSize: data.batchSize || 10,
    });

    const batchSize = data.batchSize || 10;
    let courseIds = data.courseIds;

    // If no specific course IDs provided, get all published courses
    if (!courseIds) {
      const publishedCourses = await this.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.status, 'published'));
      
      courseIds = publishedCourses.map(course => course.id);
    }

    if (courseIds.length === 0) {
      logger.info('No courses to process for analytics');
      return { processedCourses: 0, batchesProcessed: 0 };
    }

    let processedCourses = 0;
    let batchesProcessed = 0;

    // Process courses in batches
    for (let i = 0; i < courseIds.length; i += batchSize) {
      const batch = courseIds.slice(i, i + batchSize);
      
      try {
        await this.analyticsService.batchUpdateCourseAnalytics(batch);
        processedCourses += batch.length;
        batchesProcessed++;

        logger.info(`Processed course analytics batch ${batchesProcessed}`, {
          batchSize: batch.length,
          totalProcessed: processedCourses,
          totalCourses: courseIds.length,
        });
      } catch (error) {
        logger.error(`Failed to process course analytics batch ${batchesProcessed}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          batchCourseIds: batch,
        });
        // Continue with next batch
      }
    }

    logger.info('Course analytics processing completed', {
      processedCourses,
      batchesProcessed,
      totalCourses: courseIds.length,
    });

    return { processedCourses, batchesProcessed };
  }

  /**
   * Process student analytics job (daily)
   */
  private async processStudentAnalytics(data: StudentAnalyticsJobData): Promise<{
    processedStudents: number;
    batchesProcessed: number;
  }> {
    logger.info('Processing student analytics', { 
      userIds: data.userIds?.length || 'all',
      batchSize: data.batchSize || 10,
    });

    const batchSize = data.batchSize || 10;
    let userIds = data.userIds;

    // If no specific user IDs provided, get all students
    if (!userIds) {
      const students = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'student'));
      
      userIds = students.map(student => student.id);
    }

    if (userIds.length === 0) {
      logger.info('No students to process for analytics');
      return { processedStudents: 0, batchesProcessed: 0 };
    }

    let processedStudents = 0;
    let batchesProcessed = 0;

    // Process students in batches
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      try {
        await this.analyticsService.batchUpdateStudentAnalytics(batch);
        processedStudents += batch.length;
        batchesProcessed++;

        logger.info(`Processed student analytics batch ${batchesProcessed}`, {
          batchSize: batch.length,
          totalProcessed: processedStudents,
          totalStudents: userIds.length,
        });
      } catch (error) {
        logger.error(`Failed to process student analytics batch ${batchesProcessed}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          batchUserIds: batch,
        });
        // Continue with next batch
      }
    }

    logger.info('Student analytics processing completed', {
      processedStudents,
      batchesProcessed,
      totalStudents: userIds.length,
    });

    return { processedStudents, batchesProcessed };
  }

  /**
   * Process trend reports job (weekly)
   */
  private async processTrendReports(data: TrendReportsJobData): Promise<{
    reportsGenerated: string[];
    dateRange: DateRange;
  }> {
    logger.info('Processing trend reports', { 
      dateRange: data.dateRange,
      reportTypes: data.reportTypes,
    });

    const reportsGenerated: string[] = [];

    try {
      for (const reportType of data.reportTypes) {
        try {
          const trends = await this.metricsCalculator.identifyTrends(reportType, data.dateRange);
          
          logger.info(`Generated trend report for ${reportType}`, {
            metric: trends.metric,
            trend: trends.trend,
            changePercentage: trends.changePercentage,
            dataPoints: trends.dataPoints.length,
          });

          reportsGenerated.push(reportType);
        } catch (error) {
          logger.error(`Failed to generate trend report for ${reportType}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue with next report type
        }
      }

      logger.info('Trend reports processing completed', {
        reportsGenerated,
        totalRequested: data.reportTypes.length,
      });

      return { reportsGenerated, dateRange: data.dateRange };
    } catch (error) {
      logger.error('Trend reports processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportsGenerated,
      });
      throw error;
    }
  }

  /**
   * Process executive summary job (monthly)
   */
  private async processExecutiveSummary(data: ExecutiveSummaryJobData): Promise<{
    summaryGenerated: boolean;
    dateRange: DateRange;
    keyMetrics: Record<string, any>;
  }> {
    logger.info('Processing executive summary', { 
      dateRange: data.dateRange,
      includeGrowthMetrics: data.includeGrowthMetrics,
    });

    try {
      // Generate comprehensive platform metrics
      const platformMetrics = await this.analyticsService.getPlatformMetrics(data.dateRange);
      
      // Get trending courses for the period
      const trendingCourses = await this.analyticsService.getTrendingCourses(5, data.dateRange);
      
      // Get top performing students
      const topStudents = await this.analyticsService.getTopPerformingStudents(5);

      const keyMetrics = {
        platform: {
          totalUsers: platformMetrics.totalUsers,
          activeUsers: platformMetrics.activeUsers,
          totalCourses: platformMetrics.totalCourses,
          totalEnrollments: platformMetrics.totalEnrollments,
          totalRevenue: platformMetrics.totalRevenue,
          averageCompletionRate: platformMetrics.averageCompletionRate,
          averageRating: platformMetrics.averageRating,
        },
        growth: data.includeGrowthMetrics ? platformMetrics.growthMetrics : undefined,
        trending: {
          topCourses: trendingCourses.length,
          topStudents: topStudents.length,
        },
      };

      logger.info('Executive summary processing completed', {
        dateRange: data.dateRange,
        keyMetrics: {
          totalUsers: keyMetrics.platform.totalUsers,
          totalRevenue: keyMetrics.platform.totalRevenue,
          completionRate: keyMetrics.platform.averageCompletionRate,
        },
      });

      return {
        summaryGenerated: true,
        dateRange: data.dateRange,
        keyMetrics,
      };
    } catch (error) {
      logger.error('Executive summary processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        dateRange: data.dateRange,
      });
      throw error;
    }
  }

  /**
   * Queue real-time metrics job (called by hourly cron)
   */
  async queueRealTimeMetrics(): Promise<string> {
    const job = await this.queue.add(
      'real-time-metrics',
      {
        type: 'real-time-metrics',
        timestamp: new Date(),
      },
      {
        priority: 5, // High priority for real-time metrics
      }
    );

    logger.info('Real-time metrics job queued', { jobId: job.id });
    return job.id!;
  }

  /**
   * Queue course analytics job (called by daily cron)
   */
  async queueCourseAnalytics(courseIds?: string[], batchSize?: number): Promise<string> {
    const job = await this.queue.add(
      'course-analytics',
      {
        type: 'course-analytics',
        courseIds,
        batchSize,
      },
      {
        priority: 10, // Normal priority
      }
    );

    logger.info('Course analytics job queued', { 
      jobId: job.id,
      courseCount: courseIds?.length || 'all',
      batchSize,
    });
    return job.id!;
  }

  /**
   * Queue student analytics job (called by daily cron)
   */
  async queueStudentAnalytics(userIds?: string[], batchSize?: number): Promise<string> {
    const job = await this.queue.add(
      'student-analytics',
      {
        type: 'student-analytics',
        userIds,
        batchSize,
      },
      {
        priority: 10, // Normal priority
      }
    );

    logger.info('Student analytics job queued', { 
      jobId: job.id,
      studentCount: userIds?.length || 'all',
      batchSize,
    });
    return job.id!;
  }

  /**
   * Queue trend reports job (called by weekly cron)
   */
  async queueTrendReports(dateRange: DateRange, reportTypes: string[]): Promise<string> {
    const job = await this.queue.add(
      'trend-reports',
      {
        type: 'trend-reports',
        dateRange,
        reportTypes,
      },
      {
        priority: 15, // Lower priority
      }
    );

    logger.info('Trend reports job queued', { 
      jobId: job.id,
      dateRange,
      reportTypes,
    });
    return job.id!;
  }

  /**
   * Queue executive summary job (called by monthly cron)
   */
  async queueExecutiveSummary(dateRange: DateRange, includeGrowthMetrics: boolean = true): Promise<string> {
    const job = await this.queue.add(
      'executive-summary',
      {
        type: 'executive-summary',
        dateRange,
        includeGrowthMetrics,
      },
      {
        priority: 20, // Lowest priority
      }
    );

    logger.info('Executive summary job queued', { 
      jobId: job.id,
      dateRange,
      includeGrowthMetrics,
    });
    return job.id!;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error('Failed to get analytics queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 7 days
      await this.queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'completed');
      
      // Clean failed jobs older than 14 days
      await this.queue.clean(14 * 24 * 60 * 60 * 1000, 25, 'failed');

      logger.info('Analytics queue cleanup completed');
    } catch (error) {
      logger.error('Analytics queue cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down analytics queue...');
    
    try {
      await this.worker.close();
      await this.queue.close();
      logger.info('Analytics queue shutdown completed');
    } catch (error) {
      logger.error('Analytics queue shutdown error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.queue.isPaused();
      return true;
    } catch (error) {
      logger.error('Analytics queue health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Singleton instance of AnalyticsQueue
 */
let analyticsQueueInstance: AnalyticsQueue | null = null;

/**
 * Get the singleton AnalyticsQueue instance
 */
export function getAnalyticsQueue(): AnalyticsQueue {
  if (!analyticsQueueInstance) {
    // This will be properly initialized with dependencies in the scheduler
    throw new Error('AnalyticsQueue not initialized. Call initializeAnalyticsQueue first.');
  }
  return analyticsQueueInstance;
}

/**
 * Initialize analytics queue (call this during application startup)
 */
export async function initializeAnalyticsQueue(
  analyticsService: AnalyticsService, 
  metricsCalculator: MetricsCalculator
): Promise<AnalyticsQueue> {
  if (!analyticsQueueInstance) {
    analyticsQueueInstance = new AnalyticsQueue(analyticsService, metricsCalculator);
  }
  
  // Perform health check
  await analyticsQueueInstance.healthCheck();
  
  logger.info('Analytics queue initialized successfully');
  return analyticsQueueInstance;
}

/**
 * Shutdown analytics queue (call this during application shutdown)
 */
export async function shutdownAnalyticsQueue(): Promise<void> {
  if (analyticsQueueInstance) {
    await analyticsQueueInstance.shutdown();
    analyticsQueueInstance = null;
  }
}