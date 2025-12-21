/**
 * Authentication Hooks
 *
 * React hooks for authentication state management.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from './authProvider';
import type { User, UserRole } from '@/types';
import type { Permission } from './authGuards';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Hook for authentication state
 */
export function useAuth(): AuthState & { logout: () => Promise<void> } {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const logout = async () => {
    localStorage.removeItem('access-token');
    localStorage.removeItem('refresh-token');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  useEffect(() => {
    // Mock authentication check
    const checkAuth = () => {
      const token = localStorage.getItem('access-token');
      if (token) {
        // Mock user data
        setAuthState({
          user: {
            id: '1',
            email: 'user@example.com',
            role: 'STUDENT',
            emailVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as User,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuth();
  }, []);

  return { ...authState, logout };
}

/**
 * Hook for authentication state using context
 */
export function useAuthState() {
  const context = useAuthContext();
  return {
    user: context.user,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    error: context.error,
  };
}

/**
 * Hook for current user data
 */
export function useUser() {
  const { user } = useAuthContext();
  return user;
}

/**
 * Hook for user permissions
 */
export function usePermissions() {
  const { user } = useAuthContext();
  
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'ADMIN') return true;
    
    // Basic permission logic - extend as needed
    switch (permission) {
      case 'course:view':
        return true; // All authenticated users can read courses
      case 'course:create':
      case 'course:edit':
      case 'course:delete':
        return ['EDUCATOR', 'ADMIN'].includes(user.role);
      case 'user:manage':
        return ['ADMIN'].includes(user.role);
      default:
        return false;
    }
  }, [user]);

  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.role === role;
  }, [user]);

  return {
    hasPermission,
    hasRole,
    permissions: user ? [] : [], // Could be expanded to return actual permissions
  };
}

/**
 * Hook for authentication guards
 */
export function useAuthGuard() {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  const { hasPermission, hasRole } = usePermissions();

  const canAccessRoute = useCallback(
    (requiredRoles?: UserRole[], requiredPermissions?: Permission[]): boolean => {
      if (!isAuthenticated || !user) return false;

      // Check roles
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRequiredRole = requiredRoles.some(role => hasRole(role));
        if (!hasRequiredRole) return false;
      }

      // Check permissions
      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasRequiredPermission = requiredPermissions.some(permission => hasPermission(permission));
        if (!hasRequiredPermission) return false;
      }

      return true;
    },
    [isAuthenticated, user, hasRole, hasPermission]
  );

  return {
    isAuthenticated,
    isLoading,
    user,
    canAccessRoute,
  };
}

/**
 * Hook for authentication actions
 */
export function useAuthActions() {
  const context = useAuthContext();

  const sendVerificationEmail = useCallback(async (email: string) => {
    await context.sendEmailVerification(email);
    return { message: 'Verification email sent successfully' };
  }, [context]);

  const verifyEmailWithRedirect = useCallback(async (token: string, email: string, redirectTo: string) => {
    const result = await context.verifyEmail(token, email);
    if (result.success && redirectTo) {
      // Handle redirect logic here if needed
      window.location.href = redirectTo;
    }
    return result;
  }, [context]);

  const requestPasswordResetWithFeedback = useCallback(async (email: string) => {
    await context.requestPasswordReset(email);
    return { message: 'Password reset email sent successfully' };
  }, [context]);

  const resetPasswordWithRedirect = useCallback(async (
    token: string,
    email: string,
    newPassword: string,
    redirectTo: string
  ) => {
    const result = await context.resetPassword(token, email, newPassword);
    if (result.success && redirectTo) {
      // Handle redirect logic here if needed
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 2000);
    }
    return result;
  }, [context]);

  return {
    login: context.login,
    logout: context.logout,
    register: context.register,
    refreshUser: context.refreshUser,
    clearError: context.clearError,
    sendVerificationEmail,
    verifyEmailWithRedirect,
    requestPasswordResetWithFeedback,
    resetPasswordWithRedirect,
  };
}

/**
 * Hook for resource ownership checks
 */
export function useResourceOwnership() {
  const { user } = useAuthContext();

  const isOwner = useCallback((resourceUserId: string): boolean => {
    return user?.id === resourceUserId;
  }, [user]);

  const canModifyResource = useCallback((resourceUserId: string): boolean => {
    if (!user) return false;
    
    // Admin can modify any resource
    if (user.role === 'ADMIN') return true;
    
    // Owner can modify their own resource
    return isOwner(resourceUserId);
  }, [user, isOwner]);

  return {
    isOwner,
    canModifyResource,
  };
}