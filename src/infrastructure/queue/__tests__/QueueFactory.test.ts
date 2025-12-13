/**
 * Queue Factory Tests
 *
 * Unit tests for the QueueFactory implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueFactory } from '../QueueFactory.js';
import { QueueFactoryOptions } from '../types.js';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
    getDelayed: vi.fn().mockResolvedValue([]),
    isPaused: vi.fn().mockResolvedValue(false),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    name: 'test-queue',
  })),
  Worker: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    name: 'test-queue',
  })),
}));

// Mock Redis
vi.mock('../../cache/index.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

describe('QueueFactory', () => {
  let queueFactory: QueueFactory;
  const mockOptions: QueueFactoryOptions = {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'test-password',
    },
  };

  beforeEach(() => {
    // Reset singleton
    (QueueFactory as any).instance = undefined;
    queueFactory = QueueFactory.getInstance(mockOptions);
  });

  afterEach(async () => {
    await queueFactory.shutdown();
  });

  describe('getInstance', () => {
    it('should create singleton instance', () => {
      const instance1 = QueueFactory.getInstance(mockOptions);
      const instance2 = QueueFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should throw error if no options provided on first call', () => {
      (QueueFactory as any).instance = undefined;

      expect(() => QueueFactory.getInstance()).toThrow(
        'QueueFactory options required for first initialization'
      );
    });
  });

  describe('createQueue', () => {
    it('should create a typed queue', () => {
      interface TestJobData {
        id: string;
        data: string;
      }

      const queue = queueFactory.createQueue<TestJobData>('videoProcessing');

      expect(queue).toBeDefined();
      expect(typeof queue.add).toBe('function');
      expect(typeof queue.getStats).toBe('function');
    });

    it('should return existing queue if already created', () => {
      const queue1 = queueFactory.createQueue('videoProcessing');
      const queue2 = queueFactory.createQueue('videoProcessing');

      expect(queue1).toBe(queue2);
    });
  });

  describe('createWorker', () => {
    it('should create a typed worker', () => {
      interface TestJobData {
        id: string;
        data: string;
      }

      const processor = vi.fn().mockResolvedValue({ success: true });
      const worker = queueFactory.createWorker<TestJobData>('emailSending', processor);

      expect(worker).toBeDefined();
      expect(typeof worker.close).toBe('function');
    });

    it('should throw error if worker already exists', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      queueFactory.createWorker('emailSending', processor);

      expect(() => {
        queueFactory.createWorker('emailSending', processor);
      }).toThrow('Worker for queue email-sending already exists');
    });
  });

  describe('getAllQueueStats', () => {
    it('should return stats for all queues', async () => {
      queueFactory.createQueue('videoProcessing');
      queueFactory.createQueue('emailSending');

      const stats = await queueFactory.getAllQueueStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toHaveProperty('name');
      expect(stats[0]).toHaveProperty('waiting');
      expect(stats[0]).toHaveProperty('active');
    });
  });

  describe('shutdown', () => {
    it('should shutdown all queues and workers', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      queueFactory.createQueue('videoProcessing');
      queueFactory.createWorker('emailSending', processor);

      await expect(queueFactory.shutdown()).resolves.not.toThrow();
    });
  });
});
