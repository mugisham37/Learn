/**
 * Redis Cache Infrastructure Tests
 * 
 * Tests Redis connection, caching utilities, and session storage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  redis,
  sessionRedis,
  cache,
  sessionCache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
  checkRedisHealth,
  checkSessionRedisHealth,
  closeRedisConnections,
} from './index.js';

describe('Redis Cache Infrastructure', () => {
  beforeAll(async () => {
    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up connections
    await closeRedisConnections();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cache.clear();
  });

  describe('Connection and Health Checks', () => {
    it('should connect to Redis successfully', async () => {
      const result = await redis.ping();
      expect(result).toBe('PONG');
    });

    it('should connect to session Redis successfully', async () => {
      const result = await sessionRedis.ping();
      expect(result).toBe('PONG');
    });

    it('should return healthy status for Redis', async () => {
      const health = await checkRedisHealth();
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });

    it('should return healthy status for session Redis', async () => {
      const health = await checkSessionRedisHealth();
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();
    });
  });

  describe('Cache Key Naming Conventions', () => {
    it('should build cache key with single part', () => {
      const key = buildCacheKey(CachePrefix.USER, '123');
      expect(key).toBe('user:123');
    });

    it('should build cache key with multiple parts', () => {
      const key = buildCacheKey(CachePrefix.COURSE, '456', 'modules', '789');
      expect(key).toBe('course:456:modules:789');
    });

    it('should build cache key with numeric parts', () => {
      const key = buildCacheKey(CachePrefix.ANALYTICS, 2024, 1, 15);
      expect(key).toBe('analytics:2024:1:15');
    });

    it('should have all required cache prefixes', () => {
      expect(CachePrefix.USER).toBe('user');
      expect(CachePrefix.COURSE).toBe('course');
      expect(CachePrefix.ENROLLMENT).toBe('enrollment');
      expect(CachePrefix.QUIZ).toBe('quiz');
      expect(CachePrefix.ASSIGNMENT).toBe('assignment');
      expect(CachePrefix.ANALYTICS).toBe('analytics');
      expect(CachePrefix.SEARCH).toBe('search');
      expect(CachePrefix.SESSION).toBe('session');
      expect(CachePrefix.RATE_LIMIT).toBe('ratelimit');
    });
  });

  describe('Cache TTL Management', () => {
    it('should have appropriate TTL values', () => {
      expect(CacheTTL.SHORT).toBe(60);
      expect(CacheTTL.MEDIUM).toBe(300);
      expect(CacheTTL.LONG).toBe(3600);
      expect(CacheTTL.VERY_LONG).toBe(86400);
      expect(CacheTTL.SESSION).toBe(2592000);
    });
  });

  describe('Basic Cache Operations', () => {
    it('should set and get a string value', async () => {
      const key = 'test:string';
      const value = 'hello world';
      
      await cache.set(key, value);
      const result = await cache.get<string>(key);
      
      expect(result).toBe(value);
    });

    it('should set and get an object value', async () => {
      const key = 'test:object';
      const value = { id: '123', name: 'Test User', active: true };
      
      await cache.set(key, value);
      const result = await cache.get<typeof value>(key);
      
      expect(result).toEqual(value);
    });

    it('should set and get an array value', async () => {
      const key = 'test:array';
      const value = [1, 2, 3, 4, 5];
      
      await cache.set(key, value);
      const result = await cache.get<number[]>(key);
      
      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non:existent:key');
      expect(result).toBeNull();
    });

    it('should set value with TTL', async () => {
      const key = 'test:ttl';
      const value = 'expires soon';
      
      await cache.set(key, value, 2);
      
      // Check TTL is set
      const ttl = await cache.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(2);
    });

    it('should delete a key', async () => {
      const key = 'test:delete';
      const value = 'to be deleted';
      
      await cache.set(key, value);
      expect(await cache.exists(key)).toBe(true);
      
      await cache.delete(key);
      expect(await cache.exists(key)).toBe(false);
    });

    it('should check if key exists', async () => {
      const key = 'test:exists';
      
      expect(await cache.exists(key)).toBe(false);
      
      await cache.set(key, 'value');
      expect(await cache.exists(key)).toBe(true);
    });
  });

  describe('Advanced Cache Operations', () => {
    it('should set value only if not exists', async () => {
      const key = 'test:setnx';
      const value1 = 'first';
      const value2 = 'second';
      
      const result1 = await cache.setIfNotExists(key, value1);
      expect(result1).toBe(true);
      
      const result2 = await cache.setIfNotExists(key, value2);
      expect(result2).toBe(false);
      
      const stored = await cache.get<string>(key);
      expect(stored).toBe(value1);
    });

    it('should get multiple values', async () => {
      const keys = ['test:mget:1', 'test:mget:2', 'test:mget:3'];
      const values = ['value1', 'value2', 'value3'];
      
      await cache.set(keys[0], values[0]);
      await cache.set(keys[1], values[1]);
      await cache.set(keys[2], values[2]);
      
      const results = await cache.mget<string>(keys);
      expect(results).toEqual(values);
    });

    it('should handle missing keys in mget', async () => {
      const keys = ['test:mget:exists', 'test:mget:missing'];
      await cache.set(keys[0], 'exists');
      
      const results = await cache.mget<string>(keys);
      expect(results[0]).toBe('exists');
      expect(results[1]).toBeNull();
    });

    it('should set multiple values', async () => {
      const entries = [
        { key: 'test:mset:1', value: 'value1' },
        { key: 'test:mset:2', value: 'value2' },
        { key: 'test:mset:3', value: 'value3' },
      ];
      
      await cache.mset(entries);
      
      const results = await cache.mget<string>(entries.map((e) => e.key));
      expect(results).toEqual(entries.map((e) => e.value));
    });

    it('should delete multiple keys', async () => {
      const keys = ['test:mdel:1', 'test:mdel:2', 'test:mdel:3'];
      
      for (const key of keys) {
        await cache.set(key, 'value');
      }
      
      await cache.deleteMany(keys);
      
      for (const key of keys) {
        expect(await cache.exists(key)).toBe(false);
      }
    });

    it('should delete keys by pattern', async () => {
      const keys = [
        'test:pattern:user:1',
        'test:pattern:user:2',
        'test:pattern:user:3',
        'test:pattern:course:1',
      ];
      
      for (const key of keys) {
        await cache.set(key, 'value');
      }
      
      const deletedCount = await cache.deletePattern('test:pattern:user:*');
      expect(deletedCount).toBe(3);
      
      expect(await cache.exists('test:pattern:user:1')).toBe(false);
      expect(await cache.exists('test:pattern:user:2')).toBe(false);
      expect(await cache.exists('test:pattern:user:3')).toBe(false);
      expect(await cache.exists('test:pattern:course:1')).toBe(true);
    });

    it('should get TTL of a key', async () => {
      const key = 'test:ttl:check';
      await cache.set(key, 'value', 60);
      
      const ttl = await cache.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should return -1 for key with no expiration', async () => {
      const key = 'test:ttl:noexpire';
      await cache.set(key, 'value');
      
      const ttl = await cache.ttl(key);
      expect(ttl).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      const ttl = await cache.ttl('test:ttl:nonexistent');
      expect(ttl).toBe(-2);
    });

    it('should set expiration on existing key', async () => {
      const key = 'test:expire';
      await cache.set(key, 'value');
      
      const result = await cache.expire(key, 60);
      expect(result).toBe(true);
      
      const ttl = await cache.ttl(key);
      expect(ttl).toBeGreaterThan(0);
    });

    it('should increment numeric value', async () => {
      const key = 'test:incr';
      
      const result1 = await cache.increment(key);
      expect(result1).toBe(1);
      
      const result2 = await cache.increment(key, 5);
      expect(result2).toBe(6);
    });

    it('should decrement numeric value', async () => {
      const key = 'test:decr';
      await cache.set(key, 10);
      
      const result1 = await cache.decrement(key);
      expect(result1).toBe(9);
      
      const result2 = await cache.decrement(key, 3);
      expect(result2).toBe(6);
    });
  });

  describe('Cache Statistics', () => {
    it('should get cache statistics', async () => {
      await cache.set('test:stats:1', 'value1');
      await cache.set('test:stats:2', 'value2');
      
      const stats = await cache.getStats();
      
      expect(stats.keys).toBeGreaterThanOrEqual(2);
      expect(stats.memory).toBeDefined();
    });
  });

  describe('Session Storage', () => {
    it('should set and get session data', async () => {
      const sessionId = 'session:123';
      const sessionData = {
        userId: 'user-456',
        role: 'student',
        loginAt: new Date().toISOString(),
      };
      
      await sessionCache.set(sessionId, sessionData);
      const result = await sessionCache.get<typeof sessionData>(sessionId);
      
      expect(result).toEqual(sessionData);
    });

    it('should set session with custom TTL', async () => {
      const sessionId = 'session:ttl';
      const sessionData = { userId: 'user-789' };
      
      await sessionCache.set(sessionId, sessionData, 60);
      
      const exists = await sessionCache.exists(sessionId);
      expect(exists).toBe(true);
    });

    it('should delete session', async () => {
      const sessionId = 'session:delete';
      const sessionData = { userId: 'user-999' };
      
      await sessionCache.set(sessionId, sessionData);
      expect(await sessionCache.exists(sessionId)).toBe(true);
      
      await sessionCache.delete(sessionId);
      expect(await sessionCache.exists(sessionId)).toBe(false);
    });

    it('should extend session expiration', async () => {
      const sessionId = 'session:extend';
      const sessionData = { userId: 'user-111' };
      
      await sessionCache.set(sessionId, sessionData, 10);
      
      const result = await sessionCache.extend(sessionId, 60);
      expect(result).toBe(true);
    });

    it('should check if session exists', async () => {
      const sessionId = 'session:exists';
      
      expect(await sessionCache.exists(sessionId)).toBe(false);
      
      await sessionCache.set(sessionId, { userId: 'user-222' });
      expect(await sessionCache.exists(sessionId)).toBe(true);
    });

    it('should return null for non-existent session', async () => {
      const result = await sessionCache.get('session:nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully in get', async () => {
      const key = 'test:invalid:json';
      // Manually set invalid JSON
      await redis.set(key, 'not valid json {');
      
      const result = await cache.get(key);
      expect(result).toBeNull();
    });

    it('should handle empty mget', async () => {
      const results = await cache.mget([]);
      expect(results).toEqual([]);
    });

    it('should handle empty mset', async () => {
      await expect(cache.mset([])).resolves.not.toThrow();
    });

    it('should handle empty deleteMany', async () => {
      await expect(cache.deleteMany([])).resolves.not.toThrow();
    });
  });
});
