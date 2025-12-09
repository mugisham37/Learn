/**
 * Notifications Schema Tests
 * 
 * Tests to verify the notifications schema structure and exports
 */

import { describe, it, expect } from 'vitest';
import {
  notifications,
  notificationTypeEnum,
  priorityEnum,
  type Notification,
  type NewNotification,
  type NotificationType,
  type Priority,
} from './notifications.schema';

describe('Notifications Schema', () => {
  describe('Table Definitions', () => {
    it('should export notifications table', () => {
      expect(notifications).toBeDefined();
      expect(typeof notifications).toBe('object');
    });
  });

  describe('Enum Definitions', () => {
    it('should export notificationTypeEnum', () => {
      expect(notificationTypeEnum).toBeDefined();
      expect(typeof notificationTypeEnum).toBe('function');
    });

    it('should export priorityEnum', () => {
      expect(priorityEnum).toBeDefined();
      expect(typeof priorityEnum).toBe('function');
    });
  });

  describe('Notifications Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(notifications);
      
      expect(columns).toContain('id');
      expect(columns).toContain('recipientId');
      expect(columns).toContain('notificationType');
      expect(columns).toContain('title');
      expect(columns).toContain('content');
      expect(columns).toContain('actionUrl');
      expect(columns).toContain('priority');
      expect(columns).toContain('isRead');
      expect(columns).toContain('readAt');
      expect(columns).toContain('metadata');
      expect(columns).toContain('expiresAt');
      expect(columns).toContain('createdAt');
    });
  });

  describe('Type Exports', () => {
    it('should export Notification types', () => {
      // Type check - will fail at compile time if types don't exist
      const notification: Notification = {} as Notification;
      const newNotification: NewNotification = {} as NewNotification;
      
      expect(notification).toBeDefined();
      expect(newNotification).toBeDefined();
    });

    it('should export NotificationType type', () => {
      // Type check - will fail at compile time if type doesn't exist
      const notificationType: NotificationType = 'new_message';
      
      expect(notificationType).toBeDefined();
    });

    it('should export Priority type', () => {
      // Type check - will fail at compile time if type doesn't exist
      const priority: Priority = 'normal';
      
      expect(priority).toBeDefined();
    });
  });
});
