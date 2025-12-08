/**
 * Database Connection Tests
 * 
 * Tests for database connection pooling, retry logic, transaction management,
 * and health checks.
 * 
 * Requirements: 15.7, 16.3
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  initializeDatabasePools,
  closeDatabaseConnection,
  getWritePool,
  getReadPool,
  getWriteDb,
  getReadDb,
  withTransaction,
  withDrizzleTransaction,
  checkDatabaseHealth,
  testDatabaseConnection,
} from './index.js';

describe('Database Connection and ORM', () => {
  describe('Connection Pool Initialization', () => {
    it('should initialize write and read pools successfully', async () => {
      await initializeDatabasePools();
      
      const writePool = getWritePool();
      const readPool = getReadPool();
      
      expect(writePool).toBeDefined();
      expect(readPool).toBeDefined();
      expect(writePool.totalCount).toBeGreaterThanOrEqual(0);
      expect(readPool.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should configure write pool with correct connection limits', async () => {
      const writePool = getWritePool();
      
      // Write pool should have min 5 connections
      expect(writePool.options.min).toBe(5);
      // Write pool should have max connections (60% of total)
      expect(writePool.options.max).toBeGreaterThanOrEqual(12);
    });

    it('should configure read pool with correct connection limits', async () => {
      const readPool = getReadPool();
      
      // Read pool should have min 5 connections
      expect(readPool.options.min).toBe(5);
      // Read pool should have max connections (40% of total)
      expect(readPool.options.max).toBeGreaterThanOrEqual(8);
    });

    it('should throw error when accessing pools before initialization', async () => {
      // Close pools first
      await closeDatabaseConnection();
      
      expect(() => getWritePool()).toThrow('Write pool not initialized');
      expect(() => getReadPool()).toThrow('Read pool not initialized');
      
      // Re-initialize for other tests
      await initializeDatabasePools();
    });
  });

  describe('Database Connectivity', () => {
    beforeAll(async () => {
      await initializeDatabasePools();
    });

    it('should successfully connect to write pool', async () => {
      const writePool = getWritePool();
      const client = await writePool.connect();
      
      try {
        const result = await client.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
      } finally {
        client.release();
      }
    });

    it('should successfully connect to read pool', async () => {
      const readPool = getReadPool();
      const client = await readPool.connect();
      
      try {
        const result = await client.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
      } finally {
        client.release();
      }
    });

    it('should test database connection successfully', async () => {
      const isConnected = await testDatabaseConnection();
      expect(isConnected).toBe(true);
    });
  });

  describe('Drizzle ORM Integration', () => {
    it('should provide Drizzle write database instance', () => {
      const writeDb = getWriteDb();
      expect(writeDb).toBeDefined();
      expect(typeof writeDb.select).toBe('function');
    });

    it('should provide Drizzle read database instance', () => {
      const readDb = getReadDb();
      expect(readDb).toBeDefined();
      expect(typeof readDb.select).toBe('function');
    });
  });

  describe('Transaction Management', () => {
    it('should execute transaction successfully and commit', async () => {
      const result = await withTransaction(async (client) => {
        const res = await client.query('SELECT 1 + 1 as sum');
        return res.rows[0].sum;
      });
      
      expect(result).toBe(2);
    });

    it('should rollback transaction on error', async () => {
      await expect(
        withTransaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should execute Drizzle transaction successfully', async () => {
      const result = await withDrizzleTransaction(async (tx) => {
        // Simple test - just return a value
        return 'success';
      });
      
      expect(result).toBe('success');
    });

    it('should rollback Drizzle transaction on error', async () => {
      await expect(
        withDrizzleTransaction(async (tx) => {
          throw new Error('Drizzle test error');
        })
      ).rejects.toThrow('Drizzle test error');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when pools are connected', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.writePool.connected).toBe(true);
      expect(health.readPool.connected).toBe(true);
      expect(health.latencyMs).toBeDefined();
      expect(health.latencyMs).toBeGreaterThan(0);
    });

    it('should include pool statistics in health check', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.writePool.totalConnections).toBeGreaterThanOrEqual(0);
      expect(health.writePool.idleConnections).toBeGreaterThanOrEqual(0);
      expect(health.writePool.waitingClients).toBeGreaterThanOrEqual(0);
      
      expect(health.readPool.totalConnections).toBeGreaterThanOrEqual(0);
      expect(health.readPool.idleConnections).toBeGreaterThanOrEqual(0);
      expect(health.readPool.waitingClients).toBeGreaterThanOrEqual(0);
    });

    it('should measure latency in health check', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.latencyMs).toBeDefined();
      expect(health.latencyMs).toBeGreaterThan(0);
      // Latency should be reasonable (less than 1 second for local DB)
      expect(health.latencyMs).toBeLessThan(1000);
    });
  });

  describe('Connection Pool Management', () => {
    it('should handle multiple concurrent connections', async () => {
      const writePool = getWritePool();
      const promises = [];
      
      // Create 10 concurrent connections
      for (let i = 0; i < 10; i++) {
        promises.push(
          (async () => {
            const client = await writePool.connect();
            try {
              const result = await client.query('SELECT $1::int as value', [i]);
              return result.rows[0].value;
            } finally {
              client.release();
            }
          })()
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should reuse idle connections from pool', async () => {
      const writePool = getWritePool();
      
      // Get initial idle count
      const initialIdleCount = writePool.idleCount;
      
      // Use a connection and release it
      const client = await writePool.connect();
      await client.query('SELECT 1');
      client.release();
      
      // Wait a bit for the connection to return to pool
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Idle count should be at least as high as before
      expect(writePool.idleCount).toBeGreaterThanOrEqual(initialIdleCount);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close all connection pools gracefully', async () => {
      await closeDatabaseConnection();
      
      // Pools should be null after closing
      expect(() => getWritePool()).toThrow('Write pool not initialized');
      expect(() => getReadPool()).toThrow('Read pool not initialized');
      
      // Re-initialize for cleanup
      await initializeDatabasePools();
    });
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });
});
