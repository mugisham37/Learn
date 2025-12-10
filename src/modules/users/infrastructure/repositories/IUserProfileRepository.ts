/**
 * User Profile Repository Interface
 * 
 * Defines the contract for user profile data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 * 
 * Requirements: 10.7
 */

import { UserProfile } from '../../../../infrastructure/database/schema/users.schema.js';

/**
 * Data Transfer Object for creating a new user profile
 */
export interface CreateUserProfileDTO {
  userId: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  notificationPreferences?: Record<string, any>;
  privacySettings?: Record<string, any>;
}

/**
 * Data Transfer Object for updating a user profile
 */
export interface UpdateUserProfileDTO {
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  notificationPreferences?: Record<string, any>;
  privacySettings?: Record<string, any>;
}

/**
 * User Profile Repository Interface
 * 
 * Provides methods for all user profile data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IUserProfileRepository {
  /**
   * Creates a new user profile in the database
   * 
   * @param data - User profile creation data
   * @returns The created user profile
   * @throws ConflictError if profile already exists for user
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateUserProfileDTO): Promise<UserProfile>;

  /**
   * Finds a user profile by user ID
   * 
   * @param userId - User ID
   * @returns The user profile if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByUserId(userId: string): Promise<UserProfile | null>;

  /**
   * Updates a user profile's data
   * 
   * @param userId - User ID
   * @param data - Update data
   * @returns The updated user profile
   * @throws NotFoundError if profile doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(userId: string, data: UpdateUserProfileDTO): Promise<UserProfile>;

  /**
   * Deletes a user profile
   * 
   * @param userId - User ID
   * @returns void
   * @throws NotFoundError if profile doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(userId: string): Promise<void>;

  /**
   * Checks if a user profile exists
   * 
   * @param userId - User ID
   * @returns True if profile exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(userId: string): Promise<boolean>;

  /**
   * Invalidates cache for a specific user profile
   * Should be called after any update operation
   * 
   * @param userId - User ID
   * @returns void
   */
  invalidateCache(userId: string): Promise<void>;
}