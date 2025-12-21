/**
 * Type System Module
 *
 * Exports type guards, utility types, and type manipulation helpers
 * for building type-safe GraphQL applications.
 *
 * Requirements: 2.4 - Type guards and utility types for polymorphic GraphQL types
 */

// Type guards for runtime type checking
export * from './typeGuards';

// Utility types for common patterns
export * from './utilityTypes';

// Re-export commonly used types from entities
export type {
  User,
  UserRole,
  Course,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonType,
  Quiz,
  Assignment,
  Message,
  Connection,
  Edge,
  PageInfo,
  ID,
  DateTime,
} from '@/types/entities';

// Re-export generated GraphQL types
export type { Maybe, InputMaybe, Exact, MakeOptional, MakeMaybe, Scalars } from '@/types/schema';
