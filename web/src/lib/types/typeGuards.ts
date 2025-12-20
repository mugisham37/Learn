/**
 * Type Guards and Utility Types
 * 
 * Provides type guards for polymorphic GraphQL types, utility types for common patterns,
 * discriminated union helpers, and type assertion utilities with validation.
 * 
 * Requirements: 2.4 - Type guards for polymorphic types and utility types
 */

import type {
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
  QuizAttempt,
  QuizAttemptStatus,
  AssignmentSubmission,
  AssignmentSubmissionStatus,
  Message,
  DiscussionThread,
  DiscussionReply,
  VideoProcessingStatus,
  Connection,
  Edge,
  PageInfo
} from '@/types/entities';

// =============================================================================
// Type Guards for User Types
// =============================================================================

/**
 * Type guard to check if a user has a specific role
 */
export function hasRole(user: User, role: UserRole): boolean {
  return user.role === role;
}

/**
 * Type guard to check if a user is a student
 */
export function isStudent(user: User): user is User & { role: 'STUDENT' } {
  return user.role === 'STUDENT';
}

/**
 * Type guard to check if a user is an educator
 */
export function isEducator(user: User): user is User & { role: 'EDUCATOR' } {
  return user.role === 'EDUCATOR';
}

/**
 * Type guard to check if a user is an admin
 */
export function isAdmin(user: User): user is User & { role: 'ADMIN' } {
  return user.role === 'ADMIN';
}

/**
 * Type guard to check if a user has elevated privileges (educator or admin)
 */
export function hasElevatedPrivileges(user: User): user is User & { role: 'EDUCATOR' | 'ADMIN' } {
  return user.role === 'EDUCATOR' || user.role === 'ADMIN';
}

// =============================================================================
// Type Guards for Course Types
// =============================================================================

/**
 * Type guard to check if a course is published
 */
export function isPublishedCourse(course: Course): course is Course & { status: 'PUBLISHED' } {
  return course.status === 'PUBLISHED';
}

/**
 * Type guard to check if a course is in draft status
 */
export function isDraftCourse(course: Course): course is Course & { status: 'DRAFT' } {
  return course.status === 'DRAFT';
}

/**
 * Type guard to check if a course is archived
 */
export function isArchivedCourse(course: Course): course is Course & { status: 'ARCHIVED' } {
  return course.status === 'ARCHIVED';
}

/**
 * Type guard to check if a course can be enrolled in
 */
export function isEnrollableCourse(course: Course): course is Course & { status: 'PUBLISHED' } {
  return course.status === 'PUBLISHED';
}

// =============================================================================
// Type Guards for Enrollment Types
// =============================================================================

/**
 * Type guard to check if an enrollment is active
 */
export function isActiveEnrollment(enrollment: Enrollment): enrollment is Enrollment & { status: 'ACTIVE' } {
  return enrollment.status === 'ACTIVE';
}

/**
 * Type guard to check if an enrollment is completed
 */
export function isCompletedEnrollment(enrollment: Enrollment): enrollment is Enrollment & { status: 'COMPLETED' } {
  return enrollment.status === 'COMPLETED';
}

/**
 * Type guard to check if an enrollment has a certificate
 */
export function hasCompletionCertificate(enrollment: Enrollment): enrollment is Enrollment & { certificate: NonNullable<Enrollment['certificate']> } {
  return enrollment.certificate != null;
}

// =============================================================================
// Type Guards for Lesson Types
// =============================================================================

/**
 * Type guard to check if a lesson is a video lesson
 */
export function isVideoLesson(lesson: Lesson): lesson is Lesson & { type: 'VIDEO'; videoUrl: string } {
  return lesson.type === 'VIDEO' && lesson.videoUrl != null;
}

/**
 * Type guard to check if a lesson is a text lesson
 */
export function isTextLesson(lesson: Lesson): lesson is Lesson & { type: 'TEXT'; content: string } {
  return lesson.type === 'TEXT' && lesson.content != null;
}

/**
 * Type guard to check if a lesson is a quiz lesson
 */
export function isQuizLesson(lesson: Lesson): lesson is Lesson & { type: 'QUIZ'; quiz: Quiz } {
  return lesson.type === 'QUIZ' && lesson.quiz != null;
}

/**
 * Type guard to check if a lesson is an assignment lesson
 */
export function isAssignmentLesson(lesson: Lesson): lesson is Lesson & { type: 'ASSIGNMENT'; assignment: Assignment } {
  return lesson.type === 'ASSIGNMENT' && lesson.assignment != null;
}

