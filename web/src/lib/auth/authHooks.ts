/**
 * Authentication Hooks
 * 
 * React hooks for authentication state access, user information, permissions,
 * and component-level protection.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from './authProvider';
import { createRoleGuard, RouteGuards, type UserRole, type Permission, type CourseContext } from './authGuards';

/**
 * Hook for authentication state only (lightweight)
 * Returns just the authentication state without actions
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
 * Main authentication hook
 * Provides access to authentication state and actions
 */
export function useAuth() {
  const context = useAuthContext();
  
  return {
    // State
    user: context.user,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    error: context.error,
    
    // Actions
    login: context.login,
    logout: context.logout,
    register: context.register,
    refreshUser: context.refreshUser,
    clearError: context.clearError,
  };
}

/**
 * Hook for current user information
 * Returns user data and user-specific utilities
 */
export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const userInfo = useMemo(() => {
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }, [user]);
  
  return {
    user: userInfo,
    isAuthenticated,
    isLoading,
    isStudent: user?.role === 'STUDENT',
    isEducator: user?.role === 'EDUCATOR',
    isAdmin: user?.role === 'ADMIN',
  };
}

/**
 * Hook for permission checking
 * Provides role and permission checking utilities
 */
export function usePermissions() {
  const { user } = useAuth();
  const roleGuard = useMemo(() => createRoleGuard(user), [user]);
  
  return {
    // Role checking
    hasRole: useCallback((role: UserRole) => roleGuard.hasRole(role), [roleGuard]),
    hasAnyRole: useCallback((roles: UserRole[]) => roleGuard.hasAnyRole(roles), [roleGuard]),
    
    // Permission checking
    hasPermission: useCallback((permission: Permission) => roleGuard.hasPermission(permission), [roleGuard]),
    hasAnyPermission: useCallback((permissions: Permission[]) => roleGuard.hasAnyPermission(permissions), [roleGuard]),
    
    // Course-specific permissions
    canAccessCourse: useCallback((courseContext: CourseContext) => roleGuard.canAccessCourse(courseContext), [roleGuard]),
    canEditCourse: useCallback((courseContext: CourseContext) => roleGuard.canEditCourse(courseContext), [roleGuard]),
    canDeleteCourse: useCallback((courseContext: CourseContext) => roleGuard.canDeleteCourse(courseContext), [roleGuard]),
    canPublishCourse: useCallback((courseContext: CourseContext) => roleGuard.canPublishCourse(courseContext), [roleGuard]),
    canEnrollInCourse: useCallback((courseContext: CourseContext) => roleGuard.canEnrollInCourse(courseContext), [roleGuard]),
    
    // Assignment permissions
    canGradeAssignments: useCallback((courseContext?: CourseContext) => roleGuard.canGradeAssignments(courseContext), [roleGuard]),
    canSubmitAssignments: useCallback((courseContext?: CourseContext) => roleGuard.canSubmitAssignments(courseContext), [roleGuard]),
    
    // General permissions
    canManageUsers: useCallback(() => roleGuard.canManageUsers(), [roleGuard]),
    canViewAnalytics: useCallback((courseContext?: CourseContext) => roleGuard.canViewAnalytics(courseContext), [roleGuard]),
    canAccessAdmin: useCallback(() => roleGuard.canAccessAdmin(), [roleGuard]),
    
    // Route permissions
    canAccessStudentRoutes: useCallback(() => RouteGuards.canAccessStudentRoutes(user), [user]),
    canAccessEducatorRoutes: useCallback(() => RouteGuards.canAccessEducatorRoutes(user), [user]),
    canAccessAdminRoutes: useCallback(() => RouteGuards.canAccessAdminRoutes(user), [user]),
    canAccessCourseManagement: useCallback(() => RouteGuards.canAccessCourseManagement(user), [user]),
    canAccessAnalytics: useCallback(() => RouteGuards.canAccessAnalytics(user), [user]),
  };
}

/**
 * Hook for authentication guards and route protection
 * Provides utilities for protecting components and routes
 */
