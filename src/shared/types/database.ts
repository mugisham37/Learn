/**
 * Database Schema Type Definitions
 * 
 * Type definitions for database entities and query results
 */

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity
 */
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: 'student' | 'instructor' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
}

/**
 * Course entity
 */
export interface Course extends BaseEntity {
  title: string;
  description: string;
  instructorId: string;
  price: number;
  isPublished: boolean;
  categoryId?: string;
  thumbnailUrl?: string;
}

/**
 * Enrollment entity
 */
export interface Enrollment extends BaseEntity {
  userId: string;
  courseId: string;
  enrolledAt: Date;
  completedAt?: Date;
  progress: number;
  status: 'active' | 'completed' | 'cancelled';
}

/**
 * Lesson entity
 */
export interface Lesson extends BaseEntity {
  courseId: string;
  title: string;
  content: string;
  videoUrl?: string;
  duration?: number;
  order: number;
  isPublished: boolean;
}

/**
 * Assignment entity
 */
export interface Assignment extends BaseEntity {
  courseId: string;
  title: string;
  description: string;
  dueDate?: Date;
  maxPoints: number;
  isPublished: boolean;
}

/**
 * Submission entity
 */
export interface Submission extends BaseEntity {
  assignmentId: string;
  userId: string;
  content: string;
  submittedAt: Date;
  grade?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
}

/**
 * Query result types
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Database schema type
 */
export interface DatabaseSchema {
  users: User;
  courses: Course;
  enrollments: Enrollment;
  lessons: Lesson;
  assignments: Assignment;
  submissions: Submission;
}

/**
 * Database connection info
 */
export interface DatabaseConnectionInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl?: boolean;
  poolSize?: number;
}

/**
 * Query performance metrics
 */
export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: Date;
  userId?: string;
}