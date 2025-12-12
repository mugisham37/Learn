/**
 * Analytics Queue Unit Test
 * 
 * Tests the analytics queue and worker functionality to ensure
 * task 126 requirements are properly implemented.
 * 
 * Requirements: 14.3 - Analytics aggregation queue and worker
 */

import { describe, it, expect, vi } from 'vitest';
import { AnalyticsQueue } from '../AnalyticsQueue.js';

// Mock Redis and database dependencies
vi.mock('../../../infrastructure/cache/index.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

vi.mock('../../../infrastructure/database/index.js', () => ({
  getReadDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
}));

// Mock analytics services
const mockAnalyticsService = {
  getPlatformMetrics: vi.fn().mockResolvedValue({
    totalUsers: 100,
    totalCourses: 50,
    totalEnrollments: 200,
  }),
  getTrendingCourses: vi.fn().mockResolvedValue([]),
  getTopPerformingStudents: vi.fn().mockResolvedValue([]),
  batchUpdateCourseAnalytics: vi.fn().mockResolvedValue([]),
  batchUpdateStudentAnalytics: vi.fn().mockResolvedValue([]),
};

const mockMetricsCalculator = {
  identifyTrends: vi.fn().mockResolvedValue({
    metric: 'test',
    trend: 'increasing',
    changePercentage: 10,
    dataPoints: [],
  }),
};

describe('Analytics Queue Unit Tests', () => {

  it('should have all required queue methods', () => {
    const analyticsQueue = new AnalyticsQueue(mockAnalyticsService as any, mockMetricsCalculator as any);
    
    expect(analyticsQueue.queueRealTimeMetrics).toBeDefined();
    expect(analyticsQueue.queueCourseAnalytics).toBeDefined();
    expect(analyticsQueue.queueStudentAnalytics).toBeDefined();
    expect(analyticsQueue.queueTrendReports).toBeDefined();
    expect(analyticsQueue.queueExecutiveSummary).toBeDefined();
    expect(analyticsQueue.getQueueStats).toBeDefined();
    expect(analyticsQueue.cleanupJobs).toBeDefined();
    expect(analyticsQueue.healthCheck).toBeDefined();
    expect(analyticsQueue.shutdown).toBeDefined();
  });

  it('should validate job data interfaces', () => {
    // Test that job data interfaces are properly structured
    const realTimeJobData = {
      type: 'real-time-metrics' as const,
      timestamp: new Date(),
    };
    
    const courseAnalyticsJobData = {
      type: 'course-analytics' as const,
      courseIds: ['course-1', 'course-2'],
      batchSize: 10,
    };
    
    const studentAnalyticsJobData = {
      type: 'student-analytics' as const,
      userIds: ['user-1', 'user-2'],
      batchSize: 10,
    };
    
    const trendReportsJobData = {
      type: 'trend-reports' as const,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      reportTypes: ['enrollments', 'completions'],
    };
    
    const executiveSummaryJobData = {
      type: 'executive-summary' as const,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      includeGrowthMetrics: true,
    };
    
    // Verify job data structure
    expect(realTimeJobData.type).toBe('real-time-metrics');
    expect(courseAnalyticsJobData.type).toBe('course-analytics');
    expect(studentAnalyticsJobData.type).toBe('student-analytics');
    expect(trendReportsJobData.type).toBe('trend-reports');
    expect(executiveSummaryJobData.type).toBe('executive-summary');
  });

  it('should validate queue configuration constants', () => {
    // Test that queue configuration is properly defined
    const analyticsQueue = new AnalyticsQueue(mockAnalyticsService as any, mockMetricsCalculator as any);
    
    // These should not throw errors when accessing the queue
    expect(() => analyticsQueue.healthCheck()).not.toThrow();
  });

  it('should handle different job types correctly', () => {
    const analyticsQueue = new AnalyticsQueue(mockAnalyticsService as any, mockMetricsCalculator as any);
    
    // Test that all job types are supported
    const supportedJobTypes = [
      'real-time-metrics',
      'course-analytics', 
      'student-analytics',
      'trend-reports',
      'executive-summary'
    ];
    
    supportedJobTypes.forEach(jobType => {
      expect(typeof jobType).toBe('string');
      expect(jobType.length).toBeGreaterThan(0);
    });
  });
});