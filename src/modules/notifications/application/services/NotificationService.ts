/**
 * Notification Service Implementation
 * 
 * Implements multi-channel notification delivery with user preference checking,
 * email template selection, push notification support (stub), and batching
 * capabilities to prevent notification spam.
 * 
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.7
 */

import { 
  INotificationService,
  CreateNotificationData,
  BatchNotificationData,
  NotificationDeliveryResult,
  BatchNotificationResult,
  NotificationEmailData,
  PushNotificationData,
} from './INotificationService.js';

import { 
  INotificationRepository,
  CreateNotificationDTO,
} from '../../infrastructure/repositories/INotificationRepository.js';

import { 
  Notification, 
  NotificationType 
} from '../../../../infrastructure/database/schema/notifications.schema.js';

import { 
  NotificationPreferences 
} from '../../../users/domain/value-objects/UserProfile.js';

import { 
  IUserProfileRepository 
} from '../../../users/infrastructure/repositories/IUserProfileRepository.js';

import { 
  IEmailService,
  EmailOptions,
} from '../../../../shared/services/IEmailService.js';

import { 
  IRealtimeService 
} from '../../../../shared/services/IRealtimeService.js';

import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ExternalServiceError,
} from '../../../../shared/errors/index.js';

import { logger } from '../../../../shared/utils/logger.js';

/**
 * Notification Service Implementation
 * 
 * Provides comprehensive notification management with:
 * - Multi-channel delivery (email, push, real-time)
 * - User preference checking
 * - Template-based email formatting
 * - Notification batching to prevent spam
 * - Real-time updates via WebSocket
 */
