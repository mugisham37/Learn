/**
 * Authentication Components
 *
 * React components for protecting routes, rendering content based on authentication state,
 * email verification, and password reset workflows.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from './authHooks';
import type { UserRole, Permission } from './authGuards';

// Re-export email verification and password reset components
export { EmailVerificationForm, EmailVerificationHandler } from './components/EmailVerification';
export { PasswordResetRequestForm, PasswordResetConfirmForm } from './components/PasswordReset';

export interface AuthGuardProps {
  children: React.ReactNode;
  /** Require authentication */
  requireAuth?: boolean;
  /** Required roles (user must have at least one) */
  requiredRoles?: UserRole[];
  /** Required permissions (user must have at least one) */
  requiredPermissions?: Permission[];
  /** Redirect path when access is denied */
  redirectTo?: string;
  /** Fallback component when access is denied */
  fallback?: React.ReactNode;
  /** Loading component while checking authentication */
  loading?: React.ReactNode;
}

/**
 * AuthGuard component for protecting content based on authentication and permissions
 */
export function AuthGuard({
  children,
  requireAuth = true,
  requiredRoles,
  requiredPermissions,
  redirectTo,
  fallback,
  loading,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, canAccessRoute } = useAuthGuard();
  const router = useRouter();

  // Show loading state while checking authentication
  if (isLoading) {
    return loading ? <>{loading}</> : <div>Loading...</div>;
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    if (redirectTo) {
      router.push(redirectTo);
      return null;
    }
    return fallback ? <>{fallback}</> : <div>Access denied. Please log in.</div>;
  }

  // Check role and permission requirements
  if (isAuthenticated && !canAccessRoute(requiredRoles, requiredPermissions)) {
    if (redirectTo) {
      router.push(redirectTo);
      return null;
    }
    return fallback ? <>{fallback}</> : <div>Access denied. Insufficient permissions.</div>;
  }

  return <>{children}</>;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required roles (user must have at least one) */
  requiredRoles?: UserRole[];
  /** Required permissions (user must have at least one) */
  requiredPermissions?: Permission[];
  /** Redirect path when not authenticated */
  loginRedirect?: string;
  /** Redirect path when access is denied */
  unauthorizedRedirect?: string;
  /** Loading component while checking authentication */
  loading?: React.ReactNode;
}

/**
 * ProtectedRoute component for protecting entire routes
 */
export function ProtectedRoute({
  children,
  requiredRoles,
  requiredPermissions,
  loginRedirect = '/login',
  unauthorizedRedirect = '/unauthorized',
  loading,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, canAccessRoute } = useAuthGuard();
  const router = useRouter();

  // Show loading state while checking authentication
  if (isLoading) {
    return loading ? <>{loading}</> : <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    router.push(loginRedirect);
    return null;
  }

  // Check role and permission requirements
  if (!canAccessRoute(requiredRoles, requiredPermissions)) {
    router.push(unauthorizedRedirect);
    return null;
  }

  return <>{children}</>;
}

/**
 * RoleGuard component for showing content based on user roles
 */
export interface RoleGuardProps {
  children: React.ReactNode;
  /** Required roles (user must have at least one) */
  roles: UserRole[];
  /** Fallback content when user doesn't have required roles */
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, roles, fallback }: RoleGuardProps) {
  const { canAccessRoute } = useAuthGuard();

  if (!canAccessRoute(roles)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

/**
 * PermissionGuard component for showing content based on user permissions
 */
export interface PermissionGuardProps {
  children: React.ReactNode;
  /** Required permissions (user must have at least one) */
  permissions: Permission[];
  /** Fallback content when user doesn't have required permissions */
  fallback?: React.ReactNode;
}

export function PermissionGuard({ children, permissions, fallback }: PermissionGuardProps) {
  const { canAccessRoute } = useAuthGuard();

  if (!canAccessRoute(undefined, permissions)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
