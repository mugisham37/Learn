/**
 * Enrollments and Progress Schema
 *
 * Database schema definitions for student enrollments, progress tracking, and certificates
 * Includes enrollments, lesson_progress, and certificates tables
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { courses, lessons } from './courses.schema';
import { users } from './users.schema';

/**
 * Enrollment Status Enum
 * Defines the lifecycle states of a student enrollment
 */
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['active', 'completed', 'dropped']);

/**
 * Progress Status Enum
 * Defines the completion status of individual lessons
 */
export const progressStatusEnum = pgEnum('progress_status', [
  'not_started',
  'in_progress',
  'completed',
]);

/**
 * Enrollments Table
 * Represents the relationship between students and courses
 * Tracks enrollment status, progress, and completion
 *
 * Requirements:
 * - 5.1: Student enrollment with duplicate prevention
 * - 5.3: Progress tracking initialization
 * - 5.6: Certificate generation on completion
 */
export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    courseId: uuid('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 })
      .default('0')
      .notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
    // Note: paymentId references payments table which will be defined later
    paymentId: uuid('payment_id'),
    // Note: certificateId references certificates table defined below
    certificateId: uuid('certificate_id'),
    status: enrollmentStatusEnum('status').default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Composite unique index preventing duplicate enrollments for same student+course
    studentCourseIdx: uniqueIndex('enrollments_student_course_idx').on(
      table.studentId,
      table.courseId
    ),
    // Index on studentId for fast lookups of student's enrollments
    studentIdx: index('enrollments_student_idx').on(table.studentId),
    // Index on courseId for fast lookups of course enrollments
    courseIdx: index('enrollments_course_idx').on(table.courseId),
    // Index on status for filtering active/completed enrollments
    statusIdx: index('enrollments_status_idx').on(table.status),
    // Index on completedAt for completion queries
    completedAtIdx: index('enrollments_completed_at_idx').on(table.completedAt),
  })
);

/**
 * Lesson Progress Table
 * Tracks granular progress for each lesson within an enrollment
 * Records completion status, time spent, quiz scores, and attempts
 *
 * Requirements:
 * - 5.3: Lesson progress record initialization
 * - 5.4: Progress percentage calculation
 * - 5.5: Module completion detection
 */
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .references(() => enrollments.id, { onDelete: 'cascade' })
      .notNull(),
    lessonId: uuid('lesson_id')
      .references(() => lessons.id, { onDelete: 'cascade' })
      .notNull(),
    status: progressStatusEnum('status').default('not_started').notNull(),
    timeSpentSeconds: integer('time_spent_seconds').default(0).notNull(),
    completedAt: timestamp('completed_at'),
    quizScore: integer('quiz_score'),
    attemptsCount: integer('attempts_count').default(0).notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Composite unique index ensuring one progress record per enrollment+lesson
    enrollmentLessonIdx: uniqueIndex('progress_enrollment_lesson_idx').on(
      table.enrollmentId,
      table.lessonId
    ),
    // Index on status for filtering progress by completion status
    statusIdx: index('progress_status_idx').on(table.status),
    // Index on completedAt for completion queries
    completedAtIdx: index('progress_completed_at_idx').on(table.completedAt),
  })
);

/**
 * Certificates Table
 * Digital credentials issued upon successful course completion
 * Contains certificate metadata, PDF URL, and verification information
 *
 * Requirements:
 * - 5.6: Certificate generation with unique ID and verification
 * - 5.7: Certificate delivery with PDF and verification URL
 */
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id')
      .references(() => enrollments.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    certificateId: varchar('certificate_id', { length: 100 }).unique().notNull(),
    pdfUrl: varchar('pdf_url', { length: 500 }).notNull(),
    issuedAt: timestamp('issued_at').defaultNow().notNull(),
    verificationUrl: varchar('verification_url', { length: 500 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique index on certificateId for verification lookups
    certificateIdIdx: uniqueIndex('certificates_certificate_id_idx').on(table.certificateId),
    // Index on enrollmentId for fast certificate lookups by enrollment
    enrollmentIdx: uniqueIndex('certificates_enrollment_idx').on(table.enrollmentId),
  })
);

/**
 * Type exports for use in application code
 */
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
