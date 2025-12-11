/**
 * Analytics Events Repository Implementation
 * 
 * Implements analytics events data access operations with Drizzle ORM queries,
 * efficient aggregation queries with indexes, and batch operations.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 12.7
 */

import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  analyticsEvents,
  type AnalyticsEvent,
  type NewAnalyticsEvent
} from '../../../../infrastructure/database/schema/analytics.schema.js';
import {
  DatabaseError,
} from '../../../../shared/errors/index.js';

import {
  IAnalyticsEventsRepository,
  PaginationParams,
  PaginatedResult,
  DateRange,
  EventFilters,
} from './IAnalyticsRepository.js';

/**
 * Analytics Events Repository Implementation
 * 
 * Provides data access methods for analytics events with:
 * - Drizzle ORM for type-safe queries
 * - Efficient aggregation queries with indexes
 * - Batch operations for high-throughput event logging
 * - Comprehensive error handling
 * - Time-based partitioning support for large datasets
 */
export class AnalyticsEventsRepository implements IAnalyticsEventsRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds WHERE conditions for event filters
   */
  private buildFilterConditions(filters?: EventFilters) {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(analyticsEvents.userId, filters.userId));
    }

    if (filters?.eventType) {
      conditions.push(eq(analyticsEvents.eventType, filters.eventType));
    }

    if (filters?.dateRange) {
      conditions.push(
        gte(analyticsEvents.timestamp, filters.dateRange.startDate),
        lte(analyticsEvents.timestamp, filters.dateRange.endDate)
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Creates a new analytics event
   * 
   * @param data - Event data
   * @returns The created analytics event
   * @throws DatabaseError if database operation fails
   */
  async create(data: NewAnalyticsEvent): Promise<AnalyticsEvent> {
    try {
      const [createdEvent] = await this.writeDb
        .insert(analyticsEvents)
        .values({
          ...data,
          timestamp: data.timestamp || new Date(),
        })
        .returning();

      if (!createdEvent) {
        throw new DatabaseError(
          'Failed to create analytics event',
          'insert'
        );
      }

      return createdEvent;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle unexpected database errors
      throw new DatabaseError(
        `Failed to create analytics event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'insert'
      );
    }
  }

  /**
   * Creates multiple analytics events in batch
   * 
   * Efficiently inserts multiple events in a single database operation.
   * Optimized for high-throughput event logging scenarios.
   * 
   * @param events - Array of event data
   * @returns Array of created analytics events
   * @throws DatabaseError if database operation fails
   */
  async createBatch(events: NewAnalyticsEvent[]): Promise<AnalyticsEvent[]> {
    if (events.length === 0) {
      return [];
    }

    try {
      const eventsWithTimestamp = events.map(event => ({
        ...event,
        timestamp: event.timestamp || new Date(),
      }));

      const createdEvents = await this.writeDb
        .insert(analyticsEvents)
        .values(eventsWithTimestamp)
        .returning();

      return createdEvents;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create analytics events batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'insert'
      );
    }
  }

  /**
   * Finds analytics events by user ID with pagination
   * 
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  async findByUserId(
    userId: string,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Build filter conditions including userId
      const filterConditions = this.buildFilterConditions({
        ...filters,
        userId,
      });

      // Query database for data and total count
      const [data, [{ total }]] = await Promise.all([
        this.readDb
          .select()
          .from(analyticsEvents)
          .where(filterConditions)
          .orderBy(desc(analyticsEvents.timestamp))
          .limit(limit)
          .offset(offset),
        this.readDb
          .select({ total: count() })
          .from(analyticsEvents)
          .where(filterConditions)
      ]);

      return {
        data,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to find analytics events by user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds analytics events by event type with pagination
   * 
   * @param eventType - Event type
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  async findByEventType(
    eventType: string,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Build filter conditions including eventType
      const filterConditions = this.buildFilterConditions({
        ...filters,
        eventType,
      });

      // Query database for data and total count
      const [data, [{ total }]] = await Promise.all([
        this.readDb
          .select()
          .from(analyticsEvents)
          .where(filterConditions)
          .orderBy(desc(analyticsEvents.timestamp))
          .limit(limit)
          .offset(offset),
        this.readDb
          .select({ total: count() })
          .from(analyticsEvents)
          .where(filterConditions)
      ]);

      return {
        data,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to find analytics events by type: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds analytics events within date range
   * 
   * @param dateRange - Date range filter
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  async findByDateRange(
    dateRange: DateRange,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    try {
      // Build filter conditions including dateRange
      const filterConditions = this.buildFilterConditions({
        ...filters,
        dateRange,
      });

      // Query database for data and total count
      const [data, [{ total }]] = await Promise.all([
        this.readDb
          .select()
          .from(analyticsEvents)
          .where(filterConditions)
          .orderBy(desc(analyticsEvents.timestamp))
          .limit(limit)
          .offset(offset),
        this.readDb
          .select({ total: count() })
          .from(analyticsEvents)
          .where(filterConditions)
      ]);

      return {
        data,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to find analytics events by date range: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Counts events by event type within date range
   * 
   * @param eventType - Event type
   * @param dateRange - Date range filter
   * @returns Event count
   * @throws DatabaseError if database operation fails
   */
  async countByEventType(eventType: string, dateRange?: DateRange): Promise<number> {
    try {
      const conditions = [eq(analyticsEvents.eventType, eventType)];

      if (dateRange) {
        conditions.push(
          gte(analyticsEvents.timestamp, dateRange.startDate),
          lte(analyticsEvents.timestamp, dateRange.endDate)
        );
      }

      const [{ total }] = await this.readDb
        .select({ total: count() })
        .from(analyticsEvents)
        .where(and(...conditions));

      return Number(total);
    } catch (error) {
      throw new DatabaseError(
        `Failed to count events by type: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Counts events by user within date range
   * 
   * @param userId - User ID
   * @param dateRange - Date range filter
   * @returns Event count
   * @throws DatabaseError if database operation fails
   */
  async countByUser(userId: string, dateRange?: DateRange): Promise<number> {
    try {
      const conditions = [eq(analyticsEvents.userId, userId)];

      if (dateRange) {
        conditions.push(
          gte(analyticsEvents.timestamp, dateRange.startDate),
          lte(analyticsEvents.timestamp, dateRange.endDate)
        );
      }

      const [{ total }] = await this.readDb
        .select({ total: count() })
        .from(analyticsEvents)
        .where(and(...conditions));

      return Number(total);
    } catch (error) {
      throw new DatabaseError(
        `Failed to count events by user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Gets event type distribution within date range
   * 
   * Returns aggregated counts grouped by event type.
   * Useful for understanding event patterns and system usage.
   * 
   * @param dateRange - Date range filter
   * @returns Object with event types as keys and counts as values
   * @throws DatabaseError if database operation fails
   */
  async getEventTypeDistribution(dateRange?: DateRange): Promise<Record<string, number>> {
    try {
      let query = this.readDb
        .select({
          eventType: analyticsEvents.eventType,
          count: count(),
        })
        .from(analyticsEvents);

      if (dateRange) {
        query = query.where(
          and(
            gte(analyticsEvents.timestamp, dateRange.startDate),
            lte(analyticsEvents.timestamp, dateRange.endDate)
          )
        );
      }

      const results = await query
        .groupBy(analyticsEvents.eventType)
        .orderBy(desc(count()));

      // Convert to object format
      const distribution: Record<string, number> = {};
      for (const result of results) {
        distribution[result.eventType] = Number(result.count);
      }

      return distribution;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get event type distribution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Gets hourly event counts for a specific date
   * 
   * Returns event counts grouped by hour of the day.
   * Useful for understanding usage patterns and peak hours.
   * 
   * @param date - Date to analyze
   * @param eventType - Optional event type filter
   * @returns Array of hourly counts
   * @throws DatabaseError if database operation fails
   */
  async getHourlyEventCounts(date: Date, eventType?: string): Promise<Array<{ hour: number; count: number }>> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const conditions = [
        gte(analyticsEvents.timestamp, startOfDay),
        lte(analyticsEvents.timestamp, endOfDay)
      ];

      if (eventType) {
        conditions.push(eq(analyticsEvents.eventType, eventType));
      }

      const hourExtract = sql<number>`EXTRACT(HOUR FROM ${analyticsEvents.timestamp})`;
      
      const results = await this.readDb
        .select({
          hour: hourExtract,
          count: count(),
        })
        .from(analyticsEvents)
        .where(and(...conditions))
        .groupBy(hourExtract)
        .orderBy(hourExtract);

      // Fill in missing hours with 0 counts
      const hourlyCounts: Array<{ hour: number; count: number }> = [];
      for (let hour = 0; hour < 24; hour++) {
        const result = results.find(r => r.hour === hour);
        hourlyCounts.push({
          hour,
          count: result ? Number(result.count) : 0,
        });
      }

      return hourlyCounts;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get hourly event counts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Deletes old analytics events beyond retention period
   * 
   * Removes events older than the specified retention period.
   * Should be run periodically to manage database size.
   * 
   * @param retentionDays - Number of days to retain
   * @returns Number of deleted events
   * @throws DatabaseError if database operation fails
   */
  async deleteOldEvents(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.writeDb
        .delete(analyticsEvents)
        .where(lte(analyticsEvents.timestamp, cutoffDate));

      // Extract the number of affected rows from the result
      // Note: The exact property name may vary depending on the database driver
      const deletedCount = (result as any).rowCount || (result as any).changes || 0;

      return Number(deletedCount);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete old analytics events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete'
      );
    }
  }
}