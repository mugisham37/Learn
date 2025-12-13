/**
 * Notification Preference Service Implementation
 *
 * Implements notification preference management operations including getting,
 * updating, and validating user notification preferences. Integrates with
 * the user profile service to store preferences in the JSONB column.
 *
 * Requirements: 10.7
 */

import { NotificationType } from '../../../../infrastructure/database/schema/notifications.schema.js';
import { ValidationError, NotFoundError } from '../../../../shared/errors/index.js';
import { logger } from '../../../../shared/utils/logger.js';
import { IUserProfileService } from '../../../users/application/services/IUserProfileService.js';
import { NotificationPreferences } from '../../../users/domain/value-objects/UserProfile.js';

import {
  INotificationPreferenceService,
  NotificationPreferenceUpdate,
  NotificationPreferenceValidationResult,
} from './INotificationPreferenceService.js';

/**
 * Notification Preference Service Implementation
 *
 * Provides notification preference management with:
 * - Getting and updating user preferences
 * - Preference validation and defaults
 * - Integration with user profile storage
 * - Channel-specific preference checking
 */
export class NotificationPreferenceService implements INotificationPreferenceService {
  constructor(private readonly userProfileService: IUserProfileService) {}

  /**
   * Gets a user's notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      logger.info('Getting notification preferences', { userId });

      const preferences = await this.userProfileService.getNotificationPreferences(userId);

      logger.info('Notification preferences retrieved successfully', { userId });
      return preferences;
    } catch (error) {
      logger.error('Failed to get notification preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new Error(
        `Failed to get notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Updates a user's notification preferences
   */
  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      logger.info('Updating notification preferences', { userId });

      // Validate preferences
      const validation = this.validatePreferences(preferences);
      if (!validation.isValid) {
        throw new ValidationError(
          `Invalid notification preferences: ${validation.errors.join(', ')}`
        );
      }

      // Update preferences through user profile service
      await this.userProfileService.updateNotificationPreferences(userId, preferences);

      logger.info('Notification preferences updated successfully', { userId });
    } catch (error) {
      logger.error('Failed to update notification preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new Error(
        `Failed to update notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Updates a specific notification preference setting
   */
  async updatePreference(userId: string, update: NotificationPreferenceUpdate): Promise<void> {
    try {
      logger.info('Updating specific notification preference', {
        userId,
        channel: update.channel,
        notificationType: update.notificationType,
        enabled: update.enabled,
      });

      // Validate update parameters
      this.validatePreferenceUpdate(update);

      // Get current preferences
      const currentPreferences = await this.getPreferences(userId);

      // Update the specific preference
      const updatedPreferences = this.updateSpecificPreference(currentPreferences, update);

      // Save updated preferences
      await this.updatePreferences(userId, updatedPreferences);

      logger.info('Specific notification preference updated successfully', {
        userId,
        channel: update.channel,
        notificationType: update.notificationType,
        enabled: update.enabled,
      });
    } catch (error) {
      logger.error('Failed to update specific notification preference', {
        userId,
        update,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new Error(
        `Failed to update notification preference: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if a user has enabled notifications for a specific type and channel
   */
  async isNotificationEnabled(
    userId: string,
    notificationType: NotificationType,
    channel: 'email' | 'push' | 'inApp'
  ): Promise<boolean> {
    try {
      logger.debug('Checking notification enabled status', { userId, notificationType, channel });

      const preferences = await this.getPreferences(userId);

      // Map notification type to preference key
      const preferenceKey = this.mapNotificationTypeToPreferenceKey(notificationType);

      // Check channel-specific preference
      const channelPreferences = preferences[channel] as Record<string, boolean> | undefined;
      if (!channelPreferences) {
        // Default to enabled if no preferences set for this channel
        return this.getDefaultChannelPreference(notificationType, channel);
      }

      const isEnabled = channelPreferences[preferenceKey];
      if (typeof isEnabled === 'boolean') {
        return isEnabled;
      }

      // Default to enabled if preference not explicitly set
      return this.getDefaultChannelPreference(notificationType, channel);
    } catch (error) {
      logger.error('Failed to check notification enabled status', {
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
   * Validates notification preferences structure and values
   */
  validatePreferences(
    preferences: NotificationPreferences
  ): NotificationPreferenceValidationResult {
    const errors: string[] = [];

    if (!preferences || typeof preferences !== 'object') {
      errors.push('Notification preferences must be an object');
      return { isValid: false, errors };
    }

    // Validate structure - each channel should be an object with boolean values
    const validChannels = ['email', 'push', 'inApp'];
    const validTypes = [
      'newMessage',
      'assignmentDue',
      'gradePosted',
      'courseUpdate',
      'announcement',
      'discussionReply',
    ];

    for (const [channel, settings] of Object.entries(preferences)) {
      if (!validChannels.includes(channel)) {
        errors.push(
          `Invalid notification channel: ${channel}. Valid channels: ${validChannels.join(', ')}`
        );
        continue;
      }

      if (settings && typeof settings === 'object') {
        for (const [type, enabled] of Object.entries(settings as Record<string, boolean>)) {
          if (!validTypes.includes(type)) {
            errors.push(
              `Invalid notification type: ${type}. Valid types: ${validTypes.join(', ')}`
            );
          }
          if (typeof enabled !== 'boolean') {
            errors.push(`Notification preference value must be boolean: ${channel}.${type}`);
          }
        }
      } else if (settings !== undefined && settings !== null) {
        errors.push(`Channel preferences must be an object: ${channel}`);
      }
    }

    // Validate that critical notifications have at least one channel enabled
    const criticalTypes = ['assignmentDue', 'gradePosted'];
    for (const criticalType of criticalTypes) {
      let hasEnabledChannel = false;

      for (const channel of validChannels) {
        const channelPrefs = preferences[channel as keyof NotificationPreferences] as
          | Record<string, boolean>
          | undefined;
        if (channelPrefs && channelPrefs[criticalType] === true) {
          hasEnabledChannel = true;
          break;
        }
      }

      // Only warn, don't fail validation - user should be able to disable if they want
      if (!hasEnabledChannel) {
        logger.warn(`Critical notification type ${criticalType} has no enabled channels`, {
          preferences,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets default notification preferences for a new user
   */
  getDefaultPreferences(): NotificationPreferences {
    return {
      email: {
        newMessage: true,
        assignmentDue: true,
        gradePosted: true,
        courseUpdate: true,
        announcement: true,
        discussionReply: false,
      },
      push: {
        newMessage: true,
        assignmentDue: true,
        gradePosted: true,
        courseUpdate: false,
        announcement: false,
        discussionReply: false,
      },
      inApp: {
        newMessage: true,
        assignmentDue: true,
        gradePosted: true,
        courseUpdate: true,
        announcement: true,
        discussionReply: true,
      },
    };
  }

  /**
   * Resets a user's notification preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<void> {
    try {
      logger.info('Resetting notification preferences to defaults', { userId });

      const defaultPreferences = this.getDefaultPreferences();
      await this.updatePreferences(userId, defaultPreferences);

      logger.info('Notification preferences reset to defaults successfully', { userId });
    } catch (error) {
      logger.error('Failed to reset notification preferences to defaults', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new Error(
        `Failed to reset notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets enabled channels for a specific notification type for a user
   */
  async getEnabledChannels(
    userId: string,
    notificationType: NotificationType
  ): Promise<Array<'email' | 'push' | 'inApp'>> {
    try {
      logger.debug('Getting enabled channels for notification type', { userId, notificationType });

      const enabledChannels: Array<'email' | 'push' | 'inApp'> = [];
      const channels: Array<'email' | 'push' | 'inApp'> = ['email', 'push', 'inApp'];

      for (const channel of channels) {
        const isEnabled = await this.isNotificationEnabled(userId, notificationType, channel);
        if (isEnabled) {
          enabledChannels.push(channel);
        }
      }

      logger.debug('Enabled channels retrieved', { userId, notificationType, enabledChannels });
      return enabledChannels;
    } catch (error) {
      logger.error('Failed to get enabled channels', {
        userId,
        notificationType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return all channels on error to ensure notifications are delivered
      return ['email', 'push', 'inApp'];
    }
  }

  /**
   * Maps notification type enum to preference key
   */
  private mapNotificationTypeToPreferenceKey(notificationType: NotificationType): string {
    const typeMapping: Record<NotificationType, string> = {
      new_message: 'newMessage',
      assignment_due: 'assignmentDue',
      grade_posted: 'gradePosted',
      course_update: 'courseUpdate',
      announcement: 'announcement',
      discussion_reply: 'discussionReply',
      enrollment_confirmed: 'enrollmentConfirmed',
      certificate_issued: 'certificateIssued',
      payment_received: 'paymentReceived',
      refund_processed: 'refundProcessed',
    };

    return typeMapping[notificationType] || notificationType;
  }

  /**
   * Gets default preference for a notification type and channel
   */
  private getDefaultChannelPreference(
    notificationType: NotificationType,
    channel: 'email' | 'push' | 'inApp'
  ): boolean {
    const defaults = this.getDefaultPreferences();
    const preferenceKey = this.mapNotificationTypeToPreferenceKey(notificationType);

    const channelDefaults = defaults[channel] as Record<string, boolean> | undefined;
    if (channelDefaults && preferenceKey in channelDefaults) {
      return channelDefaults[preferenceKey] ?? false;
    }

    // Fallback defaults based on channel and notification type
    if (channel === 'inApp') {
      return true; // In-app notifications default to enabled
    }

    if (channel === 'email') {
      // Email defaults to enabled for important notifications
      const importantTypes = [
        'assignment_due',
        'grade_posted',
        'enrollment_confirmed',
        'certificate_issued',
        'payment_received',
        'refund_processed',
      ];
      return importantTypes.includes(notificationType);
    }

    if (channel === 'push') {
      // Push defaults to enabled for urgent notifications
      const urgentTypes = ['new_message', 'assignment_due', 'grade_posted'];
      return urgentTypes.includes(notificationType);
    }

    return false;
  }

  /**
   * Validates preference update parameters
   */
  private validatePreferenceUpdate(update: NotificationPreferenceUpdate): void {
    const validChannels = ['email', 'push', 'inApp'];
    const validTypes = [
      'newMessage',
      'assignmentDue',
      'gradePosted',
      'courseUpdate',
      'announcement',
      'discussionReply',
    ];

    if (!validChannels.includes(update.channel)) {
      throw new ValidationError(
        `Invalid notification channel: ${update.channel}. Valid channels: ${validChannels.join(', ')}`
      );
    }

    if (!validTypes.includes(update.notificationType)) {
      throw new ValidationError(
        `Invalid notification type: ${update.notificationType}. Valid types: ${validTypes.join(', ')}`
      );
    }

    if (typeof update.enabled !== 'boolean') {
      throw new ValidationError('Enabled parameter must be a boolean');
    }
  }

  /**
   * Updates a specific preference in the preferences object
   */
  private updateSpecificPreference(
    currentPreferences: NotificationPreferences,
    update: NotificationPreferenceUpdate
  ): NotificationPreferences {
    const updatedPreferences = { ...currentPreferences };

    // Ensure channel object exists
    if (!updatedPreferences[update.channel]) {
      updatedPreferences[update.channel] = {};
    }

    // Update the specific preference
    (updatedPreferences[update.channel] as Record<string, boolean>)[update.notificationType] =
      update.enabled;

    return updatedPreferences;
  }
}
