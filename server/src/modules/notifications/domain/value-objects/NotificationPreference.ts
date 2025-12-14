/**
 * NotificationPreference Value Object
 *
 * Immutable value object representing user notification preferences.
 * Defines which notification types should be delivered through which channels.
 *
 * Requirements: 10.1, 10.7
 */

/**
 * Notification delivery channels
 */
export type NotificationChannel = 'email' | 'push' | 'in_app';

/**
 * Import notification type from entities
 */
import type { NotificationType } from '../entities/Notification.js';

/**
 * Channel preferences for a specific notification type
 */
export interface ChannelPreferences {
  email: boolean;
  push: boolean;
  in_app: boolean;
}

/**
 * Complete notification preferences mapping
 */
export interface NotificationPreferencesMap {
  new_message: ChannelPreferences;
  assignment_due: ChannelPreferences;
  grade_posted: ChannelPreferences;
  course_update: ChannelPreferences;
  announcement: ChannelPreferences;
  discussion_reply: ChannelPreferences;
  enrollment_confirmed: ChannelPreferences;
  certificate_issued: ChannelPreferences;
  payment_received: ChannelPreferences;
  refund_processed: ChannelPreferences;
}

/**
 * Default notification preferences
 * All notifications enabled for in-app, selective for email and push
 */
const DEFAULT_PREFERENCES: NotificationPreferencesMap = {
  new_message: { email: true, push: true, in_app: true },
  assignment_due: { email: true, push: true, in_app: true },
  grade_posted: { email: true, push: true, in_app: true },
  course_update: { email: true, push: false, in_app: true },
  announcement: { email: true, push: false, in_app: true },
  discussion_reply: { email: false, push: false, in_app: true },
  enrollment_confirmed: { email: true, push: true, in_app: true },
  certificate_issued: { email: true, push: true, in_app: true },
  payment_received: { email: true, push: false, in_app: true },
  refund_processed: { email: true, push: true, in_app: true },
};

/**
 * NotificationPreference value object
 *
 * Represents user preferences for notification delivery across different channels.
 * Ensures valid channel configurations and provides methods for checking preferences.
 */
export class NotificationPreference {
  private readonly _preferences: NotificationPreferencesMap;

  /**
   * Creates a new NotificationPreference value object
   *
   * @param preferences - Notification preferences mapping
   */
  private constructor(preferences: NotificationPreferencesMap) {
    this._preferences = { ...preferences };
  }

  /**
   * Factory method to create NotificationPreference with custom preferences
   *
   * @param preferences - Partial preferences (missing values use defaults)
   * @returns NotificationPreference value object
   * @throws Error if preferences are invalid
   */
  static create(preferences: Partial<NotificationPreferencesMap> = {}): NotificationPreference {
    // Merge with defaults
    const mergedPreferences: NotificationPreferencesMap = {
      ...DEFAULT_PREFERENCES,
      ...preferences,
    };

    // Validate each notification type has valid channel preferences
    for (const [notificationType, channelPrefs] of Object.entries(mergedPreferences)) {
      if (!channelPrefs || typeof channelPrefs !== 'object') {
        throw new Error(`Invalid channel preferences for ${notificationType}`);
      }

      // Validate channel preferences structure
      const requiredChannels: (keyof ChannelPreferences)[] = ['email', 'push', 'in_app'];
      for (const channel of requiredChannels) {
        const channelValue = (channelPrefs as Record<string, unknown>)[channel];
        if (typeof channelValue !== 'boolean') {
          throw new Error(`Invalid ${channel} preference for ${notificationType}: must be boolean`);
        }
      }

      // Ensure at least one channel is enabled for critical notifications
      const criticalTypes: NotificationType[] = [
        'assignment_due',
        'grade_posted',
        'enrollment_confirmed',
        'certificate_issued',
        'payment_received',
        'refund_processed',
      ];

      if (criticalTypes.includes(notificationType as NotificationType)) {
        const channelPrefsTyped = channelPrefs as ChannelPreferences;
        const hasEnabledChannel = Boolean(channelPrefsTyped.email || channelPrefsTyped.push || channelPrefsTyped.in_app);
        if (!hasEnabledChannel) {
          throw new Error(
            `At least one channel must be enabled for critical notification type: ${notificationType}`
          );
        }
      }
    }

    return new NotificationPreference(mergedPreferences);
  }