export function useAuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const permissions = usePermissions();
  
  /**
   * Require authentication - redirect to login if not authenticated
   */
  const requireAuth = useCallback((redirectTo: string = '/login') => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
      return false;
    }
    return isAuthenticated;
  }, [isAuthenticated, isLoading, router]);
  
  /**
   * Require specific role - redirect if user doesn't have role
   */
  const requireRole = useCallback((role: UserRole, redirectTo: string = '/unauthorized') => {
    if (!requireAuth()) return false;
    
    if (!permissions.hasRole(role)) {
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [requireAuth, permissions, router]);
  
  /**
   * Require any of the specified roles
   */
  const requireAnyRole = useCallback((roles: UserRole[], redirectTo: string = '/unauthorized') => {
    if (!requireAuth()) return false;
    
    if (!permissions.hasAnyRole(roles)) {
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [requireAuth, permissions, router]);
  
  /**
   * Require specific permission
   */
  const requirePermission = useCallback((permission: Permission, redirectTo: string = '/unauthorized') => {
    if (!requireAuth()) return false;
    
    if (!permissions.hasPermission(permission)) {
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [requireAuth, permissions, router]);
  
  /**
   * Require course access
   */
  const requireCourseAccess = useCallback((courseContext: CourseContext, redirectTo: string = '/unauthorized') => {
    if (!requireAuth()) return false;
    
    if (!permissions.canAccessCourse(courseContext)) {
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [requireAuth, permissions, router]);
  
  /**
   * Check if user can access current route
   */
  const canAccessRoute = useCallback((requiredRoles?: UserRole[], requiredPermissions?: Permission[]) => {
    if (!isAuthenticated) return false;
    
    if (requiredRoles && !permissions.hasAnyRole(requiredRoles)) {
      return false;
    }
    
    if (requiredPermissions && !permissions.hasAnyPermission(requiredPermissions)) {
      return false;
    }
    
    return true;
  }, [isAuthenticated, permissions]);
  
  return {
    // State
    isAuthenticated,
    isLoading,
    user,
    
    // Guard functions
    requireAuth,
    requireRole,
    requireAnyRole,
    requirePermission,
    requireCourseAccess,
    canAccessRoute,
    
    // Convenience guards for common routes
    requireStudent: useCallback((redirectTo?: string) => requireRole('STUDENT', redirectTo), [requireRole]),
    requireEducator: useCallback((redirectTo?: string) => requireRole('EDUCATOR', redirectTo), [requireRole]),
    requireAdmin: useCallback((redirectTo?: string) => requireRole('ADMIN', redirectTo), [requireRole]),
    requireEducatorOrAdmin: useCallback((redirectTo?: string) => requireAnyRole(['EDUCATOR', 'ADMIN'], redirectTo), [requireAnyRole]),
  };
}

/**
 * Hook for login state management
 * Provides utilities for login/logout flows
 */
export function useAuthActions() {
  const { login, logout, register, clearError, error, isLoading } = useAuth();
  const router = useRouter();
  
  /**
   * Login with redirect
   */
  const loginWithRedirect = useCallback(async (
    email: string, 
    password: string, 
    redirectTo: string = '/dashboard'
  ) => {
    try {
      await login(email, password);
      router.push(redirectTo);
    } catch (err) {
      // Error is handled by the auth context
      throw err;
    }
  }, [login, router]);
  
  /**
   * Logout with redirect
   */
  const logoutWithRedirect = useCallback(async (redirectTo: string = '/') => {
    try {
      await logout();
      router.push(redirectTo);
    } catch {
      // Even if logout fails, redirect to home
      router.push(redirectTo);
    }
  }, [logout, router]);
  
  /**
   * Register with redirect
   */
  const registerWithRedirect = useCallback(async (
    email: string, 
    password: string, 
    fullName: string,
    redirectTo: string = '/dashboard'
  ) => {
    try {
      await register(email, password, fullName);
      router.push(redirectTo);
    } catch (err) {
      // Error is handled by the auth context
      throw err;
    }
  }, [register, router]);
  
  return {
    // Actions
    login,
    logout,
    register,
    loginWithRedirect,
    logoutWithRedirect,
    registerWithRedirect,
    clearError,
    
    // State
    error,
    isLoading,
  };
}

/**
 * Hook for checking if user owns a resource
 * Useful for determining if user can edit/delete their own content
 */
export function useResourceOwnership() {
  const { user } = useAuth();
  
  const isOwner = useCallback((resourceOwnerId: string) => {
    return user?.id === resourceOwnerId;
  }, [user?.id]);
  
  const canModifyResource = useCallback((resourceOwnerId: string, requiredPermission?: Permission) => {
    // Admins can modify any resource
    if (user?.role === 'ADMIN') return true;
    
    // Owner can modify their own resource
    if (isOwner(resourceOwnerId)) return true;
    
    // Check if user has required permission for non-owned resources
    if (requiredPermission) {
      const roleGuard = createRoleGuard(user);
      return roleGuard.hasPermission(requiredPermission);
    }
    
    return false;
  }, [user, isOwner]);
  
  return {
    isOwner,
    canModifyResource,
  };
}