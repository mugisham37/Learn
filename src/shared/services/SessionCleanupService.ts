/**
 * Session Cleanup Service
 * 
 * Handles cleanup of expired sessions, refresh tokens, and temporary data.
 * Runs daily to maintain database hygiene and security.
 * 
 * Requirements: 14.7 - Daily session cleanup
 */

import { logger } from '../utils/logger.js';
import { getRedisClient } from '../../infrastructure/cache/index.js';
import { db } from '../../infrastructure/database/index.js';
import { users } from '../../infrastructure/database/schema/users.schema.js';
import { sql } from 'drizzle-orm';

/**
 * Session cleanup configuration
 */
export interface SessionCleanupConfig {
  /** Maximum age for expired refresh tokens in days */
  expiredTokenRetentionDays: number;
  /** Maximum age for unverified user accounts in days */
  unverifiedAccountRetentionDays: number;
  /** Maximum age for password reset tokens in hours */
  passwordResetTokenRetentionHours: number;
  /** Batch size for cleanup operations */
  batchSize: number;
}

/**
 * Default cleanup configuration
 */
const DEFAULT_CONFIG: SessionCleanupConfig = {
  expiredTokenRetentionDays: 7,
  unverifiedAccountRetentionDays: 30,
  passwordResetTokenRetentionHours: 24,
  batchSize: 1000,
};

/**
 * Session Cleanup Service Implementation
 */
export class SessionCleanupService {
  private config: SessionCleanupConfig;

