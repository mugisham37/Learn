/**
 * Redis Cache Configuration
 * 
 * Manages Redis connection for caching, sessions, and rate limiting
 */

import Redis from 'ioredis';

import { config } from '../../config/index.js';

/**
 * Redis client instance
 */
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

/**
 * Tests Redis connectivity
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log('Redis connection successful');
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

/**
 * Closes Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
  console.log('Redis connection closed');
}

/**
 * Cache utility functions
 */
export const cache = {
  /**
   * Gets a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  },

  /**
   * Sets a value in cache with optional TTL
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Deletes multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  /**
   * Checks if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },
};
