/**
 * Authentication System
 * 
 * JWT token management, role-based access control, authentication state,
 * email verification, and password reset functionality.
 * Provides a complete authentication infrastructure for the frontend application.
 */

// Token management
export { tokenManager, TokenManager, SecureTokenStorage } from './tokenStorage';
export type { TokenStorage } from './tokenStorage';

// Authentication provider and context
export { AuthProvider, useAuthContext } from './authProvider';

// Authentication components
export { 
  AuthGuard, 
  ProtectedRoute, 
  PermissionGuard,
  RoleGuard,
  EmailVerificationForm,
  EmailVerificationHandler,
  PasswordResetRequestForm,
  PasswordResetConfirmForm
} from './components';

// Role-based access control
export { 
  createRoleGuard, 
  RoleGuard as RoleGuardClass, 
  PermissionUtils, 
  RouteGuards 
} from './authGuards';
export type { UserRole, Permission, CourseContext } from './authGuards';

// Authentication hooks
export {
  useAuth,
  useAuthState,
  useUser,
  usePermissions,
  useAuthGuard,
  useAuthActions,
  useResourceOwnership,
} from './authHooks';