/**
 * Type guard to check if a lesson is interactive
 */
export function isInteractiveLesson(lesson: Lesson): lesson is Lesson & { type: 'INTERACTIVE' } {
  return lesson.type === 'INTERACTIVE';
}

// =============================================================================
// Type Guards for Assessment Types
// =============================================================================

/**
 * Type guard to check if a quiz attempt is in progress
 */
export function isQuizAttemptInProgress(attempt: QuizAttempt): attempt is QuizAttempt & { status: 'IN_PROGRESS' } {
  return attempt.status === 'IN_PROGRESS';
}

/**
 * Type guard to check if a quiz attempt is submitted
 */
export function isQuizAttemptSubmitted(attempt: QuizAttempt): attempt is QuizAttempt & { status: 'SUBMITTED' } {
  return attempt.status === 'SUBMITTED';
}

/**
 * Type guard to check if a quiz attempt is graded
 */
export function isQuizAttemptGraded(attempt: QuizAttempt): attempt is QuizAttempt & { status: 'GRADED'; score: number } {
  return attempt.status === 'GRADED' && attempt.score != null;
}

/**
 * Type guard to check if an assignment submission is submitted
 */
export function isAssignmentSubmitted(submission: AssignmentSubmission): submission is AssignmentSubmission & { status: 'SUBMITTED' } {
  return submission.status === 'SUBMITTED';
}

/**
 * Type guard to check if an assignment submission is graded
 */
export function isAssignmentGraded(submission: AssignmentSubmission): submission is AssignmentSubmission & { status: 'GRADED'; grade: number } {
  return submission.status === 'GRADED' && submission.grade != null;
}

// =============================================================================
// Type Guards for Content Processing
// =============================================================================

/**
 * Type guard to check if video processing is completed
 */
export function isVideoProcessingCompleted(status: VideoProcessingStatus): status is VideoProcessingStatus & { status: 'completed' } {
  return status.status === 'completed';
}

/**
 * Type guard to check if video processing failed
 */
export function isVideoProcessingFailed(status: VideoProcessingStatus): status is VideoProcessingStatus & { status: 'failed'; error: string } {
  return status.status === 'failed' && status.error != null;
}

// =============================================================================
// Type Guards for GraphQL Connection Types
// =============================================================================

/**
 * Type guard to check if a connection has data
 */
export function hasConnectionData<T>(connection: Connection<T> | null | undefined): connection is Connection<T> & { edges: Array<Edge<T> & { node: T }> } {
  return connection != null && connection.edges.length > 0;
}

/**
 * Type guard to check if a connection has next page
 */
export function hasNextPage<T>(connection: Connection<T>): boolean {
  return connection.pageInfo.hasNextPage;
}

/**
 * Type guard to check if a connection has previous page
 */
export function hasPreviousPage<T>(connection: Connection<T>): boolean {
  return connection.pageInfo.hasPreviousPage;
}

// =============================================================================
// Utility Types for Common Patterns
// =============================================================================

/**
 * Utility type to make specific fields required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type to make specific fields optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for non-null values
 */
export type NonNull<T> = T extends null | undefined ? never : T;

/**
 * Utility type for extracting node type from connection
 */
export type NodeType<T> = T extends Connection<infer U> ? U : never;

/**
 * Utility type for GraphQL ID fields
 */
export type ID = string;

/**
 * Utility type for polymorphic lesson content
 */
export type LessonContent = 
  | { type: 'VIDEO'; videoUrl: string; duration?: number }
  | { type: 'TEXT'; content: string }
  | { type: 'QUIZ'; quiz: Quiz }
  | { type: 'ASSIGNMENT'; assignment: Assignment }
  | { type: 'INTERACTIVE'; content?: string };

/**
 * Utility type for assessment results
 */
export type AssessmentResult = 
  | { type: 'QUIZ'; attempt: QuizAttempt; score: number; maxScore: number }
  | { type: 'ASSIGNMENT'; submission: AssignmentSubmission; grade?: number; maxPoints: number };

/**
 * Utility type for user permissions based on role
 */
export type UserPermissions<T extends UserRole> = T extends 'ADMIN'
  ? 'ALL_PERMISSIONS'
  : T extends 'EDUCATOR'
  ? 'COURSE_MANAGEMENT' | 'GRADING' | 'STUDENT_MANAGEMENT'
  : T extends 'STUDENT'
  ? 'COURSE_ACCESS' | 'ASSIGNMENT_SUBMISSION'
  : never;

