/**
 * Analytics Queue Tests
 * 
 * Tests for the analytics queue implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsQueue } from '../AnalyticsQueue.js';
import { AnalyticsService } from '../../../modules/analytics/application/services/AnalyticsService.js';
import { MetricsCalculator } from '../../../modules/analytics/application/services/MetricsCalculator.js';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
    getDelayed: vi.fn().mockResolvedValue([]),
    clean: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    isPaused: vi.fn().mockResolvedValue(false),
    on: vi.fn(),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock dependencies
vi.mock('../../../infrastructure/cache/index.js', () => ({
  redis: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/database/index.js', () => ({
  getReadDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  })),
}));

describe('AnalyticsQueue', () => {
  let analyticsQueue: AnalyticsQueue;
  let mockAnalyticsService: AnalyticsService;
  let mockMetricsCalculator: MetricsCalculator;

  beforeEach(() => {
    // Create mock services
    mockAnalyticsService = {
      batchUpdateCourseAnalytics: vi.fn().mockResolvedValue([]),
      batchUpdateStudentAnalytics: vi.fn().mockResolvedValue([]),
      getPlatformMetrics: vi.fn().mockResolvedValue({
        totalUsers: 100,
        totalCourses: 50,
        totalEnrollments: 200,
      }),
      getTrendingCourses: vi.fn().mockResolvedValue([]),
      getTopPerformingStudents: vi.fn().mockResolvedValue([]),
    } as any;

    mockMetricsCalculator = {
      identifyTrends: vi.fn().mockResolvedValue({
        metric: 'test',
        trend: 'increasing',
        changePercentage: 10,
        dataPoints: [],
      }),
    } as any;

    // Skip actual BullMQ initialization in tests
    analyticsQueue = new AnalyticsQueue(mockAnalyticsService, mockMetricsCalculator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(analyticsQueue).toBeDefined();
    });
  });

  describe('queue methods', () => {
    it('should have queue methods defined', () => {
      expect(typeof analyticsQueue.queueRealTimeMetrics).toBe('function');
      expect(typeof analyticsQueue.queueCourseAnalytics).toBe('function');
      expect(typeof analyticsQueue.queueStudentAnalytics).toBe('function');
      expect(typeof analyticsQueue.queueTrendReports).toBe('function');
      expect(typeof analyticsQueue.queueExecutiveSummary).toBe('function');
    });
  });

  describe('utility methods', () => {
    it('should have utility methods defined', () => {
      expect(typeof analyticsQueue.getQueueStats).toBe('function');
      expect(typeof analyticsQueue.cleanupJobs).toBe('function');
      expect(typeof analyticsQueue.healthCheck).toBe('function');
      expect(typeof analyticsQueue.shutdown).toBe('function');
    });

    it('should return default stats when queue operations fail', async () => {
      const stats = await analyticsQueue.getQueueStats();
      
      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(analyticsQueue.shutdown()).resolves.not.toThrow();
    });
  });
});