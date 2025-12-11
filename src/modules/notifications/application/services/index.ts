/**
 * Notification Application Services
 * 
 * Exports all notification application layer services
 * including interfaces and implementations.
 */

export type { INotificationService } from './INotificationService.js';
export { NotificationService } from './NotificationService.js';

export type { INotificationPreferenceService } from './INotificationPreferenceService.js';
export { NotificationPreferenceService } from './NotificationPreferenceService.js';

export type {
  CreateNotificationData,
  BatchNotificationData,
  NotificationDeliveryResult,
  BatchNotificationResult,
  NotificationEmailData,
  PushNotificationData,
} from './INotificationService.js';

export type {
  NotificationPreferenceUpdate,
  BulkNotificationPreferenceUpdate,
  NotificationPreferenceValidationResult,
} from './INotificationPreferenceService.js';