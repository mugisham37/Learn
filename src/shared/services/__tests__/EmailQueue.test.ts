/**
 * Email Queue Tests
 * 
 * Tests for the EmailQueue implementation with BullMQ
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailQueue, getEmailQueue, initializeEmailQueue, shutdownEmailQueue } from '../EmailQueue.js';
import { EmailOptions } from '../IEmailService.js';

// Mock Redis and BullMQ
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

vi.mock('../../infrastructure/cache/index.js', () => ({
  redis: {
    // Mock Redis instance
  },
}));

vi.mock('../ServiceFactory.js', () => ({
  ServiceFactory: {
    getEmailService: vi.fn().mockReturnValue({
      sendTransactional: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      }),
      sendBulk: vi.fn().mockResolvedValue({
        success: true,
        successCount: 2,
        failureCount: 0,
      }),
    }),
  },
}));

describe('EmailQueue', () => {
  let emailQueue: EmailQueue;

  beforeEach(async () => {
    emailQueue = getEmailQueue();
  });

  afterEach(async () => {
    await shutdownEmailQueue();
  });

  describe('queueEmail', () => {
    it('should queue a single email successfully', async () => {
      const emailOptions: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        templateId: 'welcome',
        templateData: { name: 'John Doe' },
      };

      const jobId = await emailQueue.queueEmail(emailOptions, 'normal');

      expect(jobId).toBe('test-job-id');
    });

    it('should queue an urgent email with high priority', async () => {
      const emailOptions: EmailOptions = {
        to: 'urgent@example.com',
        subject: 'Urgent Email',
        templateId: 'urgent-notification',
      };

      const jobId = await emailQueue.queueEmail(emailOptions, 'urgent');

      expect(jobId).toBe('test-job-id');
    });
  });

  describe('queueBulkEmail', () => {
    it('should queue bulk emails successfully', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const templateId = 'newsletter';
      const templateData = { month: 'January' };

      const jobId = await emailQueue.queueBulkEmail(recipients, templateId, templateData, 'normal');

      expect(jobId).toBe('test-job-id');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await emailQueue.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy queue', async () => {
      const isHealthy = await emailQueue.healthCheck();

      expect(isHealthy).toBe(true);
    });
  });

  describe('webhook handling', () => {
    it('should handle bounce webhook', async () => {
      const webhookData = {
        type: 'bounce' as const,
        messageId: 'test-message-id',
        email: 'bounced@example.com',
        reason: 'Mailbox does not exist',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(emailQueue.handleBounce(webhookData)).resolves.toBeUndefined();
    });

    it('should handle complaint webhook', async () => {
      const webhookData = {
        type: 'complaint' as const,
        messageId: 'test-message-id',
        email: 'complaint@example.com',
        reason: 'User marked as spam',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(emailQueue.handleComplaint(webhookData)).resolves.toBeUndefined();
    });
  });

  describe('delivery status tracking', () => {
    it('should track delivery status', async () => {
      const emailOptions: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        templateId: 'welcome',
      };

      const jobId = await emailQueue.queueEmail(emailOptions);
      const status = emailQueue.getDeliveryStatus(jobId);

      expect(status).toMatchObject({
        jobId,
        status: 'queued',
        attempts: 0,
      });
    });

    it('should return null for non-existent job', () => {
      const status = emailQueue.getDeliveryStatus('non-existent-job');
      expect(status).toBeNull();
    });
  });

  describe('initialization and shutdown', () => {
    it('should initialize email queue', async () => {
      const queue = await initializeEmailQueue();
      expect(queue).toBeInstanceOf(EmailQueue);
    });

    it('should shutdown gracefully', async () => {
      await expect(shutdownEmailQueue()).resolves.toBeUndefined();
    });
  });
});