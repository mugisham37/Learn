/**
 * User Repository Interface
 * 
 * Defines the contract for user data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 * 
 * Requirements: 1.1, 1.2
 */

import { User } from '../../../../infrastructure/database/schema/users.schema.js';

/**
 * Data Transfer Object for creating a new user
 */
export interface CreateUserDTO {
  email: string;
  passwordHash: string;
  role: 'student' | 'educator' | 'admin';
  emailVerified?: boolean;
  verificationToken?: string;
}

/**
 * Data Transfer Object for updating a user
 */
export interface UpdateUserDTO {
  email?: string;
  passwordHash?: string;
  role?: 'student' | 'educator' | 'admin';
  emailVerified?: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
}

/**
 * User Repository Interface
 * 
 * Provides methods for all user data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IUserRepository {
  /**
   * Creates a new user in the database
   * 
   * @param data - User creation data
   * @returns The created user
   * @throws ConflictError if email already exists
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateUserDTO): Promise<User>;

  /**
   * Finds a user by their unique ID
   * 
   * @param id - User ID
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<User | null>;

  /**
   * Finds a user by their email address
   * 
   * @param email - User email
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Finds a user by verification token
   * 
   * @param token - Verification token
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByVerificationToken(token: string): Promise<User | null>;

  /**
   * Finds a user by password reset token
   * 
   * @param token - Password reset token
   * @returns The user if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByPasswordResetToken(token: string): Promise<User | null>;

  /**
   * Updates a user's data
   * 
   * @param id - User ID
   * @param data - Update data
   * @returns The updated user
   * @throws NotFoundError if user doesn't exist
   * @throws ConflictError if email update conflicts with existing user
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateUserDTO): Promise<User>;

  /**
   * Soft deletes a user by setting deletedAt timestamp
   * 
   * @param id - User ID
   * @returns void
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if database operation fails
   */
  softDelete(id: string): Promise<void>;

  /**
   * Permanently deletes a user from the database
   * USE WITH CAUTION - This is irreversible
   * 
   * @param id - User ID
   * @returns void
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if database operation fails
   */
  hardDelete(id: string): Promise<void>;

  /**
   * Checks if a user with the given email exists
   * 
   * @param email - User email
   * @returns True if user exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  existsByEmail(email: string): Promise<boolean>;

  /**
   * Invalidates cache for a specific user
   * Should be called after any update operation
   * 
   * @param id - User ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for a user by email
   * Should be called after operations that affect email lookups
   * 
   * @param email - User email
   * @returns void
   */
  invalidateCacheByEmail(email: string): Promise<void>;
}
