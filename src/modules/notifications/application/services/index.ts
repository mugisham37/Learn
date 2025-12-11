/**
 * Notification Application Services
 * 
 * Exports all notification application layer services
 * including interfaces and implementations.
 */

export type { INotificationService } from './INotificationService.js';
export { NotificationService } from './NotificationService.js';

export type {
  CreateNotificationData,
  BatchNotificationData,
  NotificationDeliveryResult,
  BatchNotificationResult,
  NotificationEmailData,
  PushNotificationData,
} from './INotificationService.js';