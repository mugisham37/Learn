/**
 * Notification Service Interface
 *
 * Defines the contract for notification service implementations.
 * Handles multi-channel notification delivery (email, push, in-app)
 * with user preference checking and batching capabilities.
 *
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.7
 */

import {
  Notification,
  NotificationType,
  Priority,
} from '../../../../infrastructure/database/schema/notifications.schema.js';
import { NotificationPreferences } from '../../../users/domain/value-objects/UserProfile.js';

/**
 * Data Transfer Object for creating a new notification
 */
export interface CreateNotificationData {
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  priority?: Priority;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

/**
 * Batch notification data for similar notifications
 */
export interface BatchNotificationData {
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  priority?: Priority;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

/**
 * Email template data for notification emails
 */
export interface NotificationEmailData extends Record<string, unknown> {
  recipientName: string;
  notificationTitle: string;
  notificationContent: string;
  actionUrl?: string;
  actionButtonText?: string;
  unsubscribeUrl?: string;
}

/**
 * Push notification data
 */
export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: number;
  data?: Record<string, unknown>;
  clickAction?: string;
}

/**
 * Notification delivery result
 */
export interface NotificationDeliveryResult {
  notificationId: string;
  emailSent: boolean;
  pushSent: boolean;
  realtimeSent: boolean;
  errors?: string[];
}

/**
 * Batch notification result
 */
export interface BatchNotificationResult {
  notifications: Notification[];
  deliveryResults: NotificationDeliveryResult[];
  totalCreated: number;
  totalDelivered: number;
  errors?: string[];
}

/**
 * Notification Service Interface
 *
 * Provides methods for creating notifications and delivering them through
 * multiple channels based on user preferences.
 */
export interface INotificationService {
  /**
   * Creates a notification and delivers it through appropriate channels
   *
   * Checks user preferences before sending email and push notifications.
   * Always creates in-app notification and sends real-time update.
   *
   * @param data - Notification creation data
   * @returns Promise resolving to notification delivery result
   * @throws ValidationError if notification data is invalid
   * @throws NotFoundError if recipient doesn't exist
   * @throws ExternalServiceError if delivery fails
   */
  createNotification(data: CreateNotificationData): Promise<NotificationDeliveryResult>;

  /**
   * Sends email notification using appropriate template
   *
   * Selects email template based on notification type and populates
   * with dynamic data. Respects user email preferences.
   *
   * @param notification - Notification to send via email
   * @returns Promise resolving when email is sent
   * @throws ExternalServiceError if email sending fails
   */
  sendEmail(notification: Notification): Promise<void>;

  /**
   * Sends push notification to user's registered devices
   *
   * Currently a stub for future mobile app integration.
   * Will use Firebase Cloud Messaging or Apple Push Notification Service.
   *
   * @param notification - Notification to send via push
   * @returns Promise resolving when push is sent
   * @throws ExternalServiceError if push sending fails
   */
  sendPush(notification: Notification): Promise<void>;

  /**
   * Marks a notification as read and updates unread count
   *
   * Updates the notification read status and timestamp.
   * Invalidates cache and sends real-time update to user.
   *
   * @param notificationId - ID of notification to mark as read
   * @param userId - ID of user marking notification as read
   * @returns Promise resolving to updated notification
   * @throws NotFoundError if notification doesn't exist
   * @throws AuthorizationError if user doesn't own notification
   */
  markAsRead(notificationId: string, userId: string): Promise<Notification>;

  /**
   * Batches similar notifications to prevent spam
   *
   * Groups notifications by type and recipient, creating digest
   * notifications instead of individual ones when appropriate.
   *
   * @param notifications - Array of notification data to batch
   * @returns Promise resolving to batch notification result
   * @throws ValidationError if notification data is invalid
   */
  batchNotifications(notifications: BatchNotificationData[]): Promise<BatchNotificationResult>;

  /**
   * Gets user notification preferences for delivery decisions
   *
   * Retrieves user preferences to determine which channels to use
   * for notification delivery.
   *
   * @param userId - ID of user to get preferences for
   * @returns Promise resolving to user notification preferences
   * @throws NotFoundError if user doesn't exist
   */
  getUserNotificationPreferences(userId: string): Promise<NotificationPreferences>;

  /**
   * Checks if user has enabled notifications for a specific type and channel
   *
   * @param userId - ID of user to check preferences for
   * @param notificationType - Type of notification to check
   * @param channel - Delivery channel to check ('email', 'push', 'inApp')
   * @returns Promise resolving to true if notifications are enabled
   */
  isNotificationEnabled(
    userId: string,
    notificationType: NotificationType,
    channel: 'email' | 'push' | 'inApp'
  ): Promise<boolean>;

  /**
   * Gets the appropriate email template ID for a notification type
   *
   * @param notificationType - Type of notification
   * @returns Email template identifier
   */
  getEmailTemplateId(notificationType: NotificationType): string;

  /**
   * Formats notification content for email delivery
   *
   * @param notification - Notification to format
   * @param recipientName - Name of notification recipient
   * @returns Email template data
   */
  formatEmailData(notification: Notification, recipientName: string): NotificationEmailData;

  /**
   * Formats notification content for push delivery
   *
   * @param notification - Notification to format
   * @returns Push notification data
   */
  formatPushData(notification: Notification): PushNotificationData;
}
