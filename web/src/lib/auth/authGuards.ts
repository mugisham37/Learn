/**
 * Authentication Guards and Role-Based Access Control
 *
 * Permission checking utilities for all user roles and resource access control.
 * Provides helpers for course ownership, enrollment checking, and route protection.
 */

import type { User, UserRole as EntityUserRole } from '@/types';

/**
 * User roles in the system - using GraphQL schema types
 */
export type UserRole = EntityUserRole;

/**
 * Permission types for different resources
 */
export type Permission =
  | 'course:create'
  | 'course:edit'
  | 'course:delete'
  | 'course:publish'
  | 'course:view'
  | 'course:enroll'
  | 'assignment:create'
  | 'assignment:edit'
  | 'assignment:grade'
  | 'assignment:submit'
  | 'user:manage'
  | 'analytics:view'
  | 'admin:access';

/**
 * Role-based permission matrix
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  STUDENT: ['course:view', 'course:enroll', 'assignment:submit'],
  EDUCATOR: [
    'course:create',
    'course:edit',
    'course:delete',
    'course:publish',
    'course:view',
    'assignment:create',
    'assignment:edit',
    'assignment:grade',
    'analytics:view',
  ],
  ADMIN: [
    'course:create',
    'course:edit',
    'course:delete',
    'course:publish',
    'course:view',
    'course:enroll',
    'assignment:create',
    'assignment:edit',
    'assignment:grade',
    'assignment:submit',
    'user:manage',
    'analytics:view',
    'admin:access',
  ],
  // Handle future added values
  '%future added value': [],
};

/**
 * Course ownership and enrollment context
 */
export interface CourseContext {
  courseId: string;
  instructorId?: string;
  enrolledStudentIds?: string[];
}

/**
 * Role guard class for permission checking
 */
export class RoleGuard {
  private user: User | null;

  constructor(user: User | null) {
    this.user = user;
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: UserRole): boolean {
    return this.user?.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    if (!this.user?.role) return false;
    return roles.includes(this.user.role);
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: Permission): boolean {
    if (!this.user?.role) return false;

    const userPermissions = ROLE_PERMISSIONS[this.user.role] || [];
    return userPermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  /**
   * Check if user can access a course (view, enroll, or own)
   */
  canAccessCourse(courseContext: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can access any course
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can access their courses
    if (courseContext.instructorId === this.user.id) return true;

    // Enrolled students can access courses they're enrolled in
    if (courseContext.enrolledStudentIds?.includes(this.user.id)) return true;

    // Educators can view courses for reference
    if (this.hasRole('EDUCATOR') && this.hasPermission('course:view')) return true;

    return false;
  }

  /**
   * Check if user can edit a course
   */
  canEditCourse(courseContext: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can edit any course
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can edit their own courses
    if (courseContext.instructorId === this.user.id && this.hasPermission('course:edit')) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can delete a course
   */
  canDeleteCourse(courseContext: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can delete any course
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can delete their own courses
    if (courseContext.instructorId === this.user.id && this.hasPermission('course:delete')) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can publish/unpublish a course
   */
  canPublishCourse(courseContext: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can publish any course
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can publish their own courses
    if (courseContext.instructorId === this.user.id && this.hasPermission('course:publish')) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can enroll in a course
   */
  canEnrollInCourse(courseContext: CourseContext): boolean {
    if (!this.user) return false;

    // Can't enroll in your own course
    if (courseContext.instructorId === this.user.id) return false;

    // Can't enroll if already enrolled
    if (courseContext.enrolledStudentIds?.includes(this.user.id)) return false;

    // Students and admins can enroll
    return this.hasPermission('course:enroll');
  }

  /**
   * Check if user can grade assignments
   */
  canGradeAssignments(courseContext?: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can grade any assignment
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can grade assignments in their courses
    if (courseContext && courseContext.instructorId === this.user.id) {
      return this.hasPermission('assignment:grade');
    }

    // General permission check for educators
    return this.hasPermission('assignment:grade');
  }

  /**
   * Check if user can submit assignments
   */
  canSubmitAssignments(courseContext?: CourseContext): boolean {
    if (!this.user) return false;

    // Must be enrolled in the course to submit assignments
    if (courseContext && !courseContext.enrolledStudentIds?.includes(this.user.id)) {
      return false;
    }

    return this.hasPermission('assignment:submit');
  }

  /**
   * Check if user can manage other users
   */
  canManageUsers(): boolean {
    return this.hasPermission('user:manage');
  }

  /**
   * Check if user can view analytics
   */
  canViewAnalytics(courseContext?: CourseContext): boolean {
    if (!this.user) return false;

    // Admins can view all analytics
    if (this.hasRole('ADMIN')) return true;

    // Course instructors can view analytics for their courses
    if (courseContext && courseContext.instructorId === this.user.id) {
      return this.hasPermission('analytics:view');
    }

    // General permission check
    return this.hasPermission('analytics:view');
  }

  /**
   * Check if user can access admin features
   */
  canAccessAdmin(): boolean {
    return this.hasPermission('admin:access');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.user !== null;
  }

  /**
   * Get user ID
   */
  getUserId(): string | null {
    return this.user?.id || null;
  }

  /**
   * Get user role
   */
  getUserRole(): UserRole | null {
    return this.user?.role || null;
  }

  /**
   * Get user email
   */
  getUserEmail(): string | null {
    return this.user?.email || null;
  }
}

/**
 * Create a role guard instance for a user
 */
export function createRoleGuard(user: User | null): RoleGuard {
  return new RoleGuard(user);
}

/**
 * Permission checking utilities (functional approach)
 */
export const PermissionUtils = {
  /**
   * Check if user has permission
   */
  hasPermission(user: User | null, permission: Permission): boolean {
    return createRoleGuard(user).hasPermission(permission);
  },

  /**
   * Check if user has role
   */
  hasRole(user: User | null, role: UserRole): boolean {
    return createRoleGuard(user).hasRole(role);
  },

  /**
   * Check if user can access course
   */
  canAccessCourse(user: User | null, courseContext: CourseContext): boolean {
    return createRoleGuard(user).canAccessCourse(courseContext);
  },

  /**
   * Check if user can edit course
   */
  canEditCourse(user: User | null, courseContext: CourseContext): boolean {
    return createRoleGuard(user).canEditCourse(courseContext);
  },

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  },

  /**
   * Check if role has permission
   */
  roleHasPermission(role: UserRole, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  },
};

/**
 * Route protection utilities
 */
export const RouteGuards = {
  /**
   * Check if user can access student routes
   */
  canAccessStudentRoutes(user: User | null): boolean {
    return createRoleGuard(user).hasAnyRole(['STUDENT', 'EDUCATOR', 'ADMIN']);
  },

  /**
   * Check if user can access educator routes
   */
  canAccessEducatorRoutes(user: User | null): boolean {
    return createRoleGuard(user).hasAnyRole(['EDUCATOR', 'ADMIN']);
  },

  /**
   * Check if user can access admin routes
   */
  canAccessAdminRoutes(user: User | null): boolean {
    return createRoleGuard(user).hasRole('ADMIN');
  },

  /**
   * Check if user can access course management routes
   */
  canAccessCourseManagement(user: User | null): boolean {
    return createRoleGuard(user).hasAnyPermission(['course:create', 'course:edit']);
  },

  /**
   * Check if user can access analytics routes
   */
  canAccessAnalytics(user: User | null): boolean {
    return createRoleGuard(user).hasPermission('analytics:view');
  },
};
