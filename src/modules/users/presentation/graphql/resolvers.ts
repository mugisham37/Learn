/**
 * GraphQL Resolvers for Users Module
 *
 * Implements GraphQL resolvers for user authentication, authorization,
 * and profile management operations with proper error handling and validation.
 *
 * Requirements: 21.2, 21.3, 21.6, 21.7
 */

import { GraphQLError } from 'graphql';
import { IAuthService, RegisterDTO } from '../../application/services/IAuthService.js';
import {
  IUserProfileService,
  UpdateProfileDTO,
} from '../../application/services/IUserProfileService.js';
import { IUserRepository } from '../../infrastructure/repositories/IUserRepository.js';
import { User as DbUser } from '../../../../infrastructure/database/schema/users.schema.js';
import { UserProfile, NotificationPreferences } from '../../domain/value-objects/UserProfile.js';
import {
  requireAuth,
  requireOwnershipOrAdmin,
  validateRequiredFields,
  validatePasswordStrength,
  withErrorHandling,
  throwNotFound,
  throwConflict,
  createValidationError,
  createAuthenticationError,
  createGraphQLError,
} from '../../../../infrastructure/graphql/utils.js';

/**
 * GraphQL context interface
 */
export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  authService: IAuthService;
  userProfileService: IUserProfileService;
  userRepository: IUserRepository;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role: 'STUDENT' | 'EDUCATOR' | 'ADMIN';
}

interface LoginInput {
  email: string;
  password: string;
}

