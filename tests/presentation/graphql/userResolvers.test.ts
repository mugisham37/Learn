/**
 * GraphQL User Resolvers Tests
 * 
 * Tests for GraphQL resolvers covering authentication, authorization,
 * profile management, and error handling.
 * 
 * Requirements: 21.2, 21.3, 21.6, 21.7
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphQLError } from 'graphql';

import { userResolvers, type GraphQLContext } from '../../../src/modules/users/presentation/graphql/resolvers.js';
import { User } from '../../../src/modules/users/domain/entities/User.js';
import { Email } from '../../../src/modules/users/domain/value-objects/Email.js';
import { UserProfile } from '../../../src/modules/users/domain/value-objects/UserProfile.js';
import type { IAuthService } from '../../../src/modules/users/application/services/IAuthService.js';
import type { IUserProfileService } from '../../../src/modules/users/application/services/IUserProfileService.js';
import type { IUserRepository } from '../../../src/modules/users/infrastructure/repositories/IUserRepository.js';

// Mock services
const createMockAuthService = (): IAuthService => ({
  register: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  verifyEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
});

const createMockUserProfileService = (): IUserProfileService => ({
  getUserProfile: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  updateNotificationPreferences: vi.fn(),
});

const createMockUserRepository = (): IUserRepository => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByVerificationToken: vi.fn(),
  findByPasswordResetToken: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  hardDelete: vi.fn(),
  existsByEmail: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateCacheByEmail: vi.fn(),
});

describe('User GraphQL Resolvers', () => {
  let mockAuthService: IAuthService;
  let mockUserProfileService: IUserProfileService;
  let mockUserRepository: IUserRepository;
  let mockContext: GraphQLContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAuthService = createMockAuthService();
    mockUserProfileService = createMockUserProfileService();
    mockUserRepository = createMockUserRepository();
    
    mockContext = {
      authService: mockAuthService,
      userProfileService: mockUserProfileService,
      userRepository: mockUserRepository,
    };
  });

  describe('Query resolvers', () => {
    describe('me', () => {
      it('should return current user when authenticated', async () => {
        // Arrange
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          role: 'student',
          emailVerified: true,
          verificationToken: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLogin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

        // Act
        const result = await userResolvers.Query.me(null, {}, mockContext);

        // Assert
        expect(result).toEqual(mockUser);
        expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      });

      it('should throw authentication error when not authenticated', async () => {
        // Arrange
        mockContext.user = undefined;

        // Act & Assert
        await expect(userResolvers.Query.me(null, {}, mockContext))
          .rejects.toThrow(GraphQLError);
      });

      it('should throw not found error when user does not exist', async () => {
        // Arrange
        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

        // Act & Assert
        await expect(userResolvers.Query.me(null, {}, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });

    describe('user', () => {
      it('should return user when requesting own profile', async () => {
        // Arrange
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          role: 'student',
          emailVerified: true,
          verificationToken: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLogin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

        // Act
        const result = await userResolvers.Query.user(null, { id: 'user-123' }, mockContext);

        // Assert
        expect(result).toEqual(mockUser);
      });

      it('should allow admin to view any user profile', async () => {
        // Arrange
        const mockUser = {
          id: 'other-user',
          email: 'other@example.com',
          passwordHash: 'hashed-password',
          role: 'student',
          emailVerified: true,
          verificationToken: null,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastLogin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockContext.user = {
          id: 'admin-user',
          email: 'admin@example.com',
          role: 'admin',
        };

        vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser);

        // Act
        const result = await userResolvers.Query.user(null, { id: 'other-user' }, mockContext);

        // Assert
        expect(result).toEqual(mockUser);
      });

      it('should reject non-admin viewing other user profiles', async () => {
        // Arrange
        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        // Act & Assert
        await expect(userResolvers.Query.user(null, { id: 'other-user' }, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });
  });

  describe('Mutation resolvers', () => {
    describe('register', () => {
      it('should register new user successfully', async () => {
        // Arrange
        const registerInput = {
          email: 'test@example.com',
          password: 'SecurePass123',
          fullName: 'Test User',
          role: 'STUDENT' as const,
        };

        const mockUser = User.create({
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          role: 'student',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(mockAuthService.register).mockResolvedValue({
          user: mockUser,
          verificationToken: 'token-123',
        });

        vi.mocked(mockAuthService.login).mockResolvedValue({
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

        // Act
        const result = await userResolvers.Mutation.register(null, { input: registerInput }, mockContext);

        // Assert
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(result.user).toEqual(mockUser);
        expect(mockAuthService.register).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'SecurePass123',
          fullName: 'Test User',
          role: 'student',
        });
      });

      it('should handle duplicate email error', async () => {
        // Arrange
        const registerInput = {
          email: 'existing@example.com',
          password: 'SecurePass123',
          fullName: 'Test User',
          role: 'STUDENT' as const,
        };

        const error = new Error('Email already exists');
        vi.mocked(mockAuthService.register).mockRejectedValue(error);

        // Act & Assert
        await expect(userResolvers.Mutation.register(null, { input: registerInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });

      it('should validate required fields', async () => {
        // Arrange
        const registerInput = {
          email: '',
          password: 'SecurePass123',
          fullName: 'Test User',
          role: 'STUDENT' as const,
        };

        // Act & Assert
        await expect(userResolvers.Mutation.register(null, { input: registerInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });

    describe('login', () => {
      it('should login user successfully', async () => {
        // Arrange
        const loginInput = {
          email: 'test@example.com',
          password: 'SecurePass123',
        };

        const mockUser = User.create({
          id: 'user-123',
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          role: 'student',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(mockAuthService.login).mockResolvedValue({
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

        // Act
        const result = await userResolvers.Mutation.login(null, { input: loginInput }, mockContext);

        // Assert
        expect(result.accessToken).toBe('access-token');
        expect(result.refreshToken).toBe('refresh-token');
        expect(result.user).toEqual(mockUser);
      });

      it('should handle invalid credentials', async () => {
        // Arrange
        const loginInput = {
          email: 'test@example.com',
          password: 'WrongPassword',
        };

        const error = new Error('Invalid credentials');
        vi.mocked(mockAuthService.login).mockRejectedValue(error);

        // Act & Assert
        await expect(userResolvers.Mutation.login(null, { input: loginInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });

      it('should validate required login fields', async () => {
        // Arrange
        const loginInput = {
          email: '',
          password: 'SecurePass123',
        };

        // Act & Assert
        await expect(userResolvers.Mutation.login(null, { input: loginInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });

    describe('refreshToken', () => {
      it('should refresh token successfully', async () => {
        // Arrange
        const refreshInput = {
          refreshToken: 'valid-refresh-token',
        };

        vi.mocked(mockAuthService.refreshToken).mockResolvedValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });

        // Act
        const result = await userResolvers.Mutation.refreshToken(null, { input: refreshInput }, mockContext);

        // Assert
        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBe('new-refresh-token');
        expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      });

      it('should handle invalid refresh token', async () => {
        // Arrange
        const refreshInput = {
          refreshToken: 'invalid-refresh-token',
        };

        const error = new Error('Invalid refresh token');
        vi.mocked(mockAuthService.refreshToken).mockRejectedValue(error);

        // Act & Assert
        await expect(userResolvers.Mutation.refreshToken(null, { input: refreshInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });

      it('should require refresh token', async () => {
        // Arrange
        const refreshInput = {
          refreshToken: '',
        };

        // Act & Assert
        await expect(userResolvers.Mutation.refreshToken(null, { input: refreshInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });

    describe('logout', () => {
      it('should logout successfully', async () => {
        // Arrange
        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockAuthService.logout).mockResolvedValue();

        // Act
        const result = await userResolvers.Mutation.logout(null, {}, mockContext);

        // Assert
        expect(result).toBe(true);
        expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'all-tokens');
      });

      it('should logout with specific refresh token', async () => {
        // Arrange
        const logoutInput = {
          refreshToken: 'specific-refresh-token',
        };

        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockAuthService.logout).mockResolvedValue();

        // Act
        const result = await userResolvers.Mutation.logout(null, { input: logoutInput }, mockContext);

        // Assert
        expect(result).toBe(true);
        expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'specific-refresh-token');
      });

      it('should require authentication', async () => {
        // Arrange
        mockContext.user = undefined;

        // Act & Assert
        await expect(userResolvers.Mutation.logout(null, {}, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });

    describe('updateProfile', () => {
      it('should update user profile successfully', async () => {
        // Arrange
        const updateInput = {
          fullName: 'Updated Name',
          bio: 'Updated bio',
        };

        const mockProfile = UserProfile.create({
          fullName: 'Updated Name',
          bio: 'Updated bio',
          timezone: 'UTC',
          language: 'en',
          notificationPreferences: {},
          privacySettings: {},
        });

        mockContext.user = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        };

        vi.mocked(mockUserProfileService.updateProfile).mockResolvedValue(mockProfile);

        // Act
        const result = await userResolvers.Mutation.updateProfile(null, { input: updateInput }, mockContext);

        // Assert
        expect(result).toEqual(mockProfile);
        expect(mockUserProfileService.updateProfile).toHaveBeenCalledWith('user-123', updateInput);
      });

      it('should require authentication', async () => {
        // Arrange
        const updateInput = {
          fullName: 'Updated Name',
        };

        mockContext.user = undefined;

        // Act & Assert
        await expect(userResolvers.Mutation.updateProfile(null, { input: updateInput }, mockContext))
          .rejects.toThrow(GraphQLError);
      });
    });
  });

  describe('Field resolvers', () => {
    describe('User.profile', () => {
      it('should resolve user profile', async () => {
        // Arrange
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        } as any;

        const mockProfile = UserProfile.create({
          fullName: 'Test User',
          timezone: 'UTC',
          language: 'en',
          notificationPreferences: {},
          privacySettings: {},
        });

        vi.mocked(mockUserProfileService.getUserProfile).mockResolvedValue(mockProfile);

        // Act
        const result = await userResolvers.User.profile(mockUser, {}, mockContext);

        // Assert
        expect(result).toEqual(mockProfile);
        expect(mockUserProfileService.getUserProfile).toHaveBeenCalledWith('user-123');
      });

      it('should return null when profile not found', async () => {
        // Arrange
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        } as any;

        vi.mocked(mockUserProfileService.getUserProfile).mockResolvedValue(null);

        // Act
        const result = await userResolvers.User.profile(mockUser, {}, mockContext);

        // Assert
        expect(result).toBeNull();
      });
    });
  });
});