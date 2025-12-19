/**
 * Authentication System
 * 
 * JWT token management, role-based access control, and authentication state.
 * Provides a complete authentication infrastructure for the frontend application.
 */

// Token management
export { tokenManager, TokenManager, SecureTokenStorage } from './tokenStorage';
export type { TokenStorage } from './tokenStorage';

// Authentication provider and context
export { AuthProvider, useAuthContext } from './authProvider';

// Role-based access control
export { 
  createRoleGuard, 
  RoleGuard, 
  PermissionUtils, 
  RouteGuards 
} from './authGuards';
export type { UserRole, Permission, CourseContext } from './authGuards';

// Authentication hooks
export {
  useAuth,
  useUser,
  usePermissions,
  useAuthGuard,
  useAuthActions,
  useResourceOwnership,
} from './authHooks';