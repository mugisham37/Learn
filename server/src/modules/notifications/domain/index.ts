/**
 * Notification Domain Layer
 *
 * Exports all domain layer components for the notifications module
 * including entities, value objects, and domain services.
 */

export * from './entities/index.js';
export * from './value-objects/index.js';

// Re-export specific types to avoid conflicts
export type {
  NotificationPreference,
  NotificationChannel,
} from './value-objects/NotificationPreference.js';