interface UpdateProfileInput {
  fullName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

interface NotificationPreferencesInput {
  email?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
  push?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
  inApp?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
}

interface UpdateNotificationPreferencesInput {
  preferences: NotificationPreferencesInput;
}

interface RequestPasswordResetInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

interface VerifyEmailInput {
  token: string;
}

interface RefreshTokenInput {
  refreshToken: string;
}

interface LogoutInput {
  refreshToken?: string;
}

// Note: requireAuth is now imported from GraphQL utilities

/**
 * Helper function to check role authorization
 * TODO: Implement when role-based authorization is needed
 */

/**
 * Helper function to convert domain role to GraphQL enum
 */
function mapRoleToGraphQL(role: string): 'STUDENT' | 'EDUCATOR' | 'ADMIN' {
  switch (role) {
    case 'student':
      return 'STUDENT';
    case 'educator':
      return 'EDUCATOR';
    case 'admin':
      return 'ADMIN';
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

/**
 * Helper function to convert GraphQL role enum to domain role
 */
function mapRoleFromGraphQL(
  role: 'STUDENT' | 'EDUCATOR' | 'ADMIN'
): 'student' | 'educator' | 'admin' {
  switch (role) {
    case 'STUDENT':
      return 'student';
    case 'EDUCATOR':
      return 'educator';
    case 'ADMIN':
      return 'admin';
    default:
      throw new Error(`Unknown GraphQL role: ${role}`);
  }
}

/**
 * GraphQL resolvers for users module
 */
export const userResolvers = {
  Query: {
    /**
     * Get current authenticated user
     */
    me: async (_parent: any, _args: any, context: GraphQLContext): Promise<DbUser> => {
      const authUser = requireAuth(context);

      try {
        const user = await context.userRepository.findById(authUser.id);
        if (!user) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        return user;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to fetch user', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get user by ID (requires appropriate permissions)
     */
    user: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<DbUser | null> => {
      const authUser = requireAuth(context);

      // Users can view their own profile, admins can view any profile
      if (authUser.id !== args.id && authUser.role !== 'admin') {
        throw new GraphQLError('Insufficient permissions to view this user', {
          extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 },
          },
        });
      }

      try {
        const user = await context.userRepository.findById(args.id);
        return user;
      } catch (error) {
        throw new GraphQLError('Failed to fetch user', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  Mutation: {
    /**
     * Register a new user
     */
    register: withErrorHandling(
      async (_parent: any, args: { input: RegisterInput }, context: GraphQLContext) => {
        // Validate required fields with proper error formatting
        validateRequiredFields(
          args.input,
          [
            { field: 'email', type: 'email' },
            { field: 'password', type: 'string', minLength: 8 },
            { field: 'fullName', type: 'string', minLength: 1, maxLength: 255 },
            { field: 'role', type: 'string' },
          ],
          context
        );

        // Validate password strength
        validatePasswordStrength(args.input.password, context);

        const registerData: RegisterDTO = {
          email: args.input.email.trim(),
          password: args.input.password,
          fullName: args.input.fullName.trim(),
          role: mapRoleFromGraphQL(args.input.role),
        };

        try {
          await context.authService.register(registerData);

          // For registration, we need to return tokens immediately
          // In a real implementation, you might want to require email verification first
          const loginResult = await context.authService.login(
            args.input.email.trim(),
            args.input.password
          );

          return {
            accessToken: loginResult.accessToken,
            refreshToken: loginResult.refreshToken,
            user: loginResult.user,
          };
        } catch (error: any) {
          if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
            throwConflict('Email already exists', 'email', context);
          }

          // Re-throw the error to be handled by withErrorHandling
          throw error;
        }
      }
    ),

    /**
     * Login user
     */
    login: withErrorHandling(
      async (_parent: any, args: { input: LoginInput }, context: GraphQLContext) => {
        // Validate required fields
        validateRequiredFields(
          args.input,
          [
            { field: 'email', type: 'email' },
            { field: 'password', type: 'string', minLength: 1 },
          ],
          context
        );

        try {
          const result = await context.authService.login(
            args.input.email.trim(),
            args.input.password
          );

          return {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
          };
        } catch (error: any) {
          if (error.message?.includes('invalid') || error.message?.includes('credentials')) {
            throw createAuthenticationError(
              'Invalid email or password',
              'invalid_credentials',
              context.requestId
            );
          }

          if (error.message?.includes('not verified')) {
            throw createAuthenticationError(
              'Email not verified',
              'email_not_verified',
              context.requestId
            );
          }

          // Re-throw the error to be handled by withErrorHandling
          throw error;
        }
      }
    ),

    /**
     * Refresh access token
     * Note: In GraphQL, refresh tokens are typically passed as arguments
     * rather than cookies since GraphQL doesn't have direct access to HTTP context
     */
    refreshToken: async (
      _parent: any,
      args: { input: { refreshToken: string } },
      context: GraphQLContext
    ) => {
      try {
        if (!args.input.refreshToken) {
          throw new GraphQLError('Refresh token is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const result = await context.authService.refreshToken(args.input.refreshToken);

        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          // Note: We don't return user here since it's not part of the refresh token result
          // The client should use the new access token to query for user data if needed
        };
      } catch (error: any) {
        if (
          error.message?.includes('invalid') ||
          error.message?.includes('expired') ||
          error.message?.includes('revoked')
        ) {
          throw new GraphQLError('Invalid or expired refresh token', {
            extensions: {
              code: 'UNAUTHENTICATED',
              http: { status: 401 },
            },
          });
        }

        throw new GraphQLError('Token refresh failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Logout user
     */
    logout: async (
      _parent: any,
      args: { input?: { refreshToken?: string } },
      context: GraphQLContext
    ): Promise<boolean> => {
      const authUser = requireAuth(context);

      try {
        // If refresh token is provided, invalidate it specifically
        // Otherwise, invalidate all tokens for the user (more secure)
        const refreshToken = args.input?.refreshToken || 'all-tokens';
        await context.authService.logout(authUser.id, refreshToken);
        return true;
      } catch (error) {
        throw new GraphQLError('Logout failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Verify email
     */
    verifyEmail: async (
      _parent: any,
      args: { input: VerifyEmailInput },
      context: GraphQLContext
    ): Promise<boolean> => {
      try {
        // Validate input
        if (!args.input.token || args.input.token.trim().length === 0) {
          throw new GraphQLError('Verification token is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        await context.authService.verifyEmail(args.input.token.trim());
        return true;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          throw new GraphQLError('Invalid or expired verification token', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Email verification failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Request password reset
     */
    requestPasswordReset: async (
      _parent: any,
      args: { input: RequestPasswordResetInput },
      context: GraphQLContext
    ): Promise<boolean> => {
      try {
        // Validate input
        if (!args.input.email || args.input.email.trim().length === 0) {
          throw new GraphQLError('Email is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(args.input.email.trim())) {
          throw new GraphQLError('Invalid email format', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        await context.authService.requestPasswordReset(args.input.email.trim());
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        // Always return true for other errors to prevent email enumeration
        return true;
      }
    },

    /**
     * Reset password
     */
    resetPassword: async (
      _parent: any,
      args: { input: ResetPasswordInput },
      context: GraphQLContext
    ): Promise<boolean> => {
      try {
        // Validate input
        if (!args.input.token || args.input.token.trim().length === 0) {
          throw new GraphQLError('Reset token is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if (!args.input.newPassword || args.input.newPassword.length === 0) {
          throw new GraphQLError('New password is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        await context.authService.resetPassword(args.input.token.trim(), args.input.newPassword);
        return true;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          throw new GraphQLError('Invalid or expired reset token', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if (error.message?.includes('validation') || error.message?.includes('password')) {
          throw new GraphQLError('Password does not meet requirements', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Password reset failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update user profile
     */
    updateProfile: async (
      _parent: any,
      args: { input: UpdateProfileInput },
      context: GraphQLContext
    ): Promise<UserProfile> => {
      const authUser = requireAuth(context);

      try {
        const updateData: UpdateProfileDTO = {
          fullName: args.input.fullName,
          bio: args.input.bio,
          timezone: args.input.timezone,
          language: args.input.language,
        };

        const updatedProfile = await context.userProfileService.updateProfile(
          authUser.id,
          updateData
        );
        return updatedProfile;
      } catch (error: any) {
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid profile data', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        throw new GraphQLError('Profile update failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update notification preferences
     */
    updateNotificationPreferences: async (
      _parent: any,
      args: { input: UpdateNotificationPreferencesInput },
      context: GraphQLContext
    ): Promise<UserProfile> => {
      const authUser = requireAuth(context);

      try {
        const preferences: NotificationPreferences = {
          email: args.input.preferences.email,
          push: args.input.preferences.push,
          inApp: args.input.preferences.inApp,
        };

        const updatedProfile = await context.userProfileService.updateNotificationPreferences(
          authUser.id,
          preferences
        );
        return updatedProfile;
      } catch (error: any) {
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid notification preferences', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        throw new GraphQLError('Notification preferences update failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  // Field resolvers
  User: {
    role: (user: DbUser) => mapRoleToGraphQL(user.role),

    profile: async (
      user: DbUser,
      _args: any,
      context: GraphQLContext
    ): Promise<UserProfile | null> => {
      try {
        const profile = await context.userProfileService.getUserProfile(user.id);
        return profile;
      } catch (error) {
        // Return null if profile not found, let the client handle it
        return null;
      }
    },
  },
};
