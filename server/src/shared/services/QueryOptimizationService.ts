/**
 * Query Optimization Service
 *
 * Provides centralized query optimization, caching, and N+1 prevention
 * Implements requirement 15.1 for database query optimization
 */

import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';

import * as schema from '../../infrastructure/database/schema/index.js';
import { logger } from '../utils/logger.js';
import {
  QueryOptimizer,
  CursorPaginationOptions,
  CursorPaginationResult,
} from '../utils/queryOptimization.js';

/**
 * Batch loading configuration
 */
interface BatchLoaderConfig<K, V> {
  batchSize: number;
  maxBatchDelay: number;
  cacheKeyPrefix: string;
  cacheTTL: number;
  loader: (keys: K[]) => Promise<V[]>;
}

/**
 * Promise with resolver functions attached
 */
interface PromiseWithResolvers<T> extends Promise<T> {
  _resolve?: (value: T | PromiseLike<T>) => void;
  _reject?: (reason?: unknown) => void;
}

/**
 * Query optimization service
 */
export class QueryOptimizationService {
  private queryOptimizer: QueryOptimizer;
  private batchLoaders = new Map<string, BatchLoader<unknown, unknown>>();

  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private redis: Redis
  ) {
    // Create a generic QueryOptimizer that accepts any database schema
    this.queryOptimizer = new QueryOptimizer(this.db as unknown as NodePgDatabase<Record<string, never>>);
  }

  /**
   * Execute query with optimization analysis
   */
  async executeOptimizedQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      enableCaching?: boolean;
      cacheTTL?: number;
      enableAnalysis?: boolean;
    } = {}
  ): Promise<T> {
    const {
      enableCaching = false,
      cacheTTL = 300000,
      enableAnalysis: _enableAnalysis = false,
    } = options;

    // Check cache first if enabled
    if (enableCaching) {
      const cacheKey = `query:${queryName}`;
      const cached = await this.getCachedResult<T>(cacheKey);
      if (cached !== null) {
        logger.debug('Query cache hit', { queryName });
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      // Execute query
      const result = await queryFn();
      const executionTime = Date.now() - startTime;

      // Log slow queries
      if (executionTime > 100) {
        logger.warn('Slow query detected', { queryName, executionTime });
      }

      // Cache result if enabled
      if (enableCaching) {
        const cacheKey = `query:${queryName}`;
        await this.setCachedResult(cacheKey, result, cacheTTL);
      }

      // Log performance metrics
      logger.debug('Query executed', { queryName, executionTime });

      return result;
    } catch (error) {
      logger.error('Query execution failed', {
        queryName,
        error,
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Create batch loader for N+1 prevention
   */
  createBatchLoader<K, V>(name: string, config: BatchLoaderConfig<K, V>): BatchLoader<K, V> {
    if (this.batchLoaders.has(name)) {
      return this.batchLoaders.get(name) as BatchLoader<K, V>;
    }

    const loader = new BatchLoader<K, V>(config, this.redis);
    this.batchLoaders.set(name, loader as BatchLoader<unknown, unknown>);
    return loader;
  }

  /**
   * Get batch loader by name
   */
  getBatchLoader<K, V>(name: string): BatchLoader<K, V> | null {
    const loader = this.batchLoaders.get(name);
    return loader ? (loader as BatchLoader<K, V>) : null;
  }

  /**
   * Implement cursor-based pagination
   */
  async paginateWithCursor<T>(
    queryName: string,
    queryFn: (options: CursorPaginationOptions) => Promise<T[]>,
    options: CursorPaginationOptions
  ): Promise<CursorPaginationResult<T>> {
    const { cursor: _cursor, limit, orderBy, direction: _direction } = options;

    // Execute paginated query
    const items = await this.executeOptimizedQuery(
      `${queryName}_paginated`,
      () => queryFn(options),
      { enableCaching: true, cacheTTL: 60000 } // 1 minute cache for pagination
    );

    // Generate next cursor if we have more items
    const hasMore = items.length === limit;
    const nextCursor =
      hasMore && items.length > 0
        ? this.generateCursor(items[items.length - 1] as Record<string, unknown>, orderBy)
        : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Invalidate cached queries by pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`query:${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cache invalidated', { pattern, keysCount: keys.length });
      }
    } catch (error) {
      logger.error('Cache invalidation failed', { pattern, error });
    }
  }

  /**
   * Get query performance analytics
   */
  getPerformanceAnalytics(): {
    slowQueries: number;
    cacheHitRate: number;
    averageQueryTime: number;
    batchLoaderStats: Record<string, unknown>;
  } {
    // This would be implemented with proper metrics collection
    return {
      slowQueries: 0,
      cacheHitRate: 0,
      averageQueryTime: 0,
      batchLoaderStats: {},
    };
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(query: string, params: unknown[] = []): Promise<unknown> {
    return await this.queryOptimizer.analyzeQuery(query, params);
  }

  /**
   * Private helper methods
   */
  private async getCachedResult<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      logger.warn('Cache read failed', { key, error });
      return null;
    }
  }

  private async setCachedResult<T>(key: string, result: T, ttlMs: number): Promise<void> {
    try {
      await this.redis.setex(key, Math.floor(ttlMs / 1000), JSON.stringify(result));
    } catch (error) {
      logger.warn('Cache write failed', { key, error });
    }
  }

  private generateCursor(record: Record<string, unknown>, orderBy: string): string {
    const value = record[orderBy];
    if (value instanceof Date) {
      return Buffer.from(value.toISOString()).toString('base64');
    }
    return Buffer.from(String(value)).toString('base64');
  }
}

/**
 * Batch loader for preventing N+1 queries
 */
export class BatchLoader<K, V> {
  private pendingKeys = new Set<K>();
  private pendingPromises = new Map<K, PromiseWithResolvers<V | null>>();
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(
    private config: BatchLoaderConfig<K, V>,
    private redis: Redis
  ) {}

  /**
   * Load single item with batching
   */
  async load(key: K): Promise<V | null> {
    // Check if already pending
    if (this.pendingPromises.has(key)) {
      return this.pendingPromises.get(key)!;
    }

    // Check cache first
    const cached = await this.getCached(key);
    if (cached !== null) {
      return cached;
    }

    // Create promise for this key
    const promise = new Promise<V | null>((resolve, reject) => {
      this.pendingKeys.add(key);

      // Set up batch execution
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch().catch(reject);
        }, this.config.maxBatchDelay);
      }

      // Store resolver for later
      (promise as PromiseWithResolvers<V | null>)._resolve = resolve;
      (promise as PromiseWithResolvers<V | null>)._reject = reject;
    });

    this.pendingPromises.set(key, promise);
    return promise;
  }

  /**
   * Load multiple items
   */
  async loadMany(keys: K[]): Promise<Array<V | null>> {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  /**
   * Clear cache for specific key
   */
  async clearCache(key: K): Promise<void> {
    const cacheKey = `${this.config.cacheKeyPrefix}:${String(key)}`;
    await this.redis.del(cacheKey);
  }

  /**
   * Execute batch loading
   */
  private async executeBatch(): Promise<void> {
    if (this.pendingKeys.size === 0) return;

    const keys = Array.from(this.pendingKeys);
    const promises = Array.from(this.pendingPromises.values());

    // Clear pending state
    this.pendingKeys.clear();
    this.pendingPromises.clear();
    this.batchTimeout = null;

    try {
      // Execute batch loader
      const results = await this.config.loader(keys);

      // Cache results
      await this.cacheResults(keys, results);

      // Resolve promises
      promises.forEach((promise, index) => {
        const result = results[index] || null;
        promise._resolve?.(result);
      });
    } catch (error) {
      // Reject all promises
      promises.forEach((promise) => {
        promise._reject?.(error);
      });
    }
  }

  /**
   * Get cached result
   */
  private async getCached(key: K): Promise<V | null> {
    try {
      const cacheKey = `${this.config.cacheKeyPrefix}:${String(key)}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? (JSON.parse(cached) as V) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cache batch results
   */
  private async cacheResults(keys: K[], results: V[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    keys.forEach((key, index) => {
      const result = results[index];
      if (result !== null && result !== undefined) {
        const cacheKey = `${this.config.cacheKeyPrefix}:${String(key)}`;
        pipeline.setex(cacheKey, Math.floor(this.config.cacheTTL / 1000), JSON.stringify(result));
      }
    });

    await pipeline.exec();
  }
}

/**
 * Common batch loaders factory
 */
export class BatchLoadersFactory {
  constructor(
    private db: NodePgDatabase<typeof schema>,
    private optimizationService: QueryOptimizationService
  ) {}

  /**
   * Create user batch loader
   */
  createUserLoader(): BatchLoader<string, typeof schema.users.$inferSelect | null> {
    return this.optimizationService.createBatchLoader('users', {
      batchSize: 100,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'user',
      cacheTTL: 300000, // 5 minutes
      loader: async (userIds: string[]) => {
        // Implementation would use proper Drizzle query
        const users = await this.db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, userIds));

        // Return results in same order as requested keys
        return userIds.map((id) => users.find((user) => user.id === id) || null);
      },
    });
  }

  /**
   * Create course batch loader
   */
  createCourseLoader(): BatchLoader<string, typeof schema.courses.$inferSelect | null> {
    return this.optimizationService.createBatchLoader('courses', {
      batchSize: 50,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'course',
      cacheTTL: 600000, // 10 minutes
      loader: async (courseIds: string[]) => {
        const courses = await this.db
          .select()
          .from(schema.courses)
          .where(inArray(schema.courses.id, courseIds));

        return courseIds.map((id) => courses.find((course) => course.id === id) || null);
      },
    });
  }

  /**
   * Create enrollment batch loader
   */
  createEnrollmentLoader(): BatchLoader<string, typeof schema.enrollments.$inferSelect | null> {
    return this.optimizationService.createBatchLoader('enrollments', {
      batchSize: 100,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'enrollment',
      cacheTTL: 180000, // 3 minutes
      loader: async (enrollmentIds: string[]) => {
        const enrollments = await this.db
          .select()
          .from(schema.enrollments)
          .where(inArray(schema.enrollments.id, enrollmentIds));

        return enrollmentIds.map(
          (id) => enrollments.find((enrollment) => enrollment.id === id) || null
        );
      },
    });
  }
}

/**
 * Query optimization middleware for repositories
 */
export function withQueryOptimization<T extends object>(
  repository: T,
  optimizationService: QueryOptimizationService
): T {
  return new Proxy(repository, {
    get(target, prop, receiver): unknown {
      const originalMethod = Reflect.get(target, prop, receiver);

      if (typeof originalMethod === 'function' && typeof prop === 'string') {
        // Wrap repository methods with optimization
        return async function (this: T, ...args: unknown[]): Promise<unknown> {
          const methodName = `${target.constructor.name}.${prop}`;

          return await optimizationService.executeOptimizedQuery(
            methodName,
            async () => await Promise.resolve((originalMethod as (...args: unknown[]) => unknown).apply(this, args)),
            {
              enableCaching: prop.startsWith('find') || prop.startsWith('get'),
              cacheTTL: 300000, // 5 minutes default
              enableAnalysis: process.env['NODE_ENV'] === 'development',
            }
          );
        };
      }

      return originalMethod;
    },
  });
}
