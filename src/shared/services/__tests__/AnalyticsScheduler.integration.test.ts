/**
 * Analytics Scheduler Integration Test
 * 
 * Tests the analytics scheduler functionality to ensure
 * task 126 requirements are properly implemented.
 * 
 * Requirements: 14.3 - Analytics aggregation on cron triggers
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { AnalyticsScheduler, initializeAnalyticsScheduler } from '../AnalyticsScheduler.js';
import { AnalyticsService } from '../../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../../modules/analytics/application/services/MetricsCalculator.js';

// Mock dependencies
const mockAnalyticsRepository = {
  events: {
    create: vi.fn(),
  },
  courseAnalytics: {
    upsert: vi.fn(),
    findByCourseIds: vi.fn(),
  },
  studentAnalytics: {
    upsert: vi.fn(),
    findTopPerformers: vi.fn(),
  },
};

describe('Analytics Scheduler Integration', () => {
  let analyticsScheduler: AnalyticsScheduler;
  let analyticsService: AnalyticsService;
  let metricsCalculator: MetricsCalculator;

  beforeAll(async () => {
    // Initialize services with mocked dependencies
    analyticsService = new AnalyticsService(mockAnalyticsRepository as any);
    metricsCalculator = new MetricsCalculator();
    
    // Initialize the analytics scheduler with test configuration
    const testConfig = {
      enableHourlyMetrics: false, // Disable for testing
      enableDailyAnalytics: false,
      enableWeeklyReports: false,
      enableMonthlyReports: false,
      timezone: 'UTC',
    };
    
    analyticsScheduler = await initializeAnalyticsScheduler(
      analyticsService, 
      metricsCalculator, 
      testConfig
    );
  });

  afterAll(async () => {
    // Clean up
    if (analyticsScheduler) {
      await analyticsScheduler.shutdown();
    }
  });

  it('should initialize analytics scheduler successfully', () => {
    expect(analyticsScheduler).toBeDefined();
    expect(analyticsScheduler.getStatus).toBeDefined();
    expect(analyticsScheduler.triggerRealTimeMetrics).toBeDefined();
    expect(analyticsScheduler.triggerDailyAnalytics).toBeDefined();
  });

  it('should return correct status', () => {
    const status = analyticsScheduler.getStatus();
    expect(status.isInitialized).toBe(true);
    expect(status.config).toBeDefined();
    expect(status.scheduledTasks).toBeDefined();
    expect(Array.isArray(status.scheduledTasks)).toBe(true);
  });

  it('should manually trigger real-time metrics', async () => {
    const jobId = await analyticsScheduler.triggerRealTimeMetrics();
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should manually trigger daily analytics', async () => {
    const result = await analyticsScheduler.triggerDailyAnalytics();
    expect(result.courseJobId).toBeDefined();
    expect(result.studentJobId).toBeDefined();
    expect(typeof result.courseJobId).toBe('string');
    expect(typeof result.studentJobId).toBe('string');
  });

  it('should manually trigger weekly reports', async () => {
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-07'),
    };
    
    const jobId = await analyticsScheduler.triggerWeeklyReports(dateRange);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should manually trigger monthly reports', async () => {
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    };
    
    const jobId = await analyticsScheduler.triggerMonthlyReports(dateRange);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should get queue statistics', async () => {
    const stats = await analyticsScheduler.getQueueStats();
    expect(stats).toBeDefined();
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
    expect(typeof stats.delayed).toBe('number');
  });

  it('should pass health check', async () => {
    const health = await analyticsScheduler.healthCheck();
    expect(health.scheduler).toBe(true);
    expect(health.queue).toBe(true);
    expect(health.tasks).toBeDefined();
  });

  it('should handle task management', () => {
    // Stop and start all tasks (should not throw)
    expect(() => analyticsScheduler.stopAllTasks()).not.toThrow();
    expect(() => analyticsScheduler.startAllTasks()).not.toThrow();
  });
});