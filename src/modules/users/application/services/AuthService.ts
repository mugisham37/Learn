/**
 * Authentication Service Implementation
 * 
 * Implements authentication operations including registration with email uniqueness check,
 * login with credential verification, token management with Redis, email verification,
 * and password reset functionality.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import * as crypto from 'crypto';

import { buildCacheKey, CachePrefix, CacheTTL, sessionCache } from '../../../../infrastructure/cache/index.js';
import { AuthenticationError, ConflictError, ValidationError } from '../../../../shared/errors/index.js';
import { decodeToken, generateTokenPair, generateVerificationToken, hashPassword, verifyPassword, verifyToken } from '../../../../shared/utils/auth.js';
import { User } from '../../domain/entities/User.js';
import { Email } from '../../domain/value-objects/Email.js';
import { Password } from '../../domain/value-objects/Password.js';
import { IUserRepository } from '../../infrastructure/repositories/IUserRepository.js';

import { IAuthService, LoginResult, RefreshTokenResult, RegisterDTO, RegisterResult } from './IAuthService.js';

/**
 * Authentication Service Implementation
 * 
 * Provides comprehensive authentication functionality with:
 * - Email uniqueness validation
 * - Password strength validation and hashing
 * - JWT token generation and validation
 * - Redis-based refresh token storage
 * - Email verification workflow
 * - Password reset workflow
 */
