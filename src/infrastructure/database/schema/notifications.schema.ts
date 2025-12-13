/**
 * Notifications Schema
 *
 * Database schema definitions for multi-channel notifications
 * Includes notifications table with support for email, push, and in-app delivery
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { users } from './users.schema';

/**
 * Notification Type Enum
 * Defines the different types of notifications that can be sent
 *
 * Requirements:
 * - 10.1: Multi-channel notification delivery with type-based routing
 */
export const notificationTypeEnum = pgEnum('notification_type', [
  'new_message',
  'assignment_due',
  'grade_posted',
  'course_update',
  'announcement',
  'discussion_reply',
  'enrollment_confirmed',
  'certificate_issued',
  'payment_received',
  'refund_processed',
]);

/**
 * Priority Enum
 * Defines notification priority levels for delivery and display
 *
 * Requirements:
 * - 10.1: Priority-based notification handling
 */
export const priorityEnum = pgEnum('priority', ['normal', 'high', 'urgent']);

/**
 * Notifications Table
 * System notifications with multi-channel delivery support
 *
 * Requirements:
 * - 10.1: Notification creation with real-time delivery and channel preferences
 * - 10.4: Mark notifications as read with timestamp tracking
 * - 10.6: Automatic notification expiration
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientId: uuid('recipient_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    notificationType: notificationTypeEnum('notification_type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    actionUrl: varchar('action_url', { length: 500 }),
    priority: priorityEnum('priority').default('normal').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    metadata: jsonb('metadata').default({}).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index on recipientId for fast lookups of notifications for a user
    recipientIdx: index('notifications_recipient_idx').on(table.recipientId),
    // Index on isRead for filtering unread notifications
    isReadIdx: index('notifications_is_read_idx').on(table.isRead),
    // Index on notificationType for filtering by notification type
    notificationTypeIdx: index('notifications_notification_type_idx').on(table.notificationType),
    // Composite index on recipientId and isRead for unread notification queries
    recipientReadIdx: index('notifications_recipient_read_idx').on(table.recipientId, table.isRead),
    // Composite index on recipientId and createdAt for chronological listings
    recipientCreatedIdx: index('notifications_recipient_created_idx').on(
      table.recipientId,
      table.createdAt
    ),
    // Index on expiresAt for cleanup of expired notifications
    expiresAtIdx: index('notifications_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Type exports for use in application code
 */
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
