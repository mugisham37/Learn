/**
 * Optimized User Repository
 *
 * Example implementation of optimized repository pattern for users
 * Demonstrates query optimization, caching, and N+1 prevention
 * Requirements: 15.1 - Database query optimization
 */

import { eq, and, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';

import {
  users,
  userProfiles,
  User,
  UserProfile,
} from '../../../../infrastructure/database/schema/users.schema';
import {
  OptimizedBaseRepository,
  CursorPaginationOptions,
  PaginationResult,
  QueryOptions,
} from '../../../../shared/repositories/OptimizedBaseRepository';
import { logger } from '../../../../shared/utils/logger';

/**
 * User with profile data
 */
export interface UserWithProfile extends User {
  profile?: UserProfile;
}

/**
 * User search filters
 */
export interface UserSearchFilters {
  role?: 'student' | 'educator' | 'admin';
  emailVerified?: boolean;
  searchTerm?: string; // Search in email or full name
}

/**
 * Optimized user repository with advanced querying capabilities
 */
export class OptimizedUserRepository extends OptimizedBaseRepository<User> {
  protected table = users;
  protected primaryKey = 'id';

  constructor(db: NodePgDatabase<Record<string, never>>, redis: Redis) {
    super(db, redis, {
      enabled: true,
      ttl: 300, // 5 minutes
      keyPrefix: 'user',
    });
  }

  /**
   * Find user by email with caching
   */
  async findByEmail(email: string, options: QueryOptions = {}): Promise<User | null> {
    const cacheKey = `email:${email.toLowerCase()}`;
    const cacheConfig = { ...this.defaultCacheConfig, ...options.cache };

    // Check cache first
    if (cacheConfig.enabled && !options.skipCache) {
      const cached = await this.getFromCache(cacheKey, cacheConfig.keyPrefix);
      if (cached) {
        logger.debug('Cache hit for findByEmail', { email });
        return cached;
      }
    }

    // Query database with optimized index usage
    const startTime = Date.now();
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email.toLowerCase()),
          sql`deleted_at IS NULL` // Use partial index for active users
        )
      )
      .limit(1);

    const executionTime = Date.now() - startTime;

    if (executionTime > 50) {
      logger.warn('Slow email lookup query', { email, executionTime });
    }

    // Cache result
    if (user && cacheConfig.enabled) {
      await this.setCache(cacheKey, user, cacheConfig);
      // Also cache by ID for consistency
      await this.setCache(user.id, user, cacheConfig);
    }

    return user || null;
  }

  /**
   * Find user with profile using optimized join
   */
  async findByIdWithProfile(
    id: string,
    options: QueryOptions = {}
  ): Promise<UserWithProfile | null> {
    const cacheKey = `with_profile:${id}`;
    const cacheConfig = { ...this.defaultCacheConfig, ...options.cache };

    // Check cache first
    if (cacheConfig.enabled && !options.skipCache) {
      const cached = await this.getFromCache<UserWithProfile>(cacheKey, cacheConfig.keyPrefix);
      if (cached) {
        logger.debug('Cache hit for findByIdWithProfile', { id });
        return cached;
      }
    }

    // Optimized query using LEFT JOIN to avoid N+1
    const startTime = Date.now();
    const [result] = await this.db
      .select({
        // User fields
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
        emailVerified: users.emailVerified,
        verificationToken: users.verificationToken,
        passwordResetToken: users.passwordResetToken,
        passwordResetExpires: users.passwordResetExpires,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
        // Profile fields
        profileId: userProfiles.id,
        profileUserId: userProfiles.userId,
        fullName: userProfiles.fullName,
        bio: userProfiles.bio,
        avatarUrl: userProfiles.avatarUrl,
        timezone: userProfiles.timezone,
        language: userProfiles.language,
        notificationPreferences: userProfiles.notificationPreferences,
        privacySettings: userProfiles.privacySettings,
        profileCreatedAt: userProfiles.createdAt,
        profileUpdatedAt: userProfiles.updatedAt,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(eq(users.id, id), sql`users.deleted_at IS NULL`))
      .limit(1);

    const executionTime = Date.now() - startTime;

    if (executionTime > 50) {
      logger.warn('Slow user with profile query', { id, executionTime });
    }

    if (!result) return null;

    // Transform result to include profile as nested object
    const userWithProfile: UserWithProfile = {
      id: result.id,
      email: result.email,
      passwordHash: result.passwordHash,
      role: result.role,
      emailVerified: result.emailVerified,
      verificationToken: result.verificationToken,
      passwordResetToken: result.passwordResetToken,
      passwordResetExpires: result.passwordResetExpires,
      lastLogin: result.lastLogin,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      deletedAt: result.deletedAt,
    };

    // Add profile if exists
    if (result.profileId) {
      userWithProfile.profile = {
        id: result.profileId,
        userId: result.profileUserId!,
        fullName: result.fullName!,
        bio: result.bio,
        avatarUrl: result.avatarUrl,
        timezone: result.timezone!,
        language: result.language!,
        notificationPreferences: result.notificationPreferences!,
        privacySettings: result.privacySettings!,
        createdAt: result.profileCreatedAt!,
        updatedAt: result.profileUpdatedAt!,
      };
    }

    // Cache result
    if (cacheConfig.enabled) {
      await this.setCache(cacheKey, userWithProfile, cacheConfig);
    }

    return userWithProfile;
  }

  /**
   * Search users with filters and pagination
   */
  async searchUsers(
    filters: UserSearchFilters,
    paginationOptions: CursorPaginationOptions & QueryOptions = {
      limit: 20,
      orderBy: 'createdAt',
      direction: 'desc',
    }
  ): Promise<PaginationResult<UserWithProfile>> {
    const conditions = [sql`users.deleted_at IS NULL`]; // Use partial index

    // Apply filters
    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters.emailVerified !== undefined) {
      conditions.push(eq(users.emailVerified, filters.emailVerified));
    }

    if (filters.searchTerm) {
      const searchTerm = `%${filters.searchTerm.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(users.email) LIKE ${searchTerm} OR LOWER(user_profiles.full_name) LIKE ${searchTerm})`
      );
    }

    // Build cursor condition
    const { cursor, limit, orderBy, direction } = paginationOptions;
    if (cursor) {
      const cursorValue = this.parseCursor(cursor);
      const cursorCondition =
        direction === 'asc'
          ? sql`users.${sql.identifier(orderBy)} > ${cursorValue}`
          : sql`users.${sql.identifier(orderBy)} < ${cursorValue}`;
      conditions.push(cursorCondition);
    }

    // Execute optimized query with JOIN
    const startTime = Date.now();
    const orderDirection = direction === 'asc' ? sql`ASC` : sql`DESC`;

    const results = await this.db.execute(sql`
      SELECT 
        users.*,
        user_profiles.id as profile_id,
        user_profiles.full_name,
        user_profiles.bio,
        user_profiles.avatar_url,
        user_profiles.timezone,
        user_profiles.language,
        user_profiles.notification_preferences,
        user_profiles.privacy_settings,
        user_profiles.created_at as profile_created_at,
        user_profiles.updated_at as profile_updated_at
      FROM users
      LEFT JOIN user_profiles ON users.id = user_profiles.user_id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY users.${sql.identifier(orderBy)} ${orderDirection}
      LIMIT ${limit + 1}
    `);

    const executionTime = Date.now() - startTime;

    if (executionTime > 100) {
      logger.warn('Slow user search query', {
        filters,
        executionTime,
        resultCount: results.rows?.length || 0,
      });
    }

    // Transform results
    const resultRows = results.rows || [];
    const items: UserWithProfile[] = resultRows.slice(0, limit).map((row: Record<string, unknown>) => {
      const user: UserWithProfile = {
        id: String(row['id']),
        email: String(row['email']),
        passwordHash: String(row['password_hash']),
        role: String(row['role']) as 'student' | 'educator' | 'admin',
        emailVerified: Boolean(row['email_verified']),
        verificationToken: row['verification_token'] ? String(row['verification_token']) : null,
        passwordResetToken: row['password_reset_token'] ? String(row['password_reset_token']) : null,
        passwordResetExpires: row['password_reset_expires'] ? new Date(String(row['password_reset_expires'])) : null,
        lastLogin: row['last_login'] ? new Date(String(row['last_login'])) : null,
        createdAt: new Date(String(row['created_at'])),
        updatedAt: new Date(String(row['updated_at'])),
        deletedAt: row['deleted_at'] ? new Date(String(row['deleted_at'])) : null,
      };

      if (row['profile_id']) {
        user.profile = {
          id: String(row['profile_id']),
          userId: String(row['id']),
          fullName: String(row['full_name']),
          bio: row['bio'] ? String(row['bio']) : null,
          avatarUrl: row['avatar_url'] ? String(row['avatar_url']) : null,
          timezone: String(row['timezone']),
          language: String(row['language']),
          notificationPreferences: row['notification_preferences'] as Record<string, unknown> || {},
          privacySettings: row['privacy_settings'] as Record<string, unknown> || {},
          createdAt: new Date(String(row['profile_created_at'])),
          updatedAt: new Date(String(row['profile_updated_at'])),
        };
      }

      return user;
    });

    // Determine pagination info
    const hasMore = resultRows.length > limit;
    const nextCursor =
      hasMore && items.length > 0
        ? this.generateCursor(items[items.length - 1]!, orderBy)
        : undefined;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get users by role with caching
   */
  async findByRole(
    role: 'student' | 'educator' | 'admin',
    options: CursorPaginationOptions & QueryOptions = {
      limit: 50,
      orderBy: 'createdAt',
      direction: 'desc',
    }
  ): Promise<PaginationResult<User>> {
    // Use role index for efficient filtering
    const conditions = [eq(users.role, role), sql`deleted_at IS NULL`];

    return this.findWithCursorPagination(conditions, options);
  }

  /**
   * Get recently active users
   */
  async findRecentlyActive(
    daysSince: number = 30,
    options: CursorPaginationOptions & QueryOptions = {
      limit: 20,
      orderBy: 'lastLogin',
      direction: 'desc',
    }
  ): Promise<PaginationResult<User>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSince);

    const conditions = [sql`last_login >= ${cutoffDate}`, sql`deleted_at IS NULL`];

    return this.findWithCursorPagination(conditions, options);
  }

  /**
   * Batch load users by IDs (for N+1 prevention)
   */
  async batchLoadUsers(userIds: string[]): Promise<Map<string, User>> {
    const users = await this.findByIds(userIds);
    const userMap = new Map<string, User>();

    users.forEach((user) => {
      userMap.set(user.id, user);
    });

    return userMap;
  }

  /**
   * Invalidate related caches when user data changes
   */
  protected async invalidateRelatedCaches(user: User): Promise<void> {
    // Invalidate user-specific caches
    await this.invalidateCache(user.id);
    await this.invalidateCache(`email:${user.email.toLowerCase()}`);
    await this.invalidateCache(`with_profile:${user.id}`);

    // Invalidate role-based caches
    await this.invalidateCachePattern(`role:${user.role}:*`);

    // Invalidate search caches (this could be more sophisticated)
    await this.invalidateCachePattern('search:*');

    logger.debug('Invalidated user-related caches', { userId: user.id, email: user.email });
  }

  /**
   * Get user statistics for monitoring
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    usersByRole: Record<string, number>;
    recentSignups: number;
    verifiedUsers: number;
  }> {
    const cacheKey = 'stats:users';
    const cached = await this.getFromCache(cacheKey, 'stats');

    if (cached) {
      return cached as unknown as {
        totalUsers: number;
        usersByRole: Record<string, number>;
        recentSignups: number;
        verifiedUsers: number;
      };
    }

    // Use optimized queries with indexes
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`deleted_at IS NULL`);

    const roleResults = await this.db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(sql`deleted_at IS NULL`)
      .groupBy(users.role);

    const [verifiedResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.emailVerified, true), sql`deleted_at IS NULL`));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [recentResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(sql`created_at >= ${weekAgo}`, sql`deleted_at IS NULL`));

    const stats = {
      totalUsers: totalResult?.count || 0,
      usersByRole: roleResults.reduce(
        (acc, { role, count }) => {
          acc[role] = count;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentSignups: recentResult?.count || 0,
      verifiedUsers: verifiedResult?.count || 0,
    };

    // Cache for 5 minutes
    await this.setCache(cacheKey, stats, {
      enabled: true,
      ttl: 300,
      keyPrefix: 'stats',
    });

    return stats;
  }
}