export class AuthService implements IAuthService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Registers a new user with email uniqueness check and password hashing
   * 
   * Workflow:
   * 1. Validate email format using Email value object
   * 2. Check email uniqueness in database
   * 3. Validate password strength using Password value object
   * 4. Hash password with bcrypt (cost factor 12)
   * 5. Generate unique verification token
   * 6. Create user in database
   * 7. Return user and verification token
   * 
   * @param data - Registration data
   * @returns User entity and verification token
   * @throws ConflictError if email already exists
   * @throws ValidationError if data is invalid
   * @throws DatabaseError if database operation fails
   */
  async register(data: RegisterDTO): Promise<RegisterResult> {
    // Validate email format
    let email: Email;
    try {
      email = Email.create(data.email);
    } catch (error) {
      throw new ValidationError(
        'Invalid email format',
        [{ field: 'email', message: error instanceof Error ? error.message : 'Invalid email' }]
      );
    }

    // Check email uniqueness
    const existingUser = await this.userRepository.findByEmail(email.value);
    if (existingUser) {
      throw new ConflictError('A user with this email already exists', 'email');
    }

    // Validate password strength
    let password: Password;
    try {
      password = Password.create(data.password);
    } catch (error) {
      throw new ValidationError(
        'Password does not meet strength requirements',
        [{ field: 'password', message: error instanceof Error ? error.message : 'Invalid password' }]
      );
    }

    // Validate role
    const validRoles: Array<'student' | 'educator' | 'admin'> = ['student', 'educator', 'admin'];
    if (!validRoles.includes(data.role)) {
      throw new ValidationError(
        'Invalid role',
        [{ field: 'role', message: `Role must be one of: ${validRoles.join(', ')}` }]
      );
    }

    // Validate full name
    if (!data.fullName || data.fullName.trim().length === 0) {
      throw new ValidationError(
        'Full name is required',
        [{ field: 'fullName', message: 'Full name cannot be empty' }]
      );
    }

    if (data.fullName.trim().length < 2) {
      throw new ValidationError(
        'Full name is too short',
        [{ field: 'fullName', message: 'Full name must be at least 2 characters' }]
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password.value);

    // Generate unique verification token
    const verificationToken = generateVerificationToken();

    // Create user in database
    const createdUser = await this.userRepository.create({
      email: email.value,
      passwordHash,
      role: data.role,
      emailVerified: false,
      verificationToken,
    });

    // Create User domain entity
    const userEntity = User.fromPersistence({
      id: createdUser.id,
      email: Email.create(createdUser.email),
      passwordHash: createdUser.passwordHash,
      role: createdUser.role,
      emailVerified: createdUser.emailVerified,
      verificationToken: createdUser.verificationToken ?? undefined,
      passwordResetToken: createdUser.passwordResetToken ?? undefined,
      passwordResetExpires: createdUser.passwordResetExpires ?? undefined,
      lastLogin: createdUser.lastLogin ?? undefined,
      createdAt: createdUser.createdAt,
      updatedAt: createdUser.updatedAt,
      deletedAt: createdUser.deletedAt ?? undefined,
    });

    return {
      user: userEntity,
      verificationToken,
    };
  }

  /**
   * Authenticates a user with credential verification and token generation
   * 
   * Workflow:
   * 1. Find user by email
   * 2. Verify user exists and is not deleted
   * 3. Check email is verified
   * 4. Verify password against hash
   * 5. Generate access token (15 min expiry)
   * 6. Generate refresh token (30 day expiry)
   * 7. Store refresh token in Redis with automatic expiration
   * 8. Update last login timestamp
   * 9. Return user and tokens
   * 
   * @param email - User email
   * @param password - User password
   * @returns User entity and token pair
   * @throws AuthenticationError if credentials are invalid
   * @throws AuthenticationError if email is not verified
   * @throws DatabaseError if database operation fails
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if user is deleted
    if (user.deletedAt) {
      throw new AuthenticationError('Account has been deleted');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new AuthenticationError('Email not verified. Please verify your email before logging in.');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.role
    );

    // Store refresh token in Redis with 30-day expiration
    const refreshTokenKey = this.buildRefreshTokenKey(user.id, refreshToken);
    await sessionCache.set(
      refreshTokenKey,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      },
      CacheTTL.SESSION
    );

    // Update last login timestamp
    await this.userRepository.update(user.id, {
      lastLogin: new Date(),
    });

    // Create User domain entity
    const userEntity = User.fromPersistence({
      id: user.id,
      email: Email.create(user.email),
      passwordHash: user.passwordHash,
      role: user.role,
      emailVerified: user.emailVerified,
      verificationToken: user.verificationToken ?? undefined,
      passwordResetToken: user.passwordResetToken ?? undefined,
      passwordResetExpires: user.passwordResetExpires ?? undefined,
      lastLogin: user.lastLogin ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt ?? undefined,
    });

    return {
      user: userEntity,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refreshes access token using a valid refresh token
   * 
   * Workflow:
   * 1. Verify refresh token signature and expiration
   * 2. Extract user ID from token payload
   * 3. Validate refresh token exists in Redis
   * 4. Verify user still exists and is active
   * 5. Generate new token pair
   * 6. Delete old refresh token from Redis
   * 7. Store new refresh token in Redis
   * 8. Return new tokens
   * 
   * @param refreshToken - Valid refresh token
   * @returns New token pair
   * @throws AuthenticationError if refresh token is invalid or expired
   * @throws AuthenticationError if refresh token not found in Redis
   * @throws DatabaseError if database operation fails
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResult> {
    // Verify token signature and expiration
    let tokenData;
    try {
      tokenData = verifyToken(refreshToken);
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (tokenData.expired) {
      throw new AuthenticationError('Refresh token has expired');
    }

    // Verify token type
    if (tokenData.payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid token type. Expected refresh token.');
    }

    const { userId } = tokenData.payload;

    // Validate refresh token exists in Redis
    const refreshTokenKey = this.buildRefreshTokenKey(userId, refreshToken);
    const storedToken = await sessionCache.get(refreshTokenKey);

    if (!storedToken) {
      throw new AuthenticationError('Refresh token not found or has been revoked');
    }

    // Verify user still exists and is active
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.deletedAt) {
      throw new AuthenticationError('Account has been deleted');
    }

    if (!user.emailVerified) {
      throw new AuthenticationError('Email not verified');
    }

    // Generate new token pair
    const newTokens = generateTokenPair(user.id, user.email, user.role);

    // Delete old refresh token from Redis
    await sessionCache.delete(refreshTokenKey);

    // Store new refresh token in Redis
    const newRefreshTokenKey = this.buildRefreshTokenKey(user.id, newTokens.refreshToken);
    await sessionCache.set(
      newRefreshTokenKey,
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        createdAt: new Date().toISOString(),
      },
      CacheTTL.SESSION
    );

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  /**
   * Logs out a user by deleting their refresh token from Redis
   * 
   * Workflow:
   * 1. Verify refresh token signature
   * 2. Extract user ID from token
   * 3. Verify user ID matches provided user ID
   * 4. Delete refresh token from Redis
   * 
   * @param userId - User ID
   * @param refreshToken - Refresh token to invalidate
   * @returns void
   * @throws AuthenticationError if token is invalid
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    // Verify token signature (don't check expiration for logout)
    let tokenData;
    try {
      tokenData = decodeToken(refreshToken);
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Verify user ID matches
    if (tokenData.userId !== userId) {
      throw new AuthenticationError('Token does not belong to this user');
    }

    // Delete refresh token from Redis
    const refreshTokenKey = this.buildRefreshTokenKey(userId, refreshToken);
    await sessionCache.delete(refreshTokenKey);
  }

  /**
   * Verifies a user's email using verification token
   * 
   * Workflow:
   * 1. Find user by verification token
   * 2. Verify user exists
   * 3. Check email is not already verified
   * 4. Mark email as verified
   * 5. Clear verification token
   * 6. Update user in database
   * 7. Return verified user
   * 
   * @param token - Email verification token
   * @returns Verified user entity
   * @throws AuthenticationError if token is invalid or expired
   * @throws NotFoundError if user not found
   * @throws DatabaseError if database operation fails
   */
  async verifyEmail(token: string): Promise<User> {
    // Find user by verification token
    const user = await this.userRepository.findByVerificationToken(token);

    if (!user) {
      throw new AuthenticationError('Invalid or expired verification token');
    }

    // Check if email is already verified
    if (user.emailVerified) {
      throw new AuthenticationError('Email is already verified');
    }

    // Update user: mark email as verified and clear verification token
    const updatedUser = await this.userRepository.update(user.id, {
      emailVerified: true,
      verificationToken: undefined,
    });

    // Create User domain entity
    const userEntity = User.fromPersistence({
      id: updatedUser.id,
      email: Email.create(updatedUser.email),
      passwordHash: updatedUser.passwordHash,
      role: updatedUser.role,
      emailVerified: updatedUser.emailVerified,
      verificationToken: updatedUser.verificationToken ?? undefined,
      passwordResetToken: updatedUser.passwordResetToken ?? undefined,
      passwordResetExpires: updatedUser.passwordResetExpires ?? undefined,
      lastLogin: updatedUser.lastLogin ?? undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      deletedAt: updatedUser.deletedAt ?? undefined,
    });

    return userEntity;
  }

  /**
   * Initiates password reset by generating token and sending email
   * 
   * Workflow:
   * 1. Find user by email
   * 2. If user doesn't exist, return silently (prevent email enumeration)
   * 3. Generate password reset token
   * 4. Set token expiration (1 hour from now)
   * 5. Update user with reset token and expiration
   * 6. Send password reset email (TODO: implement email sending)
   * 7. Return silently
   * 
   * Note: Always succeeds to prevent email enumeration attacks
   * 
   * @param email - User email
   * @returns void (always succeeds to prevent email enumeration)
   */
  async requestPasswordReset(email: string): Promise<void> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email);

    // If user doesn't exist, return silently to prevent email enumeration
    if (!user) {
      return;
    }

    // Don't allow password reset for deleted accounts
    if (user.deletedAt) {
      return;
    }

    // Generate password reset token
    const resetToken = generateVerificationToken();

    // Set token expiration (1 hour from now)
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    // Update user with reset token and expiration
    await this.userRepository.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    // TODO: Send password reset email
    // This would typically be handled by a notification service
    // For now, we just store the token in the database
    // In production, you would:
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Resets user password using reset token
   * 
   * Workflow:
   * 1. Find user by password reset token
   * 2. Verify user exists
   * 3. Check token hasn't expired
   * 4. Validate new password strength
   * 5. Hash new password
   * 6. Update user with new password hash
   * 7. Clear reset token and expiration
   * 8. Invalidate all existing refresh tokens for this user
   * 
   * @param token - Password reset token
   * @param newPassword - New password
   * @returns void
   * @throws AuthenticationError if token is invalid or expired
   * @throws ValidationError if password doesn't meet requirements
   * @throws NotFoundError if user not found
   * @throws DatabaseError if database operation fails
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find user by password reset token
    const user = await this.userRepository.findByPasswordResetToken(token);

    if (!user) {
      throw new AuthenticationError('Invalid or expired password reset token');
    }

    // Check if token has expired (this is also checked in repository, but double-check here)
    if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
      throw new AuthenticationError('Password reset token has expired');
    }

    // Validate new password strength
    let password: Password;
    try {
      password = Password.create(newPassword);
    } catch (error) {
      throw new ValidationError(
        'Password does not meet strength requirements',
        [{ field: 'password', message: error instanceof Error ? error.message : 'Invalid password' }]
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password.value);

    // Update user with new password hash and clear reset token
    await this.userRepository.update(user.id, {
      passwordHash,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });

    // Invalidate all existing refresh tokens for this user
    // This forces the user to log in again with the new password
    await this.invalidateAllUserTokens(user.id);
  }

  /**
   * Builds Redis key for refresh token storage
   * 
   * @param userId - User ID
   * @param refreshToken - Refresh token
   * @returns Redis key
   */
  private buildRefreshTokenKey(userId: string, refreshToken: string): string {
    // Use a hash of the token to avoid storing the full token in the key
    // This provides an additional layer of security
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex')
      .substring(0, 16);
    
    return buildCacheKey(CachePrefix.SESSION, 'refresh', userId, tokenHash);
  }

  /**
   * Invalidates all refresh tokens for a user
   * Used when password is changed or account is compromised
   * 
   * @param userId - User ID
   * @returns void
   */
  private async invalidateAllUserTokens(userId: string): Promise<void> {
    // Delete all refresh tokens for this user
    const pattern = buildCacheKey(CachePrefix.SESSION, 'refresh', userId, '*');
    
    // Use Redis SCAN to find and delete all matching keys
    // This is safe for production as it doesn't block the server
    const { redis } = await import('../../../../infrastructure/cache/index.js');
    
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
