/**
 * Optimized Base Repository
 *
 * Provides optimized database operations with caching, pagination, and N+1 prevention
 * Requirements: 15.1 - Database query optimization
 */

import { SQL, and, asc, desc, eq, gt, lt, sql, AnyColumn } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgTable } from 'drizzle-orm/pg-core';
import { Redis } from 'ioredis';

import { logger } from '../utils/logger';

/**
 * Pagination options for cursor-based pagination
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
  orderBy: string;
  direction: 'asc' | 'desc';
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  keyPrefix: string;
}

/**
 * Query optimization options
 */
export interface QueryOptions {
  cache?: CacheConfig;
  skipCache?: boolean;
  enableAnalysis?: boolean;
}

/**
 * Optimized base repository with caching and pagination
 */
export abstract class OptimizedBaseRepository<T extends Record<string, unknown>> {
  protected abstract table: PgTable;
  protected abstract primaryKey: string;

  constructor(
    protected db: NodePgDatabase<Record<string, never>>,
    protected redis: Redis,
    protected defaultCacheConfig: CacheConfig
  ) {}

  /**
   * Find by ID with caching
   */
  async findById(id: string, options: QueryOptions = {}): Promise<T | null> {
    const cacheConfig = { ...this.defaultCacheConfig, ...options.cache };

    // Check cache first if enabled
    if (cacheConfig.enabled && !options.skipCache) {
      const cached = await this.getFromCache(id, cacheConfig.keyPrefix);
      if (cached) {
        logger.debug('Cache hit for findById', { id, table: this.table });
        return cached;
      }
    }

    // Query database
    const startTime = Date.now();
    const primaryKeyColumn = this.table[this.primaryKey as keyof typeof this.table] as AnyColumn;
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(primaryKeyColumn, id))
      .limit(1);
    
