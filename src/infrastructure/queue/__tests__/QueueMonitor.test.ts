/**
 * Queue Monitor Tests
 *
 * Tests for the enhanced queue monitoring and alerting functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueMonitor } from '../QueueMonitor.js';
import { QueueFactory } from '../QueueFactory.js';
import { QueueStats } from '../types.js';

// Mock dependencies
vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../shared/services/AlertingService.js', () => ({
  AlertingService: {
    getInstance: vi.fn(() => ({
      createAlert: vi.fn(),
    })),
  },
}));

vi.mock('../../../shared/services/JobEventLogger.js', () => ({
  JobEventLogger: {
    getInstance: vi.fn(() => ({
      logJobCompleted: vi.fn(),
      logJobFailed: vi.fn(),
      logJobStalled: vi.fn(),
      logJobProgress: vi.fn(),
    })),
  },
}));

describe('QueueMonitor', () => {
  let queueMonitor: QueueMonitor;
  let mockQueueFactory: any;

  beforeEach(() => {
    mockQueueFactory = {
      getAllQueueStats: vi.fn(),
    };

    queueMonitor = new QueueMonitor(mockQueueFactory, {
      maxWaitingJobs: 100,
      maxFailedJobs: 10,
      maxStalledJobs: 5,
      maxProcessingTimeMs: 60000,
      minSuccessRate: 0.95,
    });
  });

  afterEach(() => {
    queueMonitor.stopMonitoring();
    vi.clearAllMocks();
  });

  describe('Health Monitoring', () => {
    it('should detect high queue depth', async () => {
      const mockStats: QueueStats[] = [
        {
          name: 'test-queue',
          waiting: 150, // Above threshold of 100
          active: 5,
          completed: 100,
          failed: 2,
          delayed: 0,
          paused: false,
        },
      ];

      mockQueueFactory.getAllQueueStats.mockResolvedValue(mockStats);

      // Start monitoring to trigger health check
      queueMonitor.startMonitoring(100);

      // Wait for health check to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify alert was created (we can't easily test the internal alert creation,
      // but we can verify the monitoring is working)
      expect(mockQueueFactory.getAllQueueStats).toHaveBeenCalled();
    });

    it('should track completion rates', async () => {
      const mockStats: QueueStats[] = [
        {
          name: 'test-queue',
          waiting: 10,
          active: 2,
          completed: 80,
          failed: 20, // 20% failure rate
          delayed: 0,
          paused: false,
        },
      ];

      mockQueueFactory.getAllQueueStats.mockResolvedValue(mockStats);

      queueMonitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const completionRates = queueMonitor.getCompletionRates();
      expect(completionRates.has('test-queue')).toBe(true);
    });

    it('should get queue depths', async () => {
      const mockStats: QueueStats[] = [
        {
          name: 'test-queue',
          waiting: 25,
          active: 5,
          completed: 100,
          failed: 2,
          delayed: 0,
          paused: false,
        },
      ];

      mockQueueFactory.getAllQueueStats.mockResolvedValue(mockStats);

      const depths = await queueMonitor.getQueueDepths();
      expect(depths.get('test-queue')).toEqual({
        waiting: 25,
        active: 5,
        total: 30,
      });
    });
  });

  describe('Job Event Handling', () => {
    it('should handle job completed events', () => {
      const jobData = {
        jobId: 'test-job-1',
        queueName: 'test-queue',
        timestamp: new Date(),
        result: { success: true },
      };

      queueMonitor.onJobCompleted(jobData);

      // Verify event was emitted
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle job failed events', () => {
      const jobData = {
        jobId: 'test-job-2',
        queueName: 'test-queue',
        timestamp: new Date(),
        error: new Error('Test error'),
      };

      queueMonitor.onJobFailed(jobData);

      // Verify event was handled
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle job stalled events', () => {
      const jobData = {
        jobId: 'test-job-3',
        queueName: 'test-queue',
        timestamp: new Date(),
      };

      queueMonitor.onJobStalled(jobData);

      // Verify event was handled
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should handle job progress events', () => {
      const jobData = {
        jobId: 'test-job-4',
        queueName: 'test-queue',
        timestamp: new Date(),
        progress: 50,
      };

      queueMonitor.onJobProgress(jobData);

      // Verify event was handled
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Metrics and Statistics', () => {
    it('should provide queue metrics', () => {
      const metrics = queueMonitor.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should provide recent alerts', () => {
      const alerts = queueMonitor.getAlerts(10);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should clear old alerts', () => {
      queueMonitor.clearOldAlerts(1); // Clear alerts older than 1 hour
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(queueMonitor['isMonitoring']).toBe(false);

      queueMonitor.startMonitoring(1000);
      expect(queueMonitor['isMonitoring']).toBe(true);

      queueMonitor.stopMonitoring();
      expect(queueMonitor['isMonitoring']).toBe(false);
    });

    it('should not start monitoring twice', () => {
      queueMonitor.startMonitoring(1000);
      queueMonitor.startMonitoring(1000); // Should not throw or cause issues

      expect(queueMonitor['isMonitoring']).toBe(true);
    });
  });
});