  constructor(config: Partial<SessionCleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute complete session cleanup
   */
  async executeCleanup(): Promise<{
    expiredTokensRemoved: number;
    unverifiedAccountsRemoved: number;
    passwordResetTokensRemoved: number;
    redisKeysRemoved: number;
  }> {
    const startTime = Date.now();
    logger.info('Starting session cleanup process', {
      config: this.config,
    });

    try {
      const results = {
        expiredTokensRemoved: 0,
        unverifiedAccountsRemoved: 0,
        passwordResetTokensRemoved: 0,
        redisKeysRemoved: 0,
      };

      // Clean up expired refresh tokens from Redis
      results.redisKeysRemoved = await this.cleanupExpiredRedisTokens();

      // Clean up unverified user accounts
      results.unverifiedAccountsRemoved = await this.cleanupUnverifiedAccounts();

      // Clean up expired password reset tokens
      results.passwordResetTokensRemoved = await this.cleanupPasswordResetTokens();

      const duration = Date.now() - startTime;
      logger.info('Session cleanup completed successfully', {
        results,
        durationMs: duration,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Session cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
      });
      throw error;
    }
  }

  /**
   * Clean up expired refresh tokens from Redis
   */
  private async cleanupExpiredRedisTokens(): Promise<number> {
    try {
      const redis = getRedisClient();
      let removedCount = 0;
      let cursor = '0';

      do {
        // Scan for refresh token keys
        const result = await redis.scan(cursor, 'MATCH', 'refresh_token:*', 'COUNT', this.config.batchSize);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          // Check TTL for each key and remove expired ones
          const pipeline = redis.pipeline();
          const keysToCheck = [];

          for (const key of keys) {
            keysToCheck.push(key);
            pipeline.ttl(key);
          }

          const ttlResults = await pipeline.exec();
          const expiredKeys = [];

          for (let i = 0; i < keysToCheck.length; i++) {
            const ttl = ttlResults?.[i]?.[1] as number;
            // TTL of -1 means no expiration, -2 means expired/doesn't exist
            if (ttl === -2) {
              expiredKeys.push(keysToCheck[i]);
            }
          }

          if (expiredKeys.length > 0) {
            await redis.del(...expiredKeys);
            removedCount += expiredKeys.length;
            logger.debug('Removed expired refresh tokens from Redis', {
              count: expiredKeys.length,
              keys: expiredKeys,
            });
          }
        }
      } while (cursor !== '0');

      logger.info('Redis token cleanup completed', {
        removedCount,
      });

      return removedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired Redis tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up unverified user accounts that are older than retention period
   */
  private async cleanupUnverifiedAccounts(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.unverifiedAccountRetentionDays);

      const result = await db
        .delete(users)
        .where(
          sql`${users.emailVerified} = false AND ${users.createdAt} < ${cutoffDate}`
        )
        .returning({ id: users.id });

      const removedCount = result.length;

      logger.info('Unverified accounts cleanup completed', {
        removedCount,
        cutoffDate: cutoffDate.toISOString(),
        retentionDays: this.config.unverifiedAccountRetentionDays,
      });

      return removedCount;
    } catch (error) {
      logger.error('Failed to cleanup unverified accounts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up expired password reset tokens
   */
  private async cleanupPasswordResetTokens(): Promise<number> {
    try {
      const redis = getRedisClient();
      let removedCount = 0;
      let cursor = '0';

      do {
        // Scan for password reset token keys
        const result = await redis.scan(cursor, 'MATCH', 'password_reset:*', 'COUNT', this.config.batchSize);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          // Check TTL for each key and remove expired ones
          const pipeline = redis.pipeline();
          const keysToCheck = [];

          for (const key of keys) {
            keysToCheck.push(key);
            pipeline.ttl(key);
          }

          const ttlResults = await pipeline.exec();
          const expiredKeys = [];

          for (let i = 0; i < keysToCheck.length; i++) {
            const ttl = ttlResults?.[i]?.[1] as number;
            // TTL of -2 means expired/doesn't exist
            if (ttl === -2) {
              expiredKeys.push(keysToCheck[i]);
            }
          }

          if (expiredKeys.length > 0) {
            await redis.del(...expiredKeys);
            removedCount += expiredKeys.length;
            logger.debug('Removed expired password reset tokens from Redis', {
              count: expiredKeys.length,
            });
          }
        }
      } while (cursor !== '0');

      logger.info('Password reset token cleanup completed', {
        removedCount,
      });

      return removedCount;
    } catch (error) {
      logger.error('Failed to cleanup password reset tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up specific user sessions (for user logout or account deletion)
   */
  async cleanupUserSessions(userId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      let removedCount = 0;
      let cursor = '0';

      do {
        // Scan for user-specific refresh token keys
        const result = await redis.scan(cursor, 'MATCH', `refresh_token:${userId}:*`, 'COUNT', this.config.batchSize);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          await redis.del(...keys);
          removedCount += keys.length;
        }
      } while (cursor !== '0');

      logger.info('User session cleanup completed', {
        userId,
        removedCount,
      });

      return removedCount;
    } catch (error) {
      logger.error('Failed to cleanup user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    totalRefreshTokens: number;
    totalPasswordResetTokens: number;
    unverifiedAccountsCount: number;
    oldestUnverifiedAccount: Date | null;
  }> {
    try {
      const redis = getRedisClient();
      const stats = {
        totalRefreshTokens: 0,
        totalPasswordResetTokens: 0,
        unverifiedAccountsCount: 0,
        oldestUnverifiedAccount: null as Date | null,
      };

      // Count refresh tokens
      let cursor = '0';
      do {
        const result = await redis.scan(cursor, 'MATCH', 'refresh_token:*', 'COUNT', this.config.batchSize);
        cursor = result[0];
        stats.totalRefreshTokens += result[1].length;
      } while (cursor !== '0');

      // Count password reset tokens
      cursor = '0';
      do {
        const result = await redis.scan(cursor, 'MATCH', 'password_reset:*', 'COUNT', this.config.batchSize);
        cursor = result[0];
        stats.totalPasswordResetTokens += result[1].length;
      } while (cursor !== '0');

      // Count unverified accounts
      const unverifiedResult = await db
        .select({
          count: sql<number>`count(*)`,
          oldestCreatedAt: sql<Date>`min(${users.createdAt})`,
        })
        .from(users)
        .where(sql`${users.emailVerified} = false`);

      if (unverifiedResult.length > 0) {
        stats.unverifiedAccountsCount = unverifiedResult[0].count;
        stats.oldestUnverifiedAccount = unverifiedResult[0].oldestCreatedAt;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get cleanup stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Health check for session cleanup service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test Redis connectivity
      const redis = getRedisClient();
      await redis.ping();

      // Test database connectivity
      await db.select({ count: sql<number>`1` }).from(users).limit(1);

      return true;
    } catch (error) {
      logger.error('Session cleanup service health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Singleton instance of SessionCleanupService
 */
let sessionCleanupServiceInstance: SessionCleanupService | null = null;

/**
 * Get the singleton SessionCleanupService instance
 */
export function getSessionCleanupService(): SessionCleanupService {
  if (!sessionCleanupServiceInstance) {
    sessionCleanupServiceInstance = new SessionCleanupService();
  }
  return sessionCleanupServiceInstance;
}

/**
 * Initialize session cleanup service with custom config
 */
export function initializeSessionCleanupService(config?: Partial<SessionCleanupConfig>): SessionCleanupService {
  sessionCleanupServiceInstance = new SessionCleanupService(config);
  return sessionCleanupServiceInstance;
}