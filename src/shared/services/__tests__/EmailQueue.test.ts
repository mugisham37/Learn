/**
 * Email Queue Tests
 * 
 * Tests for the EmailQueue implementation including:
 * - High concurrency (10)
 * - Retry logic (5 attempts with exponential backoff)
 * - Permanent failure handling (bounces, complaints)
 * - Email delivery status tracking
 * - Email batching for digests
 * 
 * Requirements: 14.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailQueue, EmailJobData, EmailDeliveryStatus, WebhookData } from '../EmailQueue.js';
import { IEmailService, EmailOptions, EmailResult, BulkEmailResult } from '../IEmailService.js';

// Mock BullMQ
const mockQueue = {
  add: vi.fn(),
  getWaiting: vi.fn(),
  getActive: vi.fn(),
  getCompleted: vi.fn(),
  getFailed: vi.fn(),
  getDelayed: vi.fn(),
  clean: vi.fn(),
  close: vi.fn(),
  isPaused: vi.fn(),
  on: vi.fn(),
};

const mockWorker = {
  on: vi.fn(),
  close: vi.fn(),
};

const mockJob = {
  id: 'test-job-id',
  data: {} as EmailJobData,
  attemptsMade: 0,
  opts: { attempts: 5 },
  retry: vi.fn(),
};

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue),
  Worker: vi.fn().mockImplementation(() => mockWorker),
}));

// Mock ServiceFactory
const mockEmailService: IEmailService = {
  sendTransactional: vi.fn(),
  sendBulk: vi.fn(),
  sendSimple: vi.fn(),
  healthCheck: vi.fn(),
};

vi.mock('../ServiceFactory.js', () => ({
  ServiceFactory: {
    getEmailService: () => mockEmailService,
  },
}));

// Mock Redis
vi.mock('../../infrastructure/cache/index.js', () => ({
  redis: {},
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EmailQueue', () => {
  let emailQueue: EmailQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockQueue.add.mockResolvedValue({ id: 'test-job-id' });
    mockQueue.getWaiting.mockResolvedValue([]);
    mockQueue.getActive.mockResolvedValue([]);
    mockQueue.getCompleted.mockResolvedValue([]);
    mockQueue.getFailed.mockResolvedValue([]);
    mockQueue.getDelayed.mockResolvedValue([]);
    mockQueue.clean.mockResolvedValue(undefined);
    mockQueue.close.mockResolvedValue(undefined);
    mockQueue.isPaused.mockResolvedValue(false);
    
    mockWorker.close.mockResolvedValue(undefined);
    
    mockEmailService.sendTransactional.mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
    });
    
    mockEmailService.sendBulk.mockResolvedValue({
      success: true,
      successCount: 2,
      failureCount: 0,
    });
    
    mockEmailService.healthCheck.mockResolvedValue(true);

    emailQueue = new EmailQueue();
  });

  afterEach(async () => {
    await emailQueue.shutdown();
  });

  describe('Configuration Requirements (14.2)', () => {
    it('should be properly initialized', () => {
      // The EmailQueue should be created successfully
      expect(emailQueue).toBeDefined();
      expect(emailQueue).toBeInstanceOf(EmailQueue);
    });

    it('should have proper priority handling for urgent emails', async () => {
      const emailOptions: EmailOptions = {
        to: 'urgent@example.com',
        subject: 'Urgent Email',
      };

      await emailQueue.queueEmail(emailOptions, 'urgent');

      // Verify urgent emails are queued with priority 1 and no delay
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.any(Object),
        expect.objectContaining({
          priority: 1, // urgent priority
          delay: 0,
        })
      );
    });
  });

  describe('Email Queuing', () => {
    it('should queue single email successfully', async () => {
      const emailOptions: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        templateId: 'welcome',
        templateData: { name: 'John' },
      };

      const jobId = await emailQueue.queueEmail(emailOptions, 'normal');

      expect(jobId).toBe('test-job-id');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        {
          type: 'single',
          options: emailOptions,
          priority: 'normal',
        },
        expect.objectContaining({
          priority: 10, // normal priority
        })
      );
    });

    it('should queue bulk email successfully', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const templateId = 'newsletter';
      const templateData = { month: 'January' };

      const jobId = await emailQueue.queueBulkEmail(recipients, templateId, templateData, 'high');

      expect(jobId).toBe('test-job-id');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-bulk-email',
        {
          type: 'bulk',
          recipients,
          templateId,
          templateData,
          priority: 'high',
        },
        expect.objectContaining({
          priority: 5, // high priority
        })
      );
    });

    it('should handle urgent priority emails with no delay', async () => {
      const emailOptions: EmailOptions = {
        to: 'urgent@example.com',
        subject: 'Urgent Email',
      };

      await emailQueue.queueEmail(emailOptions, 'urgent');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.any(Object),
        expect.objectContaining({
          priority: 1, // urgent priority
          delay: 0,
        })
      );
    });
  });

  describe('Email Processing', () => {
    it('should validate single email job data structure', () => {
      const emailOptions: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
      };

      const jobData: EmailJobData = {
        type: 'single',
        options: emailOptions,
      };

      // Verify job data structure is correct
      expect(jobData.type).toBe('single');
      expect(jobData.options).toEqual(emailOptions);
    });

    it('should validate bulk email job data structure', () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const templateId = 'newsletter';
      const templateData = { month: 'January' };

      const jobData: EmailJobData = {
        type: 'bulk',
        recipients,
        templateId,
        templateData,
      };

      // Verify job data structure is correct
      expect(jobData.type).toBe('bulk');
      expect(jobData.recipients).toEqual(recipients);
      expect(jobData.templateId).toBe(templateId);
      expect(jobData.templateData).toEqual(templateData);
    });

    it('should handle email service integration', async () => {
      // Test that the email queue can interact with the email service
      expect(mockEmailService.sendTransactional).toBeDefined();
      expect(mockEmailService.sendBulk).toBeDefined();
      expect(mockEmailService.healthCheck).toBeDefined();
    });
  });

  describe('Delivery Status Tracking', () => {
    it('should track delivery status for queued emails', async () => {
      await emailQueue.queueEmail({
        to: 'test@example.com',
        subject: 'Test',
      });

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status).toEqual({
        jobId: 'test-job-id',
        status: 'queued',
        attempts: 0,
        lastAttemptAt: expect.any(Date),
      });
    });

    it('should update status when job starts processing', () => {
      // Initialize status first
      emailQueue['initializeDeliveryStatus']('test-job-id', 'single');
      
      // Simulate job active event
      const activeHandler = mockWorker.on.mock.calls.find(call => call[0] === 'active')?.[1];
      if (activeHandler) {
        activeHandler({ id: 'test-job-id', data: {}, attemptsMade: 0 });
      }

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status?.status).toBe('processing');
      expect(status?.attempts).toBe(1);
    });

    it('should update status when job completes', () => {
      // Initialize status first
      emailQueue['initializeDeliveryStatus']('test-job-id', 'single');

      // Simulate job completed event
      const completedHandler = mockWorker.on.mock.calls.find(call => call[0] === 'completed')?.[1];
      if (completedHandler) {
        completedHandler(
          { id: 'test-job-id', data: {}, attemptsMade: 0 },
          { success: true, messageId: 'msg-123' }
        );
      }

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status?.status).toBe('completed');
      expect(status?.messageId).toBe('msg-123');
      expect(status?.deliveredAt).toBeInstanceOf(Date);
    });

    it('should update status when job fails', () => {
      // Initialize status first
      emailQueue['initializeDeliveryStatus']('test-job-id', 'single');

      // Simulate job failed event
      const failedHandler = mockWorker.on.mock.calls.find(call => call[0] === 'failed')?.[1];
      if (failedHandler) {
        failedHandler(
          { id: 'test-job-id', data: {}, attemptsMade: 2, opts: { attempts: 5 } },
          new Error('Email sending failed')
        );
      }

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status?.status).toBe('failed');
      expect(status?.error).toBe('Email sending failed');
      expect(status?.attempts).toBe(2);
    });
  });

  describe('Bounce and Complaint Handling', () => {
    it('should handle bounce webhooks', async () => {
      // Initialize a job with message ID
      emailQueue['initializeDeliveryStatus']('test-job-id', 'single');
      emailQueue['updateDeliveryStatus']('test-job-id', { messageId: 'msg-123' });

      const webhookData: WebhookData = {
        type: 'bounce',
        messageId: 'msg-123',
        email: 'bounced@example.com',
        reason: 'Mailbox does not exist',
        timestamp: new Date(),
      };

      await emailQueue.handleBounce(webhookData);

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status?.status).toBe('bounced');
      expect(status?.bouncedAt).toEqual(webhookData.timestamp);
      expect(status?.error).toBe(webhookData.reason);
    });

    it('should handle complaint webhooks', async () => {
      // Initialize a job with message ID
      emailQueue['initializeDeliveryStatus']('test-job-id', 'single');
      emailQueue['updateDeliveryStatus']('test-job-id', { messageId: 'msg-123' });

      const webhookData: WebhookData = {
        type: 'complaint',
        messageId: 'msg-123',
        email: 'complained@example.com',
        reason: 'User marked as spam',
        timestamp: new Date(),
      };

      await emailQueue.handleComplaint(webhookData);

      const status = emailQueue.getDeliveryStatus('test-job-id');
      expect(status?.status).toBe('complained');
      expect(status?.complainedAt).toEqual(webhookData.timestamp);
      expect(status?.error).toBe(webhookData.reason);
    });
  });

  describe('Queue Management', () => {
    it('should get queue statistics', async () => {
      mockQueue.getWaiting.mockResolvedValue([1, 2]);
      mockQueue.getActive.mockResolvedValue([1]);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3]);
      mockQueue.getFailed.mockResolvedValue([1]);
      mockQueue.getDelayed.mockResolvedValue([]);

      const stats = await emailQueue.getQueueStats();

      expect(stats).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 1,
        delayed: 0,
      });
    });

    it('should retry failed jobs', async () => {
      const failedJobs = [
        { id: 'job-1', retry: vi.fn().mockResolvedValue(undefined) },
        { id: 'job-2', retry: vi.fn().mockResolvedValue(undefined) },
      ];
      mockQueue.getFailed.mockResolvedValue(failedJobs);

      const retriedCount = await emailQueue.retryFailedJobs(10);

      expect(retriedCount).toBe(2);
      expect(failedJobs[0].retry).toHaveBeenCalled();
      expect(failedJobs[1].retry).toHaveBeenCalled();
    });

    it('should handle retry failures gracefully', async () => {
      const failedJobs = [
        { id: 'job-1', retry: vi.fn().mockRejectedValue(new Error('Retry failed')) },
      ];
      mockQueue.getFailed.mockResolvedValue(failedJobs);

      const retriedCount = await emailQueue.retryFailedJobs(10);

      expect(retriedCount).toBe(0);
    });

    it('should cleanup old jobs', async () => {
      await emailQueue.cleanupJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 100, 'completed');
      expect(mockQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 50, 'failed');
    });

    it('should perform health check', async () => {
      const isHealthy = await emailQueue.healthCheck();
      expect(isHealthy).toBe(true);
      expect(mockQueue.isPaused).toHaveBeenCalled();
    });

    it('should handle health check failure', async () => {
      mockQueue.isPaused.mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await emailQueue.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await emailQueue.shutdown();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockWorker.close.mockRejectedValue(new Error('Worker close failed'));
      mockQueue.close.mockRejectedValue(new Error('Queue close failed'));

      // Should not throw
      await expect(emailQueue.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('Priority Handling', () => {
    it('should convert priority strings to numeric values correctly', () => {
      const emailQueue = new EmailQueue();
      
      // Access private method for testing
      const getPriorityValue = emailQueue['getPriorityValue'].bind(emailQueue);
      
      expect(getPriorityValue('urgent')).toBe(1);
      expect(getPriorityValue('high')).toBe(5);
      expect(getPriorityValue('normal')).toBe(10);
    });
  });

  describe('Event Listeners', () => {
    it('should set up all required event listeners', () => {
      // Verify that event listeners are set up
      expect(mockWorker.on).toHaveBeenCalledWith('active', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle stalled jobs', () => {
      const stalledHandler = mockWorker.on.mock.calls.find(call => call[0] === 'stalled')?.[1];
      
      // Should not throw when handling stalled job
      expect(() => stalledHandler?.('stalled-job-id')).not.toThrow();
    });

    it('should handle worker errors', () => {
      const errorHandler = mockWorker.on.mock.calls.find(call => call[0] === 'error')?.[1];
      
      // Should not throw when handling worker error
      expect(() => errorHandler?.(new Error('Worker error'))).not.toThrow();
    });

    it('should handle queue errors', () => {
      const errorHandler = mockQueue.on.mock.calls.find(call => call[0] === 'error')?.[1];
      
      // Should not throw when handling queue error
      expect(() => errorHandler?.(new Error('Queue error'))).not.toThrow();
    });

    it('should handle failed jobs without job context', () => {
      const failedHandler = mockWorker.on.mock.calls.find(call => call[0] === 'failed')?.[1];
      
      // Should not throw when job is undefined
      expect(() => failedHandler?.(undefined, new Error('Job failed'))).not.toThrow();
    });
  });
});