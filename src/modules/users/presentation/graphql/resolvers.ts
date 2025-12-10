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
import { IUserProfileService, UpdateProfileDTO } from '../../application/services/IUserProfileService.js';
import { IUserRepository } from '../../infrastructure/repositories/IUserRepository.js';
import { User as DbUser } from '../../../../infrastructure/database/schema/users.schema.js';
import { UserProfile, NotificationPreferences } from '../../domain/value-objects/UserProfile.js';

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

/**
 * Helper function to require authentication
 */
function requireAuth(context: GraphQLContext): { id: string; email: string; role: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
  return context.user;
}

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
function mapRoleFromGraphQL(role: 'STUDENT' | 'EDUCATOR' | 'ADMIN'): 'student' | 'educator' | 'admin' {
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
              http: { status: 404 }
            }
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
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get user by ID (requires appropriate permissions)
     */
    user: async (_parent: any, args: { id: string }, context: GraphQLContext): Promise<DbUser | null> => {
      const authUser = requireAuth(context);
      
      // Users can view their own profile, admins can view any profile
      if (authUser.id !== args.id && authUser.role !== 'admin') {
        throw new GraphQLError('Insufficient permissions to view this user', {
          extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 }
          }
        });
      }
      
      try {
        const user = await context.userRepository.findById(args.id);
        return user;
      } catch (error) {
        throw new GraphQLError('Failed to fetch user', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  },

  Mutation: {
    /**
     * Register a new user
     */
    register: async (_parent: any, args: { input: RegisterInput }, context: GraphQLContext) => {
      try {
        const registerData: RegisterDTO = {
          email: args.input.email,
          password: args.input.password,
          fullName: args.input.fullName,
          role: mapRoleFromGraphQL(args.input.role)
        };

        await context.authService.register(registerData);
        
        // For registration, we need to return tokens immediately
        // In a real implementation, you might want to require email verification first
        const loginResult = await context.authService.login(args.input.email, args.input.password);
        
        return {
          accessToken: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          user: loginResult.user
        };
      } catch (error: any) {
        if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
          throw new GraphQLError('Email already exists', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
              field: 'email'
            }
          });
        }
        
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid input data', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        throw new GraphQLError('Registration failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Login user
     */
    login: async (_parent: any, args: { input: LoginInput }, context: GraphQLContext) => {
      try {
        const result = await context.authService.login(args.input.email, args.input.password);
        
        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user
        };
      } catch (error: any) {
        if (error.message?.includes('invalid') || error.message?.includes('credentials')) {
          throw new GraphQLError('Invalid email or password', {
            extensions: {
              code: 'UNAUTHENTICATED',
              http: { status: 401 }
            }
          });
        }
        
        if (error.message?.includes('not verified')) {
          throw new GraphQLError('Email not verified', {
            extensions: {
              code: 'UNAUTHENTICATED',
              http: { status: 401 }
            }
          });
        }
        
        throw new GraphQLError('Login failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Refresh access token
     */
    refreshToken: async (_parent: any, _args: any, _context: GraphQLContext) => {
      // In a real implementation, you would extract the refresh token from cookies or headers
      // For now, this is a placeholder implementation
      try {
        // This is a simplified implementation - in reality, you'd get the refresh token from the request
        throw new GraphQLError('Refresh token implementation needed', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 }
          }
        });
      } catch (error) {
        throw new GraphQLError('Token refresh failed', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
    },

    /**
     * Logout user
     */
    logout: async (_parent: any, _args: any, context: GraphQLContext): Promise<boolean> => {
      const authUser = requireAuth(context);
      
      try {
        // In a real implementation, you would extract the refresh token from cookies or headers
        // For now, we'll use a placeholder
        await context.authService.logout(authUser.id, 'refresh-token-placeholder');
        return true;
      } catch (error) {
        throw new GraphQLError('Logout failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Verify email
     */
    verifyEmail: async (_parent: any, args: { input: VerifyEmailInput }, context: GraphQLContext): Promise<boolean> => {
      try {
        await context.authService.verifyEmail(args.input.token);
        return true;
      } catch (error: any) {
        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          throw new GraphQLError('Invalid or expired verification token', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        throw new GraphQLError('Email verification failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Request password reset
     */
    requestPasswordReset: async (_parent: any, args: { input: RequestPasswordResetInput }, context: GraphQLContext): Promise<boolean> => {
      try {
        await context.authService.requestPasswordReset(args.input.email);
        return true;
      } catch (error) {
        // Always return true to prevent email enumeration
        return true;
      }
    },

    /**
     * Reset password
     */
    resetPassword: async (_parent: any, args: { input: ResetPasswordInput }, context: GraphQLContext): Promise<boolean> => {
      try {
        await context.authService.resetPassword(args.input.token, args.input.newPassword);
        return true;
      } catch (error: any) {
        if (error.message?.includes('invalid') || error.message?.includes('expired')) {
          throw new GraphQLError('Invalid or expired reset token', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error.message?.includes('validation') || error.message?.includes('password')) {
          throw new GraphQLError('Password does not meet requirements', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        throw new GraphQLError('Password reset failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Update user profile
     */
    updateProfile: async (_parent: any, args: { input: UpdateProfileInput }, context: GraphQLContext): Promise<UserProfile> => {
      const authUser = requireAuth(context);
      
      try {
        const updateData: UpdateProfileDTO = {
          fullName: args.input.fullName,
          bio: args.input.bio,
          timezone: args.input.timezone,
          language: args.input.language
        };

        const updatedProfile = await context.userProfileService.updateProfile(authUser.id, updateData);
        return updatedProfile;
      } catch (error: any) {
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid profile data', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error.message?.includes('not found')) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Profile update failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Update notification preferences
     */
    updateNotificationPreferences: async (_parent: any, args: { input: UpdateNotificationPreferencesInput }, context: GraphQLContext): Promise<UserProfile> => {
      const authUser = requireAuth(context);
      
      try {
        const preferences: NotificationPreferences = {
          email: args.input.preferences.email,
          push: args.input.preferences.push,
          inApp: args.input.preferences.inApp
        };

        const updatedProfile = await context.userProfileService.updateNotificationPreferences(authUser.id, preferences);
        return updatedProfile;
      } catch (error: any) {
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid notification preferences', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error.message?.includes('not found')) {
          throw new GraphQLError('User not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Notification preferences update failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  },

  // Field resolvers
  User: {
    role: (user: DbUser) => mapRoleToGraphQL(user.role),
    
    profile: async (user: DbUser, _args: any, context: GraphQLContext): Promise<UserProfile | null> => {
      try {
        const profile = await context.userProfileService.getUserProfile(user.id);
        return profile;
      } catch (error) {
        // Return null if profile not found, let the client handle it
        return null;
      }
    }
  }
};