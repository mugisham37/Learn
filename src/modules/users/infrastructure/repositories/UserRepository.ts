/**
 * User Repository Implementation
 * 
 * Implements user data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 1.1, 1.2
 */

import { eq, and, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { users, User, NewUser } from '../../../../infrastructure/database/schema/users.schema.js';
import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/index.js';
import {
  IUserRepository,
  CreateUserDTO,
  UpdateUserDTO,
} from './IUserRepository.js';

/**
 * User Repository Implementation
 * 
 * Provides data access methods for user entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 */
export class UserRepository implements IUserRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for user by ID
   */
  private getUserCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.USER, 'id', id);
  }

  /**
   * Builds cache key for user by email
   */
  private getUserEmailCacheKey(email: string): string {
    return buildCacheKey(CachePrefix.USER, 'email', email.toLowerCase());
  }

  /**
   * Builds cache key for user by verification token
   */
  private getUserVerificationTokenCacheKey(token: string): string {
    return buildCacheKey(CachePrefix.USER, 'verification', token);
  }

  /**
   * Builds cache key for user by password reset token
   */
  private getUserPasswordResetTokenCacheKey(token: string): string {
    return buildCacheKey(CachePrefix.USER, 'reset', token);
  }

  /**
   * Creates a new user in the database
   * 
   * Validates email uniqueness before insertion.
   * Does not cache on creation as the user will be fetched immediately after.
   * 
   * @param data - User creation data
   * @returns The created user
   * @throws ConflictError if email already exists
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateUserDTO): Promise<User> {
    try {
      // Check for existing user with same email
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError(
          'A user with this email already exists',
          'email'
        );
      }

      // Prepare user data for insertion
      const newUser: NewUser = {
        email: data.email.toLowerCase(), // Normalize email to lowercase
        passwordHash: data.passwordHash,
        role: data.role,
        emailVerified: data.emailVerified ?? false,
        verificationToken: data.verificationToken,
      };

      // Insert user into database
      const [createdUser] = await this.writeDb
        .insert(users)
        .values(newUser)
        .returning();

      if (!createdUser) {
        throw new DatabaseError(
          'Failed to create user',
          'insert'
        );
      }

      return createdUser;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'A user with this email already exists',
            'email'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create user',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a user by their unique ID
   * 
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   * 
   * @param id - User ID
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<User | null> {
    try {
      // Check cache first
      const cacheKey = this.getUserCacheKey(id);
      const cachedUser = await cache.get<User>(cacheKey);
      
      if (cachedUser) {
        return cachedUser;
      }

      // Query database if not in cache
      const [user] = await this.readDb
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            isNull(users.deletedAt) // Exclude soft-deleted users
          )
        )
        .limit(1);

      if (!user) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, user, CacheTTL.MEDIUM);

      return user;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find user by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a user by their email address
   * 
   * Implements caching with 5-minute TTL.
   * Email is normalized to lowercase for case-insensitive matching.
   * 
   * @param email - User email
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Check cache first
      const cacheKey = this.getUserEmailCacheKey(normalizedEmail);
      const cachedUser = await cache.get<User>(cacheKey);
      
      if (cachedUser) {
        return cachedUser;
      }

      // Query database if not in cache
      const [user] = await this.readDb
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, normalizedEmail),
            isNull(users.deletedAt) // Exclude soft-deleted users
          )
        )
        .limit(1);

      if (!user) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both email and ID for consistency
      await Promise.all([
        cache.set(cacheKey, user, CacheTTL.MEDIUM),
        cache.set(this.getUserCacheKey(user.id), user, CacheTTL.MEDIUM),
      ]);

      return user;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find user by email',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a user by verification token
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param token - Verification token
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByVerificationToken(token: string): Promise<User | null> {
    try {
      // Check cache first
      const cacheKey = this.getUserVerificationTokenCacheKey(token);
      const cachedUser = await cache.get<User>(cacheKey);
      
      if (cachedUser) {
        return cachedUser;
      }

      // Query database if not in cache
      const [user] = await this.readDb
        .select()
        .from(users)
        .where(
          and(
            eq(users.verificationToken, token),
            isNull(users.deletedAt) // Exclude soft-deleted users
          )
        )
        .limit(1);

      if (!user) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, user, CacheTTL.MEDIUM);

      return user;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find user by verification token',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a user by password reset token
   * 
   * Implements caching with 5-minute TTL.
   * Only returns user if reset token hasn't expired.
   * 
   * @param token - Password reset token
   * @returns The user if found and token is valid, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    try {
      // Check cache first
      const cacheKey = this.getUserPasswordResetTokenCacheKey(token);
      const cachedUser = await cache.get<User>(cacheKey);
      
      if (cachedUser) {
        // Verify token hasn't expired
        if (cachedUser.passwordResetExpires && cachedUser.passwordResetExpires > new Date()) {
          return cachedUser;
        }
        // Token expired, invalidate cache
        await cache.delete(cacheKey);
        return null;
      }

      // Query database if not in cache
      const [user] = await this.readDb
        .select()
        .from(users)
        .where(
          and(
            eq(users.passwordResetToken, token),
            isNull(users.deletedAt) // Exclude soft-deleted users
          )
        )
        .limit(1);

      if (!user) {
        return null;
      }

      // Check if token has expired
      if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, user, CacheTTL.MEDIUM);

      return user;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find user by password reset token',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a user's data
   * 
   * Invalidates all related cache entries after successful update.
   * Validates email uniqueness if email is being changed.
   * 
   * @param id - User ID
   * @param data - Update data
   * @returns The updated user
   * @throws NotFoundError if user doesn't exist
   * @throws ConflictError if email update conflicts with existing user
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateUserDTO): Promise<User> {
    try {
      // First, verify user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // If email is being updated, check for conflicts
      if (data.email && data.email.toLowerCase() !== existingUser.email) {
        const emailConflict = await this.findByEmail(data.email);
        if (emailConflict && emailConflict.id !== id) {
          throw new ConflictError(
            'A user with this email already exists',
            'email'
          );
        }
      }

      // Prepare update data
      const updateData: Partial<NewUser> = {
        ...data,
        email: data.email ? data.email.toLowerCase() : undefined,
        updatedAt: new Date(),
      };

      // Update user in database
      const [updatedUser] = await this.writeDb
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        throw new DatabaseError(
          'Failed to update user',
          'update'
        );
      }

      // Invalidate all cache entries for this user
      await this.invalidateCache(id);
      if (existingUser.email) {
        await this.invalidateCacheByEmail(existingUser.email);
      }
      if (data.email && data.email !== existingUser.email) {
        await this.invalidateCacheByEmail(data.email);
      }

      return updatedUser;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'A user with this email already exists',
            'email'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update user',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft deletes a user by setting deletedAt timestamp
   * 
   * Invalidates all cache entries after successful deletion.
   * Soft-deleted users are excluded from all queries.
   * 
   * @param id - User ID
   * @returns void
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async softDelete(id: string): Promise<void> {
    try {
      // Verify user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Set deletedAt timestamp
      const [deletedUser] = await this.writeDb
        .update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!deletedUser) {
        throw new DatabaseError(
          'Failed to soft delete user',
          'update'
        );
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      if (existingUser.email) {
        await this.invalidateCacheByEmail(existingUser.email);
      }
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to soft delete user',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Permanently deletes a user from the database
   * USE WITH CAUTION - This is irreversible
   * 
   * Invalidates all cache entries after successful deletion.
   * 
   * @param id - User ID
   * @returns void
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async hardDelete(id: string): Promise<void> {
    try {
      // Get user before deletion for cache invalidation
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User', id);
      }

      // Permanently delete user
      const result = await this.writeDb
        .delete(users)
        .where(eq(users.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to hard delete user',
          'delete'
        );
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      if (existingUser.email) {
        await this.invalidateCacheByEmail(existingUser.email);
      }
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to hard delete user',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a user with the given email exists
   * 
   * More efficient than findByEmail when only existence check is needed.
   * 
   * @param email - User email
   * @returns True if user exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async existsByEmail(email: string): Promise<boolean> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Try to find user by email
      const user = await this.findByEmail(normalizedEmail);
      
      return user !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check user existence by email',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific user
   * 
   * Removes all cache entries related to the user by ID.
   * Should be called after any update operation.
   * 
   * @param id - User ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getUserCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for user ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for a user by email
   * 
   * Removes all cache entries related to the user by email.
   * Should be called after operations that affect email lookups.
   * 
   * @param email - User email
   * @returns void
   */
  async invalidateCacheByEmail(email: string): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase();
      const cacheKey = this.getUserEmailCacheKey(normalizedEmail);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for user email ${email}:`, error);
    }
  }
}
