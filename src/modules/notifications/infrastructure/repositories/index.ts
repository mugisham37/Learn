/**
 * Notification Infrastructure Repositories
 * 
 * Exports all notification repository interfaces and implementations
 * for use throughout the notifications module.
 */

export type { INotificationRepository } from './INotificationRepository.js';
export { NotificationRepository } from './NotificationRepository.js';

export type {
  CreateNotificationDTO,
  UpdateNotificationDTO,
  NotificationFilters,
  PaginationOptions,
  PaginatedResult,
} from './INotificationRepository.js';