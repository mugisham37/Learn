/**
 * Authentication Service Interface
 * 
 * Defines the contract for authentication operations including registration,
 * login, token management, email verification, and password reset.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { User } from '../../domain/entities/User.js';

/**
 * Registration data transfer object
 */
export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'educator' | 'admin';
}

/**
 * Registration result
 */
export interface RegisterResult {
  user: User;
  verificationToken: string;
}

/**
 * Login result with tokens
 */
export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Token refresh result
 */
export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication Service Interface
 * 
 * Provides methods for all authentication operations with proper validation,
 * error handling, and security measures.
 */
export interface IAuthService {
  /**
   * Registers a new user with email uniqueness check and password hashing
   * 
   * @param data - Registration data
   * @returns User entity and verification token
   * @throws ConflictError if email already exists
   * @throws ValidationError if data is invalid
   * @throws DatabaseError if database operation fails
   */
  register(data: RegisterDTO): Promise<RegisterResult>;

  /**
   * Authenticates a user with credential verification and token generation
   * 
   * @param email - User email
   * @param password - User password
   * @returns User entity and token pair
   * @throws AuthenticationError if credentials are invalid
   * @throws AuthenticationError if email is not verified
   * @throws DatabaseError if database operation fails
   */
  login(email: string, password: string): Promise<LoginResult>;

  /**
   * Refreshes access token using a valid refresh token
   * 
   * @param refreshToken - Valid refresh token
   * @returns New token pair
   * @throws AuthenticationError if refresh token is invalid or expired
   * @throws AuthenticationError if refresh token not found in Redis
   * @throws DatabaseError if database operation fails
   */
  refreshToken(refreshToken: string): Promise<RefreshTokenResult>;

  /**
   * Logs out a user by deleting their refresh token from Redis
   * 
   * @param userId - User ID
   * @param refreshToken - Refresh token to invalidate
   * @returns void
   * @throws AuthenticationError if token is invalid
   */
  logout(userId: string, refreshToken: string): Promise<void>;

  /**
   * Verifies a user's email using verification token
   * 
   * @param token - Email verification token
   * @returns Verified user entity
   * @throws AuthenticationError if token is invalid or expired
   * @throws NotFoundError if user not found
   * @throws DatabaseError if database operation fails
   */
  verifyEmail(token: string): Promise<User>;

  /**
   * Initiates password reset by generating token and sending email
   * 
   * @param email - User email
   * @returns void (always succeeds to prevent email enumeration)
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Resets user password using reset token
   * 
   * @param token - Password reset token
   * @param newPassword - New password
   * @returns void
   * @throws AuthenticationError if token is invalid or expired
   * @throws ValidationError if password doesn't meet requirements
   * @throws NotFoundError if user not found
   * @throws DatabaseError if database operation fails
   */
  resetPassword(token: string, newPassword: string): Promise<void>;
}
