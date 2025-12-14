/**
 * User Profile Repository Implementation
 *
 * Implements user profile data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 10.7
 */

import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  userProfiles,
  UserProfile,
  NewUserProfile,
} from '../../../../infrastructure/database/schema/users.schema.js';
import { DatabaseError, ConflictError, NotFoundError } from '../../../../shared/errors/index.js';

import {
  IUserProfileRepository,
  CreateUserProfileDTO,
  UpdateUserProfileDTO,
} from './IUserProfileRepository.js';

/**
 * User Profile Repository Implementation
 *
 * Provides data access methods for user profile entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 */
export class UserProfileRepository implements IUserProfileRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for user profile by user ID
   */
  private getUserProfileCacheKey(userId: string): string {
    return buildCacheKey(CachePrefix.USER, 'profile', userId);
  }

  /**
   * Creates a new user profile in the database
   *
   * @param data - User profile creation data
   * @returns The created user profile
   * @throws ConflictError if profile already exists for user
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateUserProfileDTO): Promise<UserProfile> {
    try {
      // Check for existing profile
      const existingProfile = await this.findByUserId(data.userId);
      if (existingProfile) {
        throw new ConflictError('A profile already exists for this user', 'userId');
      }

      // Prepare profile data for insertion
      const newProfile: NewUserProfile = {
        userId: data.userId,
        fullName: data.fullName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        timezone: data.timezone || 'UTC',
        language: data.language || 'en',
        notificationPreferences: data.notificationPreferences || {},
        privacySettings: data.privacySettings || {},
      };

      // Insert profile into database
      const [createdProfile] = await this.writeDb
        .insert(userProfiles)
        .values(newProfile)
        .returning();

      if (!createdProfile) {
        throw new DatabaseError('Failed to create user profile', 'insert');
      }

      return createdProfile;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError('A profile already exists for this user', 'userId');
        }
        if (error.message.includes('foreign key')) {
          throw new ConflictError('User does not exist', 'userId');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create user profile',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a user profile by user ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param userId - User ID
   * @returns The user profile if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByUserId(userId: string): Promise<UserProfile | null> {
    try {
      // Check cache first
      const cacheKey = this.getUserProfileCacheKey(userId);
      const cachedProfile = await cache.get<UserProfile>(cacheKey);

      if (cachedProfile) {
        return cachedProfile;
      }

      // Query database if not in cache
      const [profile] = await this.readDb
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, profile, CacheTTL.MEDIUM);

      return profile;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find user profile by user ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a user profile's data
   *
   * Invalidates cache after successful update.
   *
   * @param userId - User ID
   * @param data - Update data
   * @returns The updated user profile
   * @throws NotFoundError if profile doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(userId: string, data: UpdateUserProfileDTO): Promise<UserProfile> {
    try {
      // First, verify profile exists
      const existingProfile = await this.findByUserId(userId);
      if (!existingProfile) {
        throw new NotFoundError('User profile', userId);
      }

      // Prepare update data
      const updateData: Partial<NewUserProfile> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update profile in database
      const [updatedProfile] = await this.writeDb
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.userId, userId))
        .returning();

      if (!updatedProfile) {
        throw new DatabaseError('Failed to update user profile', 'update');
      }

      // Invalidate cache
      await this.invalidateCache(userId);

      return updatedProfile;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update user profile',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a user profile
   *
   * Invalidates cache after successful deletion.
   *
   * @param userId - User ID
   * @returns void
   * @throws NotFoundError if profile doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(userId: string): Promise<void> {
    try {
      // Verify profile exists
      const existingProfile = await this.findByUserId(userId);
      if (!existingProfile) {
        throw new NotFoundError('User profile', userId);
      }

      // Delete profile
      const result = await this.writeDb
        .delete(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete user profile', 'delete');
      }

      // Invalidate cache
      await this.invalidateCache(userId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete user profile',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a user profile exists
   *
   * @param userId - User ID
   * @returns True if profile exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(userId: string): Promise<boolean> {
    try {
      const profile = await this.findByUserId(userId);
      return profile !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check user profile existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific user profile
   *
   * @param userId - User ID
   * @returns void
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getUserProfileCacheKey(userId);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for user profile ${userId}:`, error);
    }
  }
}
