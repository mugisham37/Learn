/**
 * Admin Dashboard Types
 *
 * Type definitions for admin dashboard components and data structures.
 */

import type { User } from './entities';

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  activeEnrollments: number;
  monthlyRevenue: number;
}

export interface AdminActivity {
  id: string;
  type: 'user_registration' | 'course_published' | 'payment_processed' | 'system_event';
  message: string;
  timestamp: string;
}

export interface AdminDashboardData {
  user: User;
  stats: AdminStats;
  recentActivity: AdminActivity[];
}

export interface DashboardStats {
  totalEnrollments: number;
  completedCourses: number;
}

export interface DashboardData {
  user: User;
  recentEnrollments: Enrollment[];
  featuredCourses: Course[];
  stats: DashboardStats;
}

// Re-export commonly used types
export type { User, Course, Enrollment } from './entities';