    const result = results[0] as T | undefined;

    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 100) {
      logger.warn('Slow query detected in findById', {
        id,
        table: this.table,
        executionTime,
      });
    }

    // Cache result if enabled
    if (result && cacheConfig.enabled) {
      await this.setCache(id, result, cacheConfig);
    }

    return result ?? null;
  }

  /**
   * Find multiple records with cursor-based pagination
   */
  async findWithCursorPagination(
    whereConditions: SQL[] = [],
    options: CursorPaginationOptions & QueryOptions = {
      limit: 20,
      orderBy: 'created_at',
      direction: 'desc',
    }
  ): Promise<PaginationResult<T>> {
    const { cursor, limit, orderBy, direction, cache, skipCache } = options;
    const cacheConfig = { ...this.defaultCacheConfig, ...cache };

    // Generate cache key for paginated results
    const cacheKey = this.generatePaginationCacheKey(whereConditions, options);

    // Check cache if enabled
    if (cacheConfig.enabled && !skipCache && !cursor) {
      const cached = await this.getFromCache<PaginationResult<T>>(cacheKey, cacheConfig.keyPrefix);
      if (cached) {
        logger.debug('Cache hit for pagination', { cacheKey });
        return cached;
      }
    }

    // Build query conditions
    const conditions = [...whereConditions];

    // Add cursor condition if provided
    if (cursor) {
      const cursorValue = this.parseCursor(cursor);
      const orderByColumn = this.table[orderBy as keyof typeof this.table] as AnyColumn;
      const cursorCondition =
        direction === 'asc'
          ? gt(orderByColumn, cursorValue)
          : lt(orderByColumn, cursorValue);
      conditions.push(cursorCondition);
    }

    // Execute query
    const startTime = Date.now();
    const orderDirection = direction === 'asc' ? asc : desc;
    const orderByColumn = this.table[orderBy as keyof typeof this.table] as AnyColumn;

    const items = await this.db
      .select()
      .from(this.table)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection(orderByColumn))
      .limit(limit + 1); // Fetch one extra to check if there are more

    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 100) {
      logger.warn('Slow pagination query detected', {
        table: this.table,
        executionTime,
        conditions: conditions.length,
        limit,
      });
    }

    // Determine if there are more items
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;

    // Generate next cursor
    const nextCursor =
      hasMore && resultItems.length > 0
        ? this.generateCursor(resultItems[resultItems.length - 1] as T, orderBy)
        : undefined;

    const result: PaginationResult<T> = {
      items: resultItems as unknown as T[],
      nextCursor,
      hasMore,
    };

    // Cache first page results if no cursor was provided
    if (cacheConfig.enabled && !cursor) {
      await this.setCache(cacheKey, result, cacheConfig);
    }

    return result;
  }

  /**
   * Find multiple records by IDs (batch loading)
   */
  async findByIds(ids: string[], options: QueryOptions = {}): Promise<T[]> {
    if (ids.length === 0) return [];

    const cacheConfig = { ...this.defaultCacheConfig, ...options.cache };
    const results: T[] = [];
    const uncachedIds: string[] = [];

    // Check cache for each ID if enabled
    if (cacheConfig.enabled && !options.skipCache) {
      for (const id of ids) {
        const cached = await this.getFromCache(id, cacheConfig.keyPrefix);
        if (cached) {
          results.push(cached);
        } else {
          uncachedIds.push(id);
        }
      }
    } else {
      uncachedIds.push(...ids);
    }

    // Query uncached IDs
    if (uncachedIds.length > 0) {
      const startTime = Date.now();

      const primaryKeyColumn = this.table[this.primaryKey as keyof typeof this.table] as AnyColumn;
      const dbResults = await this.db
        .select()
        .from(this.table)
        .where(sql`${primaryKeyColumn} = ANY(${uncachedIds})`);

      const executionTime = Date.now() - startTime;

      // Log slow queries
      if (executionTime > 100) {
        logger.warn('Slow batch query detected', {
          table: this.table,
          executionTime,
          idsCount: uncachedIds.length,
        });
      }

      results.push(...(dbResults as T[]));

      // Cache individual results if enabled
      if (cacheConfig.enabled) {
        for (const result of dbResults) {
          await this.setCache((result as Record<string, unknown>)[this.primaryKey] as string, result as T, cacheConfig);
        }
      }
    }

    // Return results in the same order as requested IDs
    return ids
      .map((id) => results.find((result) => (result as Record<string, unknown>)[this.primaryKey] === id))
      .filter((result): result is T => Boolean(result));
  }

  /**
   * Create record with cache invalidation
   */
  async create(
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>,
    _options: QueryOptions = {}
  ): Promise<T> {
    const startTime = Date.now();

    const [result] = await this.db.insert(this.table).values(data as Record<string, unknown>).returning();

    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 100) {
      logger.warn('Slow create query detected', {
        table: this.table,
        executionTime,
      });
    }

    // Invalidate related caches
    await this.invalidateRelatedCaches(result as T);

    return result as T;
  }

  /**
   * Update record with cache invalidation
   */
  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'created_at'>>,
    _options: QueryOptions = {}
  ): Promise<T | null> {
    const startTime = Date.now();

    const primaryKeyColumn = this.table[this.primaryKey as keyof typeof this.table] as AnyColumn;
    const updateData = { ...data, updated_at: new Date() } as Record<string, unknown>;
    const [result] = await this.db
      .update(this.table)
      .set(updateData)
      .where(eq(primaryKeyColumn, id))
      .returning();

    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 100) {
      logger.warn('Slow update query detected', {
        table: this.table,
        executionTime,
        id,
      });
    }

    if (result) {
      // Invalidate caches
      await this.invalidateCache(id);
      await this.invalidateRelatedCaches(result as T);
    }

    return (result as T) || null;
  }

  /**
   * Delete record with cache invalidation
   */
  async delete(id: string, _options: QueryOptions = {}): Promise<boolean> {
    const startTime = Date.now();

    const primaryKeyColumn = this.table[this.primaryKey as keyof typeof this.table] as AnyColumn;
    const results = await this.db
      .delete(this.table)
      .where(eq(primaryKeyColumn, id))
      .returning();
    
    const result = results[0];

    const executionTime = Date.now() - startTime;

    // Log slow queries
    if (executionTime > 100) {
      logger.warn('Slow delete query detected', {
        table: this.table,
        executionTime,
        id,
      });
    }

    if (result) {
      // Invalidate caches
      await this.invalidateCache(id);
      await this.invalidateRelatedCaches(result as T);
      return true;
    }

    return false;
  }

  /**
   * Cache management methods
   */
  protected async getFromCache<R = T>(key: string, prefix: string): Promise<R | null> {
    try {
      const cacheKey = `${prefix}:${key}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) as R : null;
    } catch (error) {
      logger.warn('Cache read failed', { key, prefix, error });
      return null;
    }
  }

  protected async setCache<R = T>(key: string, value: R, config: CacheConfig): Promise<void> {
    try {
      const cacheKey = `${config.keyPrefix}:${key}`;
      await this.redis.setex(cacheKey, config.ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache write failed', { key, config, error });
    }
  }

  protected async invalidateCache(key: string): Promise<void> {
    try {
      const cacheKey = `${this.defaultCacheConfig.keyPrefix}:${key}`;
      await this.redis.del(cacheKey);
    } catch (error) {
      logger.warn('Cache invalidation failed', { key, error });
    }
  }

  protected async invalidateCachePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.defaultCacheConfig.keyPrefix}:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Cache pattern invalidation failed', { pattern, error });
    }
  }

  /**
   * Cursor utilities
   */
  protected generateCursor(record: T, orderBy: string): string {
    const value = (record as Record<string, unknown>)[orderBy];
    if (value instanceof Date) {
      return Buffer.from(value.toISOString()).toString('base64');
    }
    return Buffer.from(String(value)).toString('base64');
  }

  protected parseCursor(cursor: string): unknown {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      // Try to parse as date first
      const date = new Date(decoded);
      if (!isNaN(date.getTime())) {
        return date;
      }
      // Otherwise return as string/number
      return isNaN(Number(decoded)) ? decoded : Number(decoded);
    } catch {
      throw new Error('Invalid cursor format');
    }
  }

  protected generatePaginationCacheKey(
    conditions: SQL[],
    options: CursorPaginationOptions
  ): string {
    const conditionsStr = conditions.map((c) => String(c)).join('|');
    const optionsStr = `${options.limit}:${options.orderBy}:${options.direction}`;
    return `pagination:${Buffer.from(`${conditionsStr}:${optionsStr}`).toString('base64')}`;
  }

  /**
   * Abstract methods for subclasses to implement
   */
  protected abstract invalidateRelatedCaches(record: T): Promise<void>;

  /**
   * Get query execution statistics
   */
  getQueryStats(): Promise<{
    slowQueries: number;
    cacheHitRate: number;
    averageExecutionTime: number;
  }> {
    // This would be implemented with proper metrics collection
    // For now, return placeholder values
    return Promise.resolve({
      slowQueries: 0,
      cacheHitRate: 0,
      averageExecutionTime: 0,
    });
  }
}
