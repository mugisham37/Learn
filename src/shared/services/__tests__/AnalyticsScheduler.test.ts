/**
 * Analytics Scheduler Tests
 * 
 * Tests for the analytics scheduler implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsScheduler } from '../AnalyticsScheduler.js';
import { AnalyticsService } from '../../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../../modules/analytics/application/services/MetricsCalculator.js';

// Mock node-cron
vi.mock('node-cron', () => ({
  schedule: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(() => 'scheduled'),
  })),
}));

// Mock dependencies
vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../AnalyticsQueue.js', () => ({
  initializeAnalyticsQueue: vi.fn(),
  getAnalyticsQueue: vi.fn(() => ({
    queueRealTimeMetrics: vi.fn().mockResolvedValue('job-1'),
    queueCourseAnalytics: vi.fn().mockResolvedValue('job-2'),
    queueStudentAnalytics: vi.fn().mockResolvedValue('job-3'),
    queueTrendReports: vi.fn().mockResolvedValue('job-4'),
    queueExecutiveSummary: vi.fn().mockResolvedValue('job-5'),
    getQueueStats: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn(),
  })),
}));

describe('AnalyticsScheduler', () => {
  let analyticsScheduler: AnalyticsScheduler;
  let mockAnalyticsService: AnalyticsService;
  let mockMetricsCalculator: MetricsCalculator;

  beforeEach(() => {
    // Create mock services
    mockAnalyticsService = {} as any;
    mockMetricsCalculator = {} as any;

    analyticsScheduler = new AnalyticsScheduler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(
        analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator)
      ).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
      
      // Second initialization should not throw but should warn
      await expect(
        analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator)
      ).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const status = analyticsScheduler.getStatus();
      expect(status.config).toEqual({
        enableHourlyMetrics: true,
        enableDailyAnalytics: true,
        enableWeeklyReports: true,
        enableMonthlyReports: true,
        timezone: 'UTC',
      });
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        enableHourlyMetrics: false,
        timezone: 'America/New_York',
      };
      
      const scheduler = new AnalyticsScheduler(customConfig);
      const status = scheduler.getStatus();
      
      expect(status.config.enableHourlyMetrics).toBe(false);
      expect(status.config.timezone).toBe('America/New_York');
      expect(status.config.enableDailyAnalytics).toBe(true); // Should keep default
    });
  });

  describe('manual triggers', () => {
    beforeEach(async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
    });

    it('should trigger real-time metrics manually', async () => {
      const jobId = await analyticsScheduler.triggerRealTimeMetrics();
      expect(jobId).toBe('job-1');
    });

    it('should trigger daily analytics manually', async () => {
      const result = await analyticsScheduler.triggerDailyAnalytics();
      expect(result.courseJobId).toBe('job-2');
      expect(result.studentJobId).toBe('job-3');
    });

    it('should trigger weekly reports manually', async () => {
      const jobId = await analyticsScheduler.triggerWeeklyReports();
      expect(jobId).toBe('job-4');
    });

    it('should trigger monthly reports manually', async () => {
      const jobId = await analyticsScheduler.triggerMonthlyReports();
      expect(jobId).toBe('job-5');
    });
  });

  describe('status and health', () => {
    it('should return correct status before initialization', () => {
      const status = analyticsScheduler.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.scheduledTasks).toEqual([]);
    });

    it('should return queue stats after initialization', async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
      
      const stats = await analyticsScheduler.getQueueStats();
      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });

    it('should perform health check', async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
      
      const health = await analyticsScheduler.healthCheck();
      expect(health.scheduler).toBe(true);
      expect(health.queue).toBe(true);
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
    });

    it('should stop and start individual tasks', () => {
      const stopped = analyticsScheduler.stopTask('hourly-metrics');
      expect(stopped).toBe(true);
      
      const started = analyticsScheduler.startTask('hourly-metrics');
      expect(started).toBe(true);
    });

    it('should return false for non-existent tasks', () => {
      const stopped = analyticsScheduler.stopTask('non-existent');
      expect(stopped).toBe(false);
      
      const started = analyticsScheduler.startTask('non-existent');
      expect(started).toBe(false);
    });

    it('should stop and start all tasks', () => {
      expect(() => analyticsScheduler.stopAllTasks()).not.toThrow();
      expect(() => analyticsScheduler.startAllTasks()).not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await analyticsScheduler.initialize(mockAnalyticsService, mockMetricsCalculator);
      await expect(analyticsScheduler.shutdown()).resolves.not.toThrow();
    });
  });
});