  /**
   * Factory method to create default NotificationPreference
   *
   * @returns NotificationPreference with default settings
   */
  static createDefault(): NotificationPreference {
    return new NotificationPreference(DEFAULT_PREFERENCES);
  }

  /**
   * Factory method to create NotificationPreference from JSON
   *
   * @param json - JSON representation of preferences
   * @returns NotificationPreference value object
   * @throws Error if JSON is invalid
   */
  static fromJSON(json: unknown): NotificationPreference {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: must be an object');
    }

    return NotificationPreference.create(json as Partial<NotificationPreferencesMap>);
  }

  /**
   * Gets the complete preferences mapping
   *
   * @returns Notification preferences mapping
   */
  get preferences(): NotificationPreferencesMap {
    return { ...this._preferences };
  }

  /**
   * Checks if a notification type should be delivered via a specific channel
   *
   * @param notificationType - Type of notification
   * @param channel - Delivery channel
   * @returns True if notification should be delivered via the channel
   */
  isChannelEnabled(notificationType: NotificationType, channel: NotificationChannel): boolean {
    const channelPrefs = this._preferences[notificationType];
    if (!channelPrefs) {
      return false;
    }

    return channelPrefs[channel];
  }

  /**
   * Gets enabled channels for a specific notification type
   *
   * @param notificationType - Type of notification
   * @returns Array of enabled channels
   */
  getEnabledChannels(notificationType: NotificationType): NotificationChannel[] {
    const channelPrefs = this._preferences[notificationType];
    if (!channelPrefs) {
      return [];
    }

    const enabledChannels: NotificationChannel[] = [];
    if (channelPrefs.email) enabledChannels.push('email');
    if (channelPrefs.push) enabledChannels.push('push');
    if (channelPrefs.in_app) enabledChannels.push('in_app');

    return enabledChannels;
  }

  /**
   * Checks if email notifications are enabled for a notification type
   *
   * @param notificationType - Type of notification
   * @returns True if email is enabled
   */
  isEmailEnabled(notificationType: NotificationType): boolean {
    return this.isChannelEnabled(notificationType, 'email');
  }

  /**
   * Checks if push notifications are enabled for a notification type
   *
   * @param notificationType - Type of notification
   * @returns True if push is enabled
   */
  isPushEnabled(notificationType: NotificationType): boolean {
    return this.isChannelEnabled(notificationType, 'push');
  }

  /**
   * Checks if in-app notifications are enabled for a notification type
   *
   * @param notificationType - Type of notification
   * @returns True if in-app is enabled
   */
  isInAppEnabled(notificationType: NotificationType): boolean {
    return this.isChannelEnabled(notificationType, 'in_app');
  }

  /**
   * Creates a new NotificationPreference with updated preferences for a specific type
   *
   * @param notificationType - Type of notification to update
   * @param channelPreferences - New channel preferences
   * @returns New NotificationPreference with updated preferences
   */
  updatePreferences(
    notificationType: NotificationType,
    channelPreferences: ChannelPreferences
  ): NotificationPreference {
    const updatedPreferences = {
      ...this._preferences,
      [notificationType]: channelPreferences,
    };

    return NotificationPreference.create(updatedPreferences);
  }

  /**
   * Creates a new NotificationPreference with a specific channel enabled/disabled for a type
   *
   * @param notificationType - Type of notification
   * @param channel - Channel to update
   * @param enabled - Whether to enable or disable the channel
   * @returns New NotificationPreference with updated channel setting
   */
  updateChannel(
    notificationType: NotificationType,
    channel: NotificationChannel,
    enabled: boolean
  ): NotificationPreference {
    const currentPrefs = this._preferences[notificationType];
    const updatedChannelPrefs = {
      ...currentPrefs,
      [channel]: enabled,
    };

    return this.updatePreferences(notificationType, updatedChannelPrefs);
  }

  /**
   * Checks equality with another NotificationPreference
   *
   * @param other - Another NotificationPreference
   * @returns True if preferences are equal
   */
  equals(other: NotificationPreference): boolean {
    return JSON.stringify(this._preferences) === JSON.stringify(other._preferences);
  }

  /**
   * Returns JSON representation of the preferences
   *
   * @returns JSON object
   */
  toJSON(): NotificationPreferencesMap {
    return { ...this._preferences };
  }

  /**
   * Returns string representation of the preferences
   *
   * @returns JSON string
   */
  toString(): string {
    return JSON.stringify(this._preferences, null, 2);
  }
}