export class NotificationService implements INotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly emailService?: IEmailService,
    private readonly realtimeService?: IRealtimeService
  ) {}

  /**
   * Creates a notification and delivers it through appropriate channels
   * 
   * Requirements: 10.1, 10.4
   */
  async createNotification(data: CreateNotificationData): Promise<NotificationDeliveryResult> {
    try {
      // Validate input data
      this.validateNotificationData(data);

      // Check if recipient exists
      const userProfile = await this.userProfileRepository.findByUserId(data.recipientId);
      if (!userProfile) {
        throw new NotFoundError('User', data.recipientId);
      }

      // Create notification in database
      const notificationDto: CreateNotificationDTO = {
        recipientId: data.recipientId,
        notificationType: data.notificationType,
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl,
        priority: data.priority || 'normal',
        metadata: data.metadata || {},
        expiresAt: data.expiresAt,
      };

      const notification = await this.notificationRepository.create(notificationDto);

      // Initialize delivery result
      const result: NotificationDeliveryResult = {
        notificationId: notification.id,
        emailSent: false,
        pushSent: false,
        realtimeSent: false,
        errors: [],
      };

      // Get user notification preferences
      const preferences = userProfile.notificationPreferences || {};

      // Send real-time notification (always sent for in-app notifications)
      try {
        if (this.realtimeService) {
          await this.realtimeService.emitToUser(data.recipientId, 'notification-received', {
            notificationId: notification.id,
            type: notification.notificationType,
            title: notification.title,
            content: notification.content,
            actionUrl: notification.actionUrl,
            priority: notification.priority as 'low' | 'medium' | 'high',
            timestamp: notification.createdAt.toISOString(),
          });
          result.realtimeSent = true;
        }
      } catch (error) {
        logger.error('Failed to send real-time notification', {
          notificationId: notification.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.errors?.push('Real-time delivery failed');
      }

      // Send email notification if enabled
      if (await this.isNotificationEnabled(data.recipientId, data.notificationType, 'email')) {
        try {
          await this.sendEmail(notification);
          result.emailSent = true;
        } catch (error) {
          logger.error('Failed to send email notification', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          result.errors?.push('Email delivery failed');
        }
      }

      // Send push notification if enabled (stub for future implementation)
      if (await this.isNotificationEnabled(data.recipientId, data.notificationType, 'push')) {
        try {
          await this.sendPush(notification);
          result.pushSent = true;
        } catch (error) {
          logger.error('Failed to send push notification', {
            notificationId: notification.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          result.errors?.push('Push delivery failed');
        }
      }

      logger.info('Notification created and delivered', {
        notificationId: notification.id,
        recipientId: data.recipientId,
        type: data.notificationType,
        emailSent: result.emailSent,
        pushSent: result.pushSent,
        realtimeSent: result.realtimeSent,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create notification', {
        recipientId: data.recipientId,
        type: data.notificationType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw known errors
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof ExternalServiceError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExternalServiceError(
        'Failed to create notification',
        'notification_creation_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sends email notification using appropriate template
   * 
   * Requirements: 10.2
   */
  async sendEmail(notification: Notification): Promise<void> {
    try {
      if (!this.emailService) {
        logger.warn('Email service not configured, skipping email notification', {
          notificationId: notification.id,
        });
        return;
      }

      // Get recipient profile for name
      const userProfile = await this.userProfileRepository.findByUserId(notification.recipientId);
      if (!userProfile) {
        throw new NotFoundError('User profile', notification.recipientId);
      }

      // Get email template ID based on notification type
      const templateId = this.getEmailTemplateId(notification.notificationType);

      // Format email data
      const emailData = this.formatEmailData(notification, userProfile.fullName);

      // Send email
      const emailOptions: EmailOptions = {
        to: userProfile.userId, // This should be the email address, but we need to get it from user
        templateId,
        templateData: emailData,
        priority: notification.priority === 'urgent' ? 'urgent' : 
                 notification.priority === 'high' ? 'high' : 'normal',
      };

      const result = await this.emailService.sendTransactional(emailOptions);

      if (!result.success) {
        throw new ExternalServiceError(
          `Email sending failed: ${result.error}`,
          'email_send_failed'
        );
      }

      logger.info('Email notification sent successfully', {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        templateId,
        messageId: result.messageId,
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof ExternalServiceError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExternalServiceError(
        'Failed to send email notification',
        'email_send_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Sends push notification to user's registered devices
   * 
   * Currently a stub for future mobile app integration.
   * Will use Firebase Cloud Messaging or Apple Push Notification Service.
   * 
   * Requirements: 10.3 (future implementation)
   */
  async sendPush(notification: Notification): Promise<void> {
    try {
      // TODO: Implement push notification service integration
      // This is a stub for future mobile app support
      
      logger.info('Push notification service not yet implemented', {
        notificationId: notification.id,
        recipientId: notification.recipientId,
        type: notification.notificationType,
      });

      // For now, we'll just log that push would be sent
      const pushData = this.formatPushData(notification);
      
      logger.debug('Push notification data prepared', {
        notificationId: notification.id,
        pushData,
      });

      // Future implementation will:
      // 1. Get user's device tokens from database
      // 2. Format notification for FCM/APNS
      // 3. Send to Firebase Cloud Messaging or Apple Push Notification Service
      // 4. Handle delivery receipts and failures
      // 5. Update device token status if needed

    } catch (error) {
      logger.error('Failed to send push notification', {
        notificationId: notification.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'Failed to send push notification',
        'push_send_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks a notification as read and updates unread count
   * 
   * Requirements: 10.4
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    try {
      // Get notification to verify ownership
      const notification = await this.notificationRepository.findById(notificationId);
      if (!notification) {
        throw new NotFoundError('Notification', notificationId);
      }

      // Verify user owns the notification
      if (notification.recipientId !== userId) {
        throw new AuthorizationError('User does not own this notification');
      }

      // Mark as read
      const updatedNotification = await this.notificationRepository.markAsRead(notificationId);

      // Send real-time update for unread count
      if (this.realtimeService) {
        try {
          const unreadCount = await this.notificationRepository.countUnreadByRecipient(userId);
          await this.realtimeService.emitToUser(userId, 'notification-received', {
            notificationId: updatedNotification.id,
            type: 'unread_count_updated',
            title: 'Unread Count Updated',
            content: `You have ${unreadCount} unread notifications`,
            priority: 'low' as const,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error('Failed to send real-time unread count update', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Notification marked as read', {
        notificationId,
        userId,
      });

      return updatedNotification;
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        notificationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExternalServiceError(
        'Failed to mark notification as read',
        'mark_read_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Batches similar notifications to prevent spam
   * 
   * Requirements: 10.5
   */
  async batchNotifications(notifications: BatchNotificationData[]): Promise<BatchNotificationResult> {
    try {
      if (notifications.length === 0) {
        return {
          notifications: [],
          deliveryResults: [],
          totalCreated: 0,
          totalDelivered: 0,
        };
      }

      // Group notifications by recipient and type for batching
      const groupedNotifications = this.groupNotificationsForBatching(notifications);
      
      const createdNotifications: Notification[] = [];
      const deliveryResults: NotificationDeliveryResult[] = [];
      const errors: string[] = [];

      // Process each group
      for (const group of groupedNotifications) {
        try {
          if (group.notifications.length === 1) {
            // Single notification - process normally
            const result = await this.createNotification(group.notifications[0]);
            const notification = await this.notificationRepository.findById(result.notificationId);
            if (notification) {
              createdNotifications.push(notification);
              deliveryResults.push(result);
            }
          } else {
            // Multiple notifications - create digest
            const digestNotification = this.createDigestNotification(group);
            const result = await this.createNotification(digestNotification);
            const notification = await this.notificationRepository.findById(result.notificationId);
            if (notification) {
              createdNotifications.push(notification);
              deliveryResults.push(result);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to process notification group: ${errorMessage}`);
          logger.error('Failed to process notification group', {
            recipientId: group.recipientId,
            type: group.type,
            count: group.notifications.length,
            error: errorMessage,
          });
        }
      }

      const totalDelivered = deliveryResults.reduce((count, result) => {
        return count + (result.emailSent ? 1 : 0) + (result.pushSent ? 1 : 0) + (result.realtimeSent ? 1 : 0);
      }, 0);

      logger.info('Batch notifications processed', {
        totalInput: notifications.length,
        totalCreated: createdNotifications.length,
        totalDelivered,
        errorCount: errors.length,
      });

      return {
        notifications: createdNotifications,
        deliveryResults,
        totalCreated: createdNotifications.length,
        totalDelivered,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error('Failed to batch notifications', {
        notificationCount: notifications.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'Failed to batch notifications',
        'batch_notifications_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets user notification preferences for delivery decisions
   * 
   * Requirements: 10.7
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const userProfile = await this.userProfileRepository.findByUserId(userId);
      if (!userProfile) {
        throw new NotFoundError('User profile', userId);
      }

      return userProfile.notificationPreferences || {};
    } catch (error) {
      logger.error('Failed to get user notification preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Re-throw known errors
      if (error instanceof NotFoundError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ExternalServiceError(
        'Failed to get user notification preferences',
        'get_preferences_failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if user has enabled notifications for a specific type and channel
   * 
   * Requirements: 10.7
   */
  async isNotificationEnabled(
    userId: string, 
    notificationType: NotificationType, 
    channel: 'email' | 'push' | 'inApp'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);
      
      // Map notification types to preference keys
      const preferenceKey = this.mapNotificationTypeToPreferenceKey(notificationType);
      
      // Check channel-specific preference
      const channelPreferences = preferences[channel];
      if (!channelPreferences) {
        // Default to enabled if no preferences set
        return true;
      }

      const isEnabled = channelPreferences[preferenceKey];
      
      // Default to enabled if preference not explicitly set
      return isEnabled !== false;
    } catch (error) {
      logger.error('Failed to check notification preference', {
        userId,
        notificationType,
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Default to enabled on error to ensure notifications are delivered
      return true;
    }
  }

  /**
   * Gets the appropriate email template ID for a notification type
   */
  getEmailTemplateId(notificationType: NotificationType): string {
    const templateMap: Record<NotificationType, string> = {
      'new_message': 'new-message',
      'assignment_due': 'assignment-due',
      'grade_posted': 'grade-posted',
      'course_update': 'course-update',
      'announcement': 'announcement',
      'discussion_reply': 'discussion-reply',
      'enrollment_confirmed': 'enrollment-confirmed',
      'certificate_issued': 'certificate-issued',
      'payment_received': 'payment-received',
      'refund_processed': 'refund-processed',
    };

    return templateMap[notificationType] || 'generic-notification';
  }

  /**
   * Formats notification content for email delivery
   */
  formatEmailData(notification: Notification, recipientName: string): NotificationEmailData {
    return {
      recipientName,
      notificationTitle: notification.title,
      notificationContent: notification.content,
      actionUrl: notification.actionUrl,
      actionButtonText: this.getActionButtonText(notification.notificationType),
      unsubscribeUrl: `/settings/notifications`, // TODO: Generate proper unsubscribe URL
    };
  }

  /**
   * Formats notification content for push delivery
   */
  formatPushData(notification: Notification): PushNotificationData {
    return {
      title: notification.title,
      body: notification.content.length > 100 
        ? notification.content.substring(0, 97) + '...' 
        : notification.content,
      icon: this.getPushIcon(notification.notificationType),
      badge: 1, // TODO: Get actual unread count
      data: {
        notificationId: notification.id,
        type: notification.notificationType,
        actionUrl: notification.actionUrl,
        ...notification.metadata,
      },
      clickAction: notification.actionUrl,
    };
  }

  /**
   * Validates notification data
   */
  private validateNotificationData(data: CreateNotificationData): void {
    if (!data.recipientId || data.recipientId.trim().length === 0) {
      throw new ValidationError('Recipient ID is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Notification title is required');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Notification title cannot exceed 255 characters');
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Notification content is required');
    }

    if (data.actionUrl && data.actionUrl.length > 500) {
      throw new ValidationError('Action URL cannot exceed 500 characters');
    }
  }

  /**
   * Groups notifications for batching by recipient and type
   */
  private groupNotificationsForBatching(notifications: BatchNotificationData[]): Array<{
    recipientId: string;
    type: NotificationType;
    notifications: BatchNotificationData[];
  }> {
    const groups = new Map<string, BatchNotificationData[]>();

    for (const notification of notifications) {
      const key = `${notification.recipientId}:${notification.notificationType}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(notification);
    }

    return Array.from(groups.entries()).map(([key, notifications]) => {
      const [recipientId, type] = key.split(':');
      return {
        recipientId,
        type: type as NotificationType,
        notifications,
      };
    });
  }

  /**
   * Creates a digest notification from multiple similar notifications
   */
  private createDigestNotification(group: {
    recipientId: string;
    type: NotificationType;
    notifications: BatchNotificationData[];
  }): CreateNotificationData {
    const count = group.notifications.length;
    const type = group.type;

    // Create digest title and content based on notification type
    let title: string;
    let content: string;

    switch (type) {
      case 'new_message':
        title = `You have ${count} new messages`;
        content = `You have received ${count} new messages. Click to view your conversations.`;
        break;
      case 'discussion_reply':
        title = `${count} new discussion replies`;
        content = `There are ${count} new replies to discussions you're following.`;
        break;
      case 'assignment_due':
        title = `${count} assignments due soon`;
        content = `You have ${count} assignments with upcoming due dates.`;
        break;
      default:
        title = `${count} new notifications`;
        content = `You have ${count} new ${type.replace('_', ' ')} notifications.`;
    }

    return {
      recipientId: group.recipientId,
      notificationType: type,
      title,
      content,
      priority: group.notifications.some(n => n.priority === 'urgent') ? 'urgent' :
               group.notifications.some(n => n.priority === 'high') ? 'high' : 'normal',
      metadata: {
        isDigest: true,
        originalCount: count,
        digestedNotifications: group.notifications.map(n => ({
          title: n.title,
          content: n.content,
          actionUrl: n.actionUrl,
        })),
      },
    };
  }

  /**
   * Maps notification type to user preference key
   */
  private mapNotificationTypeToPreferenceKey(notificationType: NotificationType): keyof NotificationPreferences['email'] {
    const keyMap: Record<NotificationType, keyof NotificationPreferences['email']> = {
      'new_message': 'newMessage',
      'assignment_due': 'assignmentDue',
      'grade_posted': 'gradePosted',
      'course_update': 'courseUpdate',
      'announcement': 'announcement',
      'discussion_reply': 'discussionReply',
      'enrollment_confirmed': 'courseUpdate', // Map to courseUpdate as closest match
      'certificate_issued': 'courseUpdate', // Map to courseUpdate as closest match
      'payment_received': 'courseUpdate', // Map to courseUpdate as closest match
      'refund_processed': 'courseUpdate', // Map to courseUpdate as closest match
    };

    return keyMap[notificationType] || 'courseUpdate';
  }

  /**
   * Gets action button text for email templates
   */
  private getActionButtonText(notificationType: NotificationType): string {
    const buttonTextMap: Record<NotificationType, string> = {
      'new_message': 'View Message',
      'assignment_due': 'View Assignment',
      'grade_posted': 'View Grade',
      'course_update': 'View Course',
      'announcement': 'View Announcement',
      'discussion_reply': 'View Discussion',
      'enrollment_confirmed': 'View Course',
      'certificate_issued': 'Download Certificate',
      'payment_received': 'View Receipt',
      'refund_processed': 'View Details',
    };

    return buttonTextMap[notificationType] || 'View Details';
  }

  /**
   * Gets push notification icon for notification type
   */
  private getPushIcon(notificationType: NotificationType): string {
    const iconMap: Record<NotificationType, string> = {
      'new_message': 'message',
      'assignment_due': 'assignment',
      'grade_posted': 'grade',
      'course_update': 'course',
      'announcement': 'announcement',
      'discussion_reply': 'discussion',
      'enrollment_confirmed': 'enrollment',
      'certificate_issued': 'certificate',
      'payment_received': 'payment',
      'refund_processed': 'refund',
    };

    return iconMap[notificationType] || 'notification';
  }
}