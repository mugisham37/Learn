/**
 * Notification Preference Service Interface
 *
 * Defines the contract for notification preference management operations.
 * Handles getting, updating, and validating user notification preferences
 * with integration to the notification delivery system.
 *
 * Requirements: 10.7
 */

import { NotificationPreferences } from '../../../users/domain/value-objects/UserProfile.js';
import { NotificationType } from '../../../../infrastructure/database/schema/notifications.schema.js';

/**
 * Notification preference update data
 */
export interface NotificationPreferenceUpdate {
  channel: 'email' | 'push' | 'inApp';
  notificationType: string;
  enabled: boolean;
}

/**
 * Bulk notification preference update data
 */
export interface BulkNotificationPreferenceUpdate {
  preferences: NotificationPreferences;
}

/**
 * Notification preference validation result
 */
export interface NotificationPreferenceValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Notification Preference Service Interface
 *
 * Provides methods for managing user notification preferences and
 * integrating them with the notification delivery system.
 */
export interface INotificationPreferenceService {
  /**
   * Gets a user's notification preferences
   *
   * @param userId - User ID
   * @returns The user's notification preferences
   * @throws NotFoundError if user doesn't exist
   */
  getPreferences(userId: string): Promise<NotificationPreferences>;

  /**
   * Updates a user's notification preferences
   *
   * @param userId - User ID
   * @param preferences - New notification preferences
   * @returns Promise resolving when preferences are updated
   * @throws NotFoundError if user doesn't exist
   * @throws ValidationError if preferences are invalid
   */
  updatePreferences(userId: string, preferences: NotificationPreferences): Promise<void>;

  /**
   * Updates a specific notification preference setting
   *
   * @param userId - User ID
   * @param update - Preference update data
   * @returns Promise resolving when preference is updated
   * @throws NotFoundError if user doesn't exist
   * @throws ValidationError if parameters are invalid
   */
  updatePreference(userId: string, update: NotificationPreferenceUpdate): Promise<void>;

  /**
   * Checks if a user has enabled notifications for a specific type and channel
   *
   * @param userId - User ID
   * @param notificationType - Type of notification
   * @param channel - Delivery channel
   * @returns Promise resolving to true if notifications are enabled
   */
  isNotificationEnabled(
    userId: string,
    notificationType: NotificationType,
    channel: 'email' | 'push' | 'inApp'
  ): Promise<boolean>;

  /**
   * Validates notification preferences structure and values
   *
   * @param preferences - Notification preferences to validate
   * @returns Validation result with errors if any
   */
  validatePreferences(preferences: NotificationPreferences): NotificationPreferenceValidationResult;

  /**
   * Gets default notification preferences for a new user
   *
   * @returns Default notification preferences
   */
  getDefaultPreferences(): NotificationPreferences;

  /**
   * Resets a user's notification preferences to defaults
   *
   * @param userId - User ID
   * @returns Promise resolving when preferences are reset
   * @throws NotFoundError if user doesn't exist
   */
  resetToDefaults(userId: string): Promise<void>;

  /**
   * Gets enabled channels for a specific notification type for a user
   *
   * @param userId - User ID
   * @param notificationType - Type of notification
   * @returns Promise resolving to array of enabled channels
   */
  getEnabledChannels(
    userId: string,
    notificationType: NotificationType
  ): Promise<Array<'email' | 'push' | 'inApp'>>;
}