// =============================================================================
// Discriminated Union Helpers
// =============================================================================

/**
 * Helper to create discriminated union type guards
 */
export function createDiscriminatedGuard<T, K extends keyof T>(
  discriminant: K
) {
  return function<V extends T[K]>(
    value: V
  ): (obj: T) => obj is T & { [P in K]: V } {
    return (obj: T): obj is T & { [P in K]: V } => {
      return obj[discriminant] === value;
    };
  };
}

/**
 * Helper to extract discriminated union values
 */
export function extractDiscriminatedValue<T, K extends keyof T>(
  obj: T,
  discriminant: K
): T[K] {
  return obj[discriminant];
}

// =============================================================================
// Type Assertion Utilities with Validation
// =============================================================================

/**
 * Assert that a value is not null or undefined
 */
export function assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value == null) {
    throw new Error(message || 'Expected non-null value');
  }
}

/**
 * Assert that a user has a specific role
 */
export function assertUserRole<T extends UserRole>(
  user: User,
  role: T,
  message?: string
): asserts user is User & { role: T } {
  if (user.role !== role) {
    throw new Error(message || `Expected user to have role ${role}, got ${user.role}`);
  }
}

/**
 * Assert that a course has a specific status
 */
export function assertCourseStatus<T extends CourseStatus>(
  course: Course,
  status: T,
  message?: string
): asserts course is Course & { status: T } {
  if (course.status !== status) {
    throw new Error(message || `Expected course to have status ${status}, got ${course.status}`);
  }
}

/**
 * Assert that an enrollment has a specific status
 */
export function assertEnrollmentStatus<T extends EnrollmentStatus>(
  enrollment: Enrollment,
  status: T,
  message?: string
): asserts enrollment is Enrollment & { status: T } {
  if (enrollment.status !== status) {
    throw new Error(message || `Expected enrollment to have status ${status}, got ${enrollment.status}`);
  }
}

/**
 * Assert that a lesson has a specific type
 */
export function assertLessonType<T extends LessonType>(
  lesson: Lesson,
  type: T,
  message?: string
): asserts lesson is Lesson & { type: T } {
  if (lesson.type !== type) {
    throw new Error(message || `Expected lesson to have type ${type}, got ${lesson.type}`);
  }
}

// =============================================================================
// Generic Type Validation Utilities
// =============================================================================

/**
 * Validate that an object has required properties
 */
export function validateRequiredProperties<T extends Record<string, any>>(
  obj: T,
  requiredProps: (keyof T)[],
  objectName = 'object'
): void {
  for (const prop of requiredProps) {
    if (obj[prop] == null) {
      throw new Error(`${objectName} is missing required property: ${String(prop)}`);
    }
  }
}

/**
 * Validate that a value is one of the allowed values
 */
export function validateEnumValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName = 'value'
): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`Invalid ${fieldName}: ${value}. Must be one of: ${allowedValues.join(', ')}`);
  }
}

/**
 * Validate that a GraphQL connection is properly formed
 */
export function validateConnection<T>(
  connection: any,
  connectionName = 'connection'
): asserts connection is Connection<T> {
  if (!connection || typeof connection !== 'object') {
    throw new Error(`${connectionName} must be an object`);
  }
  
  if (!Array.isArray(connection.edges)) {
    throw new Error(`${connectionName}.edges must be an array`);
  }
  
  if (!connection.pageInfo || typeof connection.pageInfo !== 'object') {
    throw new Error(`${connectionName}.pageInfo must be an object`);
  }
  
  validateRequiredProperties(
    connection.pageInfo,
    ['hasNextPage', 'hasPreviousPage'],
    `${connectionName}.pageInfo`
  );
}

// =============================================================================
// Type Narrowing Utilities
// =============================================================================

/**
 * Narrow array to non-empty array
 */
export function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

/**
 * Filter out null and undefined values with type narrowing
 */
export function filterNonNull<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((item): item is T => item != null);
}

/**
 * Find first non-null value with type narrowing
 */
export function findNonNull<T>(arr: (T | null | undefined)[]): T | undefined {
  return arr.find((item): item is T => item != null);
}

/**
 * Type-safe object key checking
 */
export function hasProperty<T extends Record<string, any>, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

/**
 * Type-safe property access with default
 */
export function getProperty<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: T[K]
): T[K] {
  return obj[key] ?? defaultValue;
}