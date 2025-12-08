/**
 * Shared TypeScript Types
 * 
 * Common types used across multiple modules
 */

export type Role = 'student' | 'educator' | 'admin';

export type CourseStatus = 'draft' | 'pending_review' | 'published' | 'archived';

export type LessonType = 'video' | 'text' | 'quiz' | 'assignment';

export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type GradingStatus = 'auto_graded' | 'pending_review' | 'graded';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
