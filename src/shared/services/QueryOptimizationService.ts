/**
 * Query Optimization Service
 * 
 * Provides centralized query optimization, caching, and N+1 prevention
 * Implements requirement 15.1 for database query optimization
 */

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { QueryOptimizer, QueryCache, CursorPaginationOptions, CursorPaginationResult } from '../utils/queryOptimization';

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
 * Query optimization service
 */
export class QueryOptimizationService {
  private queryOptimizer: QueryOptimizer;
  private queryCache: QueryCache;
  private batchLoaders = new Map<string, BatchLoader<any, any>>();

  constructor(
    private db: NodePgDatabase<any>,
    private redis: Redis
  ) {
    this.queryOptimizer = new QueryOptimizer(db);
    this.queryCache = new QueryCache();
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
    const { enableCaching = false, cacheTTL = 300000, enableAnalysis = false } = options;

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
      logger.error('Query execution failed', { queryName, error, executionTime: Date.now() - startTime });
      throw error;
    }
  }

  /**
   * Create batch loader for N+1 prevention
   */
  createBatchLoader<K, V>(
    name: string,
    config: BatchLoaderConfig<K, V>
  ): BatchLoader<K, V> {
    if (this.batchLoaders.has(name)) {
      return this.batchLoaders.get(name)!;
    }

    const loader = new BatchLoader<K, V>(config, this.redis);
    this.batchLoaders.set(name, loader);
    return loader;
  }

  /**
   * Get batch loader by name
   */
  getBatchLoader<K, V>(name: string): BatchLoader<K, V> | null {
    return this.batchLoaders.get(name) || null;
  }

  /**
   * Implement cursor-based pagination
   */
  async paginateWithCursor<T>(
    queryName: string,
    queryFn: (options: CursorPaginationOptions) => Promise<T[]>,
    options: CursorPaginationOptions
  ): Promise<CursorPaginationResult<T>> {
    const { cursor, limit, orderBy, direction } = options;

    // Execute paginated query
    const items = await this.executeOptimizedQuery(
      `${queryName}_paginated`,
      () => queryFn(options),
      { enableCaching: true, cacheTTL: 60000 } // 1 minute cache for pagination
    );

    // Generate next cursor if we have more items
    const hasMore = items.length === limit;
    const nextCursor = hasMore && items.length > 0 
      ? this.generateCursor(items[items.length - 1], orderBy)
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
  async getPerformanceAnalytics(): Promise<{
    slowQueries: number;
    cacheHitRate: number;
    averageQueryTime: number;
    batchLoaderStats: Record<string, any>;
  }> {
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
  async analyzeQuery(query: string, params: any[] = []) {
    return this.queryOptimizer.analyzeQuery(query, params);
  }

  /**
   * Private helper methods
   */
  private async getCachedResult<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
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

  private generateCursor(record: any, orderBy: string): string {
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
  private pendingPromises = new Map<K, Promise<V | null>>();
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
      (promise as any)._resolve = resolve;
      (promise as any)._reject = reject;
    });

    this.pendingPromises.set(key, promise);
    return promise;
  }

  /**
   * Load multiple items
   */
  async loadMany(keys: K[]): Promise<Array<V | null>> {
    return Promise.all(keys.map(key => this.load(key)));
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
        (promise as any)._resolve(result);
      });

    } catch (error) {
      // Reject all promises
      promises.forEach(promise => {
        (promise as any)._reject(error);
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
      return cached ? JSON.parse(cached) : null;
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
        pipeline.setex(
          cacheKey,
          Math.floor(this.config.cacheTTL / 1000),
          JSON.stringify(result)
        );
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
    private db: NodePgDatabase<any>,
    private optimizationService: QueryOptimizationService
  ) {}

  /**
   * Create user batch loader
   */
  createUserLoader() {
    return this.optimizationService.createBatchLoader('users', {
      batchSize: 100,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'user',
      cacheTTL: 300000, // 5 minutes
      loader: async (userIds: string[]) => {
        // Implementation would use proper Drizzle query
        const users = await this.db.query.users.findMany({
          where: (users, { inArray }) => inArray(users.id, userIds),
        });
        
        // Return results in same order as requested keys
        return userIds.map(id => users.find(user => user.id === id) || null);
      },
    });
  }

  /**
   * Create course batch loader
   */
  createCourseLoader() {
    return this.optimizationService.createBatchLoader('courses', {
      batchSize: 50,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'course',
      cacheTTL: 600000, // 10 minutes
      loader: async (courseIds: string[]) => {
        const courses = await this.db.query.courses.findMany({
          where: (courses, { inArray }) => inArray(courses.id, courseIds),
        });
        
        return courseIds.map(id => courses.find(course => course.id === id) || null);
      },
    });
  }

  /**
   * Create enrollment batch loader
   */
  createEnrollmentLoader() {
    return this.optimizationService.createBatchLoader('enrollments', {
      batchSize: 100,
      maxBatchDelay: 10,
      cacheKeyPrefix: 'enrollment',
      cacheTTL: 180000, // 3 minutes
      loader: async (enrollmentIds: string[]) => {
        const enrollments = await this.db.query.enrollments.findMany({
          where: (enrollments, { inArray }) => inArray(enrollments.id, enrollmentIds),
        });
        
        return enrollmentIds.map(id => enrollments.find(enrollment => enrollment.id === id) || null);
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
    get(target, prop, receiver) {
      const originalMethod = Reflect.get(target, prop, receiver);
      
      if (typeof originalMethod === 'function' && typeof prop === 'string') {
        // Wrap repository methods with optimization
        return function(...args: any[]) {
          const methodName = `${target.constructor.name}.${prop}`;
          
          return optimizationService.executeOptimizedQuery(
            methodName,
            () => originalMethod.apply(this, args),
            {
              enableCaching: prop.startsWith('find') || prop.startsWith('get'),
              cacheTTL: 300000, // 5 minutes default
              enableAnalysis: process.env.NODE_ENV === 'development',
            }
          );
        };
      }
      
      return originalMethod;
    },
  });
}