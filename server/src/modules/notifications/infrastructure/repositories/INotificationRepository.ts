/**
 * Notification Repository Interface
 *
 * Defines the contract for notification data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 10.1, 10.4
 */

import {
  Notification,
  NotificationType,
  Priority,
} from '../../../../infrastructure/database/schema/notifications.schema.js';

/**
 * Data Transfer Object for creating a new notification
 */
export interface CreateNotificationDTO {
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
 * Data Transfer Object for updating a notification
 */
export interface UpdateNotificationDTO {
  title?: string;
  content?: string;
  actionUrl?: string;
  priority?: Priority;
  isRead?: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

/**
 * Filter options for notification queries
 */
export interface NotificationFilters {
  recipientId?: string;
  notificationType?: NotificationType | NotificationType[];
  isRead?: boolean;
  priority?: Priority | Priority[];
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
}

/**
 * Pagination options for notification lists
 */
export interface PaginationOptions {
  limit: number;
  offset: number;
  orderBy?: 'createdAt' | 'priority' | 'readAt';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Notification Repository Interface
 *
 * Provides methods for all notification data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface INotificationRepository {
  /**
   * Creates a new notification in the database
   *
   * @param data - Notification creation data
   * @returns The created notification
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateNotificationDTO): Promise<Notification>;

  /**
   * Finds a notification by its unique ID
   *
   * @param id - Notification ID
   * @returns The notification if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Finds notifications for a specific recipient with filtering and pagination
   *
   * @param recipientId - User ID of the notification recipient
   * @param filters - Optional filters to apply
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  findByRecipient(
    recipientId: string,
    filters?: Omit<NotificationFilters, 'recipientId'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>>;

  /**
   * Finds notifications with advanced filtering and pagination
   *
   * @param filters - Filters to apply
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  findMany(
    filters?: NotificationFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>>;

  /**
   * Finds unread notifications for a specific recipient
   *
   * @param recipientId - User ID of the notification recipient
   * @param pagination - Pagination options
   * @returns Paginated list of unread notifications
   * @throws DatabaseError if database operation fails
   */
  findUnreadByRecipient(
    recipientId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>>;

  /**
   * Counts unread notifications for a specific recipient
   *
   * @param recipientId - User ID of the notification recipient
   * @returns Number of unread notifications
   * @throws DatabaseError if database operation fails
   */
  countUnreadByRecipient(recipientId: string): Promise<number>;

  /**
   * Finds notifications by type with filtering and pagination
   *
   * @param notificationType - Type of notifications to find
   * @param filters - Optional additional filters
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  findByType(
    notificationType: NotificationType,
    filters?: Omit<NotificationFilters, 'notificationType'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>>;

  /**
   * Finds notifications by priority with filtering and pagination
   *
   * @param priority - Priority level of notifications to find
   * @param filters - Optional additional filters
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  findByPriority(
    priority: Priority,
    filters?: Omit<NotificationFilters, 'priority'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>>;

  /**
   * Updates a notification's data
   *
   * @param id - Notification ID
   * @param data - Update data
   * @returns The updated notification
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateNotificationDTO): Promise<Notification>;

  /**
   * Marks a notification as read
   *
   * @param id - Notification ID
   * @returns The updated notification
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  markAsRead(id: string): Promise<Notification>;

  /**
   * Marks multiple notifications as read
   *
   * @param ids - Array of notification IDs
   * @returns Array of updated notifications
   * @throws DatabaseError if database operation fails
   */
  markManyAsRead(ids: string[]): Promise<Notification[]>;

  /**
   * Marks all notifications for a recipient as read
   *
   * @param recipientId - User ID of the notification recipient
   * @returns Number of notifications marked as read
   * @throws DatabaseError if database operation fails
   */
  markAllAsReadByRecipient(recipientId: string): Promise<number>;

  /**
   * Deletes a notification from the database
   *
   * @param id - Notification ID
   * @returns void
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Deletes multiple notifications from the database
   *
   * @param ids - Array of notification IDs
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  deleteMany(ids: string[]): Promise<number>;

  /**
   * Deletes expired notifications
   *
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  deleteExpired(): Promise<number>;

  /**
   * Deletes all notifications for a recipient
   *
   * @param recipientId - User ID of the notification recipient
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  deleteAllByRecipient(recipientId: string): Promise<number>;

  /**
   * Checks if a notification exists
   *
   * @param id - Notification ID
   * @returns True if notification exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Invalidates cache for a specific notification
   * Should be called after any update operation
   *
   * @param id - Notification ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for notifications by recipient
   * Should be called after operations that affect recipient's notifications
   *
   * @param recipientId - User ID of the notification recipient
   * @returns void
   */
  invalidateCacheByRecipient(recipientId: string): Promise<void>;
}
