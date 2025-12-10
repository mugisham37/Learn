/**
 * Notification Repository Implementation
 * 
 * Implements notification data access operations with Drizzle ORM queries,
 * Redis caching with appropriate TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 10.1, 10.4
 */

import { eq, and, or, desc, asc, count, inArray, isNull, isNotNull, lt, gte, lte, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  notifications, 
  Notification, 
  NewNotification,
  NotificationType,
  Priority
} from '../../../../infrastructure/database/schema/notifications.schema.js';
import {
  DatabaseError,
  NotFoundError,
} from '../../../../shared/errors/index.js';

import {
  INotificationRepository,
  CreateNotificationDTO,
  UpdateNotificationDTO,
  NotificationFilters,
  PaginationOptions,
  PaginatedResult,
} from './INotificationRepository.js';

/**
 * Notification Repository Implementation
 * 
 * Provides data access methods for notification entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with appropriate TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Advanced filtering and pagination
 */
export class NotificationRepository implements INotificationRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for notification by ID
   */
  private getNotificationCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.USER, 'notification', id);
  }

  /**
   * Builds cache key for notifications by recipient
   */
  private getRecipientNotificationsCacheKey(recipientId: string, filters?: string): string {
    const filterKey = filters ? `:${filters}` : '';
    return buildCacheKey(CachePrefix.USER, 'notifications', recipientId + filterKey);
  }

  /**
   * Builds cache key for unread count by recipient
   */
  private getUnreadCountCacheKey(recipientId: string): string {
    return buildCacheKey(CachePrefix.USER, 'unread_count', recipientId);
  }

  /**
   * Generates a filter key for caching based on filters and pagination
   */
  private generateFilterKey(filters?: NotificationFilters, pagination?: PaginationOptions): string {
    const parts: string[] = [];
    
    if (filters) {
      if (filters.notificationType) {
        const types = Array.isArray(filters.notificationType) 
          ? filters.notificationType.join(',') 
          : filters.notificationType;
        parts.push(`type:${types}`);
      }
      if (filters.isRead !== undefined) parts.push(`read:${filters.isRead}`);
      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) 
          ? filters.priority.join(',') 
          : filters.priority;
        parts.push(`priority:${priorities}`);
      }
      if (filters.createdAfter) parts.push(`after:${filters.createdAfter.getTime()}`);
      if (filters.createdBefore) parts.push(`before:${filters.createdBefore.getTime()}`);
    }
    
    if (pagination) {
      parts.push(`limit:${pagination.limit}`);
      parts.push(`offset:${pagination.offset}`);
      if (pagination.orderBy) parts.push(`order:${pagination.orderBy}`);
      if (pagination.orderDirection) parts.push(`dir:${pagination.orderDirection}`);
    }
    
    return parts.join('|');
  }

  /**
   * Builds WHERE conditions based on filters
   */
  private buildWhereConditions(filters?: NotificationFilters): SQL<unknown> | undefined {
    const conditions = [];
    
    if (filters?.recipientId) {
      conditions.push(eq(notifications.recipientId, filters.recipientId));
    }
    
    if (filters?.notificationType) {
      if (Array.isArray(filters.notificationType)) {
        conditions.push(inArray(notifications.notificationType, filters.notificationType));
      } else {
        conditions.push(eq(notifications.notificationType, filters.notificationType));
      }
    }
    
    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }
    
    if (filters?.priority) {
      if (Array.isArray(filters.priority)) {
        conditions.push(inArray(notifications.priority, filters.priority));
      } else {
        conditions.push(eq(notifications.priority, filters.priority));
      }
    }
    
    if (filters?.createdAfter) {
      conditions.push(gte(notifications.createdAt, filters.createdAfter));
    }
    
    if (filters?.createdBefore) {
      conditions.push(lte(notifications.createdAt, filters.createdBefore));
    }
    
    if (filters?.expiresAfter) {
      conditions.push(gte(notifications.expiresAt, filters.expiresAfter));
    }
    
    if (filters?.expiresBefore) {
      conditions.push(lte(notifications.expiresAt, filters.expiresBefore));
    }
    
    // Always exclude expired notifications unless specifically querying for them
    if (!filters?.expiresAfter && !filters?.expiresBefore) {
      conditions.push(
        or(
          isNull(notifications.expiresAt),
          gte(notifications.expiresAt, new Date())
        )
      );
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Builds ORDER BY clause based on pagination options
   */
  private buildOrderBy(pagination?: PaginationOptions): SQL<unknown> {
    if (!pagination?.orderBy) {
      return desc(notifications.createdAt); // Default: newest first
    }
    
    const column = notifications[pagination.orderBy];
    return pagination.orderDirection === 'asc' ? asc(column) : desc(column);
  }

  /**
   * Creates a new notification in the database
   * 
   * @param data - Notification creation data
   * @returns The created notification
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateNotificationDTO): Promise<Notification> {
    try {
      // Prepare notification data for insertion
      const newNotification: NewNotification = {
        recipientId: data.recipientId,
        notificationType: data.notificationType,
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl,
        priority: data.priority || 'normal',
        metadata: data.metadata || {},
        expiresAt: data.expiresAt,
      };

      // Insert notification into database
      const [createdNotification] = await this.writeDb
        .insert(notifications)
        .values(newNotification)
        .returning();

      if (!createdNotification) {
        throw new DatabaseError(
          'Failed to create notification',
          'insert'
        );
      }

      // Invalidate recipient's notification cache
      await this.invalidateCacheByRecipient(data.recipientId);

      return createdNotification;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create notification',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a notification by its unique ID
   * 
   * Implements caching with medium TTL.
   * Uses read database for query optimization.
   * 
   * @param id - Notification ID
   * @returns The notification if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Notification | null> {
    try {
      // Check cache first
      const cacheKey = this.getNotificationCacheKey(id);
      const cachedNotification = await cache.get<Notification>(cacheKey);
      
      if (cachedNotification) {
        return cachedNotification;
      }

      // Query database if not in cache
      const [notification] = await this.readDb
        .select()
        .from(notifications)
        .where(eq(notifications.id, id))
        .limit(1);

      if (!notification) {
        return null;
      }

      // Cache the result with medium TTL
      await cache.set(cacheKey, notification, CacheTTL.MEDIUM);

      return notification;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find notification by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds notifications for a specific recipient with filtering and pagination
   * 
   * @param recipientId - User ID of the notification recipient
   * @param filters - Optional filters to apply
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  async findByRecipient(
    recipientId: string,
    filters?: Omit<NotificationFilters, 'recipientId'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    try {
      const fullFilters = { ...filters, recipientId };
      return await this.findMany(fullFilters, pagination);
    } catch (error) {
      throw new DatabaseError(
        'Failed to find notifications by recipient',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds notifications with advanced filtering and pagination
   * 
   * @param filters - Filters to apply
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  async findMany(
    filters?: NotificationFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    try {
      // Check cache for recipient-specific queries
      let cacheKey: string | null = null;
      if (filters?.recipientId) {
        const filterKey = this.generateFilterKey(filters, pagination);
        cacheKey = this.getRecipientNotificationsCacheKey(filters.recipientId, filterKey);
        
        const cachedResult = await cache.get<PaginatedResult<Notification>>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      const whereConditions = this.buildWhereConditions(filters);
      const orderBy = this.buildOrderBy(pagination);
      
      // Set default pagination
      const limit = pagination?.limit || 20;
      const offset = pagination?.offset || 0;

      // Execute count and data queries in parallel
      const [countResult, notificationResults] = await Promise.all([
        this.readDb
          .select({ count: count() })
          .from(notifications)
          .where(whereConditions),
        this.readDb
          .select()
          .from(notifications)
          .where(whereConditions)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
      ]);

      const total = countResult[0]?.count || 0;
      const hasMore = offset + limit < total;

      const result: PaginatedResult<Notification> = {
        items: notificationResults,
        total,
        limit,
        offset,
        hasMore,
      };

      // Cache recipient-specific results
      if (cacheKey) {
        await cache.set(cacheKey, result, CacheTTL.SHORT);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find notifications',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds unread notifications for a specific recipient
   * 
   * @param recipientId - User ID of the notification recipient
   * @param pagination - Pagination options
   * @returns Paginated list of unread notifications
   * @throws DatabaseError if database operation fails
   */
  async findUnreadByRecipient(
    recipientId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    try {
      const filters: NotificationFilters = {
        recipientId,
        isRead: false,
      };
      
      return await this.findMany(filters, pagination);
    } catch (error) {
      throw new DatabaseError(
        'Failed to find unread notifications by recipient',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Counts unread notifications for a specific recipient
   * 
   * @param recipientId - User ID of the notification recipient
   * @returns Number of unread notifications
   * @throws DatabaseError if database operation fails
   */
  async countUnreadByRecipient(recipientId: string): Promise<number> {
    try {
      // Check cache first
      const cacheKey = this.getUnreadCountCacheKey(recipientId);
      const cachedCount = await cache.get<number>(cacheKey);
      
      if (cachedCount !== null) {
        return cachedCount;
      }

      // Query database if not in cache
      const whereConditions = this.buildWhereConditions({
        recipientId,
        isRead: false,
      });

      const [result] = await this.readDb
        .select({ count: count() })
        .from(notifications)
        .where(whereConditions);

      const unreadCount = result?.count || 0;

      // Cache the result with short TTL
      await cache.set(cacheKey, unreadCount, CacheTTL.SHORT);

      return unreadCount;
    } catch (error) {
      throw new DatabaseError(
        'Failed to count unread notifications by recipient',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds notifications by type with filtering and pagination
   * 
   * @param notificationType - Type of notifications to find
   * @param filters - Optional additional filters
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  async findByType(
    notificationType: NotificationType,
    filters?: Omit<NotificationFilters, 'notificationType'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    try {
      const fullFilters = { ...filters, notificationType };
      return await this.findMany(fullFilters, pagination);
    } catch (error) {
      throw new DatabaseError(
        'Failed to find notifications by type',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds notifications by priority with filtering and pagination
   * 
   * @param priority - Priority level of notifications to find
   * @param filters - Optional additional filters
   * @param pagination - Pagination options
   * @returns Paginated list of notifications
   * @throws DatabaseError if database operation fails
   */
  async findByPriority(
    priority: Priority,
    filters?: Omit<NotificationFilters, 'priority'>,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    try {
      const fullFilters = { ...filters, priority };
      return await this.findMany(fullFilters, pagination);
    } catch (error) {
      throw new DatabaseError(
        'Failed to find notifications by priority',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a notification's data
   * 
   * Invalidates related cache entries after successful update.
   * 
   * @param id - Notification ID
   * @param data - Update data
   * @returns The updated notification
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateNotificationDTO): Promise<Notification> {
    try {
      // First, verify notification exists
      const existingNotification = await this.findById(id);
      if (!existingNotification) {
        throw new NotFoundError('Notification', id);
      }

      // Prepare update data
      const updateData: Partial<NewNotification> = {
        ...data,
      };

      // Update notification in database
      const [updatedNotification] = await this.writeDb
        .update(notifications)
        .set(updateData)
        .where(eq(notifications.id, id))
        .returning();

      if (!updatedNotification) {
        throw new DatabaseError(
          'Failed to update notification',
          'update'
        );
      }

      // Invalidate cache entries
      await Promise.all([
        this.invalidateCache(id),
        this.invalidateCacheByRecipient(existingNotification.recipientId),
      ]);

      return updatedNotification;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update notification',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks a notification as read
   * 
   * @param id - Notification ID
   * @returns The updated notification
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async markAsRead(id: string): Promise<Notification> {
    try {
      return await this.update(id, {
        isRead: true,
        readAt: new Date(),
      });
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to mark notification as read',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks multiple notifications as read
   * 
   * @param ids - Array of notification IDs
   * @returns Array of updated notifications
   * @throws DatabaseError if database operation fails
   */
  async markManyAsRead(ids: string[]): Promise<Notification[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      // Update notifications in database
      const updatedNotifications = await this.writeDb
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(inArray(notifications.id, ids))
        .returning();

      // Invalidate cache for all affected recipients
      const recipientIds = Array.from(new Set(updatedNotifications.map(n => n.recipientId)));
      await Promise.all([
        ...ids.map(id => this.invalidateCache(id)),
        ...recipientIds.map(recipientId => this.invalidateCacheByRecipient(recipientId)),
      ]);

      return updatedNotifications;
    } catch (error) {
      throw new DatabaseError(
        'Failed to mark notifications as read',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Marks all notifications for a recipient as read
   * 
   * @param recipientId - User ID of the notification recipient
   * @returns Number of notifications marked as read
   * @throws DatabaseError if database operation fails
   */
  async markAllAsReadByRecipient(recipientId: string): Promise<number> {
    try {
      // Update all unread notifications for the recipient
      const updatedNotifications = await this.writeDb
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.recipientId, recipientId),
            eq(notifications.isRead, false)
          )
        )
        .returning();

      // Invalidate cache
      await this.invalidateCacheByRecipient(recipientId);

      return updatedNotifications.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to mark all notifications as read by recipient',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a notification from the database
   * 
   * @param id - Notification ID
   * @returns void
   * @throws NotFoundError if notification doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get notification before deletion for cache invalidation
      const existingNotification = await this.findById(id);
      if (!existingNotification) {
        throw new NotFoundError('Notification', id);
      }

      // Delete notification
      const result = await this.writeDb
        .delete(notifications)
        .where(eq(notifications.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to delete notification',
          'delete'
        );
      }

      // Invalidate cache entries
      await Promise.all([
        this.invalidateCache(id),
        this.invalidateCacheByRecipient(existingNotification.recipientId),
      ]);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete notification',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes multiple notifications from the database
   * 
   * @param ids - Array of notification IDs
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  async deleteMany(ids: string[]): Promise<number> {
    try {
      if (ids.length === 0) {
        return 0;
      }

      // Get notifications before deletion for cache invalidation
      const existingNotifications = await this.readDb
        .select()
        .from(notifications)
        .where(inArray(notifications.id, ids));

      // Delete notifications
      const result = await this.writeDb
        .delete(notifications)
        .where(inArray(notifications.id, ids))
        .returning();

      // Invalidate cache for all affected recipients
      const recipientIds = Array.from(new Set(existingNotifications.map(n => n.recipientId)));
      await Promise.all([
        ...ids.map(id => this.invalidateCache(id)),
        ...recipientIds.map(recipientId => this.invalidateCacheByRecipient(recipientId)),
      ]);

      return result.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete notifications',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes expired notifications
   * 
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  async deleteExpired(): Promise<number> {
    try {
      // Get expired notifications before deletion for cache invalidation
      const expiredNotifications = await this.readDb
        .select()
        .from(notifications)
        .where(
          and(
            isNotNull(notifications.expiresAt),
            lt(notifications.expiresAt, new Date())
          )
        );

      if (expiredNotifications.length === 0) {
        return 0;
      }

      // Delete expired notifications
      const result = await this.writeDb
        .delete(notifications)
        .where(
          and(
            isNotNull(notifications.expiresAt),
            lt(notifications.expiresAt, new Date())
          )
        )
        .returning();

      // Invalidate cache for all affected recipients
      const recipientIds = Array.from(new Set(expiredNotifications.map(n => n.recipientId)));
      await Promise.all([
        ...expiredNotifications.map(n => this.invalidateCache(n.id)),
        ...recipientIds.map(recipientId => this.invalidateCacheByRecipient(recipientId)),
      ]);

      return result.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete expired notifications',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes all notifications for a recipient
   * 
   * @param recipientId - User ID of the notification recipient
   * @returns Number of notifications deleted
   * @throws DatabaseError if database operation fails
   */
  async deleteAllByRecipient(recipientId: string): Promise<number> {
    try {
      // Delete all notifications for the recipient
      const result = await this.writeDb
        .delete(notifications)
        .where(eq(notifications.recipientId, recipientId))
        .returning();

      // Invalidate cache
      await this.invalidateCacheByRecipient(recipientId);

      return result.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete all notifications by recipient',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a notification exists
   * 
   * @param id - Notification ID
   * @returns True if notification exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const notification = await this.findById(id);
      return notification !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check notification existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific notification
   * 
   * Removes all cache entries related to the notification by ID.
   * Should be called after any update operation.
   * 
   * @param id - Notification ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getNotificationCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for notification ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for notifications by recipient
   * 
   * Removes all cache entries related to the recipient's notifications.
   * Should be called after operations that affect recipient's notifications.
   * 
   * @param recipientId - User ID of the notification recipient
   * @returns void
   */
  async invalidateCacheByRecipient(recipientId: string): Promise<void> {
    try {
      // Invalidate all cache entries for this recipient
      const patterns = [
        this.getRecipientNotificationsCacheKey(recipientId, '*'),
        this.getUnreadCountCacheKey(recipientId),
      ];

      await Promise.all(
        patterns.map(pattern => cache.deletePattern(pattern))
      );
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for recipient ${recipientId}:`, error);
    }
  }
}