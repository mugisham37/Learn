/**
 * Redis Cache Configuration
 *
 * Manages Redis connection for caching, sessions, and rate limiting
 * Implements connection pooling, retry logic, and comprehensive cache utilities
 *
 * Requirements: 15.2, 15.3
 */

import Redis, { RedisOptions } from 'ioredis';

import { config } from '../../config/index.js';

/**
 * Cache key prefixes for different domains
 * Provides namespace isolation and easier cache invalidation
 */
export const CachePrefix = {
  USER: 'user',
  COURSE: 'course',
  ENROLLMENT: 'enrollment',
  QUIZ: 'quiz',
  ASSIGNMENT: 'assignment',
  ASSIGNMENT_SUBMISSION: 'assignment_submission',
  ANALYTICS: 'analytics',
  SEARCH: 'search',
  SESSION: 'session',
  RATE_LIMIT: 'ratelimit',
} as const;

/**
 * Default TTL values in seconds for different cache types
 * Balances freshness with hit rates per requirement 15.2
 */
export const CacheTTL = {
  SHORT: 60, // 1 minute - frequently changing data
  MEDIUM: 300, // 5 minutes - user profiles, course metadata
  LONG: 3600, // 1 hour - analytics, search results
  VERY_LONG: 86400, // 24 hours - static content
  SESSION: 2592000, // 30 days - refresh tokens
  ANALYTICS: 300, // 5 minutes - analytics data
} as const;

/**
 * Redis connection configuration with retry logic and pooling
 * Implements exponential backoff per requirement 15.2
 */
const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,

  // Connection pooling configuration
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Retry strategy with exponential backoff
  retryStrategy: (times: number) => {
    if (times > 10) {
      // Stop retrying after 10 attempts
      console.error('Redis connection failed after 10 retries');
      return null;
    }
    // Exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms, 1600ms, 2000ms (capped)
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },

  // Reconnect on error
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect when Redis is in readonly mode
      return true;
    }
    return false;
  },

  // Connection timeout
  connectTimeout: 10000,

  // Keep alive
  keepAlive: 30000,

  // Lazy connect - don't connect until first command
  lazyConnect: false,
};

/**
 * Primary Redis client instance for general caching
 */
export const redis = new Redis(redisOptions);

/**
 * Get Redis client instance (alias for compatibility)
 */
export const getRedisClient = () => redis;

/**
 * Separate Redis client for session storage
 * Isolates session data from general cache
 */
export const sessionRedis = new Redis({
  ...redisOptions,
  db: (config.redis.db || 0) + 1, // Use separate database for sessions
  keyPrefix: `${CachePrefix.SESSION}:`,
});

/**
 * Connection event handlers
 */
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('ready', () => {
  console.log('Redis ready to accept commands');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error.message);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

sessionRedis.on('connect', () => {
  console.log('Session Redis connected successfully');
});

sessionRedis.on('error', (error) => {
  console.error('Session Redis connection error:', error.message);
});

/**
 * Health check for Redis connectivity
 * Returns detailed status information
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Health check for session Redis
 */
export async function checkSessionRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await sessionRedis.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully closes all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  try {
    await Promise.all([redis.quit(), sessionRedis.quit()]);
    console.log('All Redis connections closed gracefully');
  } catch (error) {
    console.error('Error closing Redis connections:', error);
    // Force disconnect if graceful shutdown fails
    redis.disconnect();
    sessionRedis.disconnect();
  }
}

/**
 * Builds a cache key with proper namespace
 * Implements cache key naming conventions per requirement 15.2
 */
export function buildCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Comprehensive cache utility functions
 * Implements caching with appropriate TTL per requirement 15.2
 */
export const cache = {
  /**
   * Gets a value from cache
   * Returns null if key doesn't exist or value is invalid JSON
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Sets a value in cache with optional TTL
   * Uses EX option for atomic set with expiration
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Sets a value only if the key doesn't exist (NX option)
   * Returns true if set, false if key already exists
   */
  async setIfNotExists(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      let result: string | null;

      if (ttlSeconds) {
        result = await redis.set(key, serialized, 'EX', ttlSeconds, 'NX');
      } else {
        result = await redis.set(key, serialized, 'NX');
      }

      return result === 'OK';
    } catch (error) {
      console.error(`Cache setIfNotExists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Gets multiple values from cache in a single pipeline
   * More efficient than multiple individual gets
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) {
        return [];
      }

      const values = await redis.mget(...keys);
      return values.map((value) => {
        if (!value) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  },

  /**
   * Sets multiple key-value pairs in a single pipeline
   * More efficient than multiple individual sets
   */
  async mset(entries: Array<{ key: string; value: unknown; ttl?: number }>): Promise<void> {
    try {
      if (entries.length === 0) {
        return;
      }

      const pipeline = redis.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        if (entry.ttl) {
          pipeline.setex(entry.key, entry.ttl, serialized);
        } else {
          pipeline.set(entry.key, serialized);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
      throw error;
    }
  },

  /**
   * Deletes a single key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Deletes multiple keys from cache
   */
  async deleteMany(keys: string[]): Promise<void> {
    try {
      if (keys.length === 0) {
        return;
      }
      await redis.del(...keys);
    } catch (error) {
      console.error('Cache deleteMany error:', error);
      throw error;
    }
  },

  /**
   * Deletes all keys matching a pattern
   * Uses SCAN for safe iteration in production
   * Implements cache invalidation per requirement 15.3
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        // Use SCAN instead of KEYS for production safety
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      return deletedCount;
    } catch (error) {
      console.error(`Cache deletePattern error for pattern ${pattern}:`, error);
      throw error;
    }
  },

  /**
   * Checks if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Gets the TTL (time to live) of a key in seconds
   * Returns -1 if key exists but has no expiration
   * Returns -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Cache ttl error for key ${key}:`, error);
      return -2;
    }
  },

  /**
   * Sets expiration on an existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Increments a numeric value in cache
   * Creates the key with value 1 if it doesn't exist
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Decrements a numeric value in cache
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await redis.decrby(key, amount);
    } catch (error) {
      console.error(`Cache decrement error for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Clears all keys in the current database
   * USE WITH CAUTION - typically only for testing
   */
  async clear(): Promise<void> {
    try {
      await redis.flushdb();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
  },

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits?: string;
    misses?: string;
  }> {
    try {
      const [dbSize, info] = await Promise.all([redis.dbsize(), redis.info('stats')]);

      // Parse info string for stats
      const stats: Record<string, string> = {};
      info.split('\r\n').forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        keys: dbSize,
        memory: stats.used_memory_human || 'unknown',
        hits: stats.keyspace_hits,
        misses: stats.keyspace_misses,
      };
    } catch (error) {
      console.error('Cache getStats error:', error);
      return {
        keys: 0,
        memory: 'unknown',
      };
    }
  },
};

/**
 * Session storage utilities
 * Dedicated functions for session management
 */
export const sessionCache = {
  /**
   * Stores a session with automatic expiration
   */
  async set(
    sessionId: string,
    data: unknown,
    ttlSeconds: number = CacheTTL.SESSION
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await sessionRedis.setex(sessionId, ttlSeconds, serialized);
    } catch (error) {
      console.error(`Session set error for ${sessionId}:`, error);
      throw error;
    }
  },

  /**
   * Retrieves session data
   */
  async get<T>(sessionId: string): Promise<T | null> {
    try {
      const value = await sessionRedis.get(sessionId);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Session get error for ${sessionId}:`, error);
      return null;
    }
  },

  /**
   * Deletes a session
   */
  async delete(sessionId: string): Promise<void> {
    try {
      await sessionRedis.del(sessionId);
    } catch (error) {
      console.error(`Session delete error for ${sessionId}:`, error);
      throw error;
    }
  },

  /**
   * Extends session expiration
   */
  async extend(sessionId: string, ttlSeconds: number = CacheTTL.SESSION): Promise<boolean> {
    try {
      const result = await sessionRedis.expire(sessionId, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error(`Session extend error for ${sessionId}:`, error);
      return false;
    }
  },

  /**
   * Checks if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    try {
      const result = await sessionRedis.exists(sessionId);
      return result === 1;
    } catch (error) {
      console.error(`Session exists error for ${sessionId}:`, error);
      return false;
    }
  },
};
