/**
 * Assessments Schema
 * 
 * Database schema definitions for quizzes, questions, assignments, and submissions
 * Includes quizzes, questions, quiz_submissions, assignments, and assignment_submissions tables
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  text, 
  integer, 
  decimal, 
  boolean, 
  timestamp, 
  jsonb, 
  pgEnum, 
  index 
} from 'drizzle-orm/pg-core';

import { lessons } from './courses.schema';
import { enrollments } from './enrollments.schema';
import { users } from './users.schema';

/**
 * Quiz Type Enum
 * Defines the types of quizzes that can be created
 */
export const quizTypeEnum = pgEnum('quiz_type', ['formative', 'summative', 'practice']);

/**
 * Question Type Enum
 * Defines the types of questions that can be included in quizzes
 */
export const questionTypeEnum = pgEnum('question_type', [
  'multiple_choice', 
  'true_false', 
  'short_answer', 
  'essay', 
  'fill_blank', 
  'matching'
]);

/**
 * Difficulty Enum
 * Defines difficulty levels for questions
 */
export const questionDifficultyEnum = pgEnum('question_difficulty', ['easy', 'medium', 'hard']);

/**
 * Grading Status Enum
 * Defines the grading status for quiz submissions
 */
export const gradingStatusEnum = pgEnum('grading_status', ['auto_graded', 'pending_review', 'graded']);

/**
 * Assignment Grading Status Enum
 * Defines the grading status for assignment submissions
 */
export const assignmentGradingStatusEnum = pgEnum('assignment_grading_status', [
  'submitted', 
  'under_review', 
  'graded', 
  'revision_requested'
]);

/**
 * Quizzes Table
 * Assessment entity with configuration for time limits, passing scores, and randomization
 * 
 * Requirements:
 * - 6.1: Quiz creation with various question types
 * - 6.2: Quiz configuration (time limits, passing scores, max attempts, randomization)
 */
export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  quizType: quizTypeEnum('quiz_type').notNull(),
  timeLimitMinutes: integer('time_limit_minutes'),
  passingScorePercentage: integer('passing_score_percentage').notNull(),
  maxAttempts: integer('max_attempts').default(0).notNull(),
  randomizeQuestions: boolean('randomize_questions').default(false).notNull(),
  randomizeOptions: boolean('randomize_options').default(false).notNull(),
  showCorrectAnswers: boolean('show_correct_answers').default(true).notNull(),
  showExplanations: boolean('show_explanations').default(true).notNull(),
  availableFrom: timestamp('available_from'),
  availableUntil: timestamp('available_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on lessonId for fast lookups of quizzes by lesson
  lessonIdx: index('quizzes_lesson_idx').on(table.lessonId),
}));

/**
 * Questions Table
 * Individual questions within a quiz with type-specific fields
 * 
 * Requirements:
 * - 6.1: Support for multiple question types (multiple_choice, true_false, short_answer, essay, fill_blank, matching)
 */
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id')
    .references(() => quizzes.id, { onDelete: 'cascade' })
    .notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  questionText: text('question_text').notNull(),
  questionMediaUrl: varchar('question_media_url', { length: 500 }),
  options: jsonb('options'),
  correctAnswer: jsonb('correct_answer').notNull(),
  explanation: text('explanation'),
  points: integer('points').default(1).notNull(),
  orderNumber: integer('order_number').notNull(),
  difficulty: questionDifficultyEnum('difficulty').default('medium').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on quizId for fast lookups of questions by quiz
  quizIdx: index('questions_quiz_idx').on(table.quizId),
  // Index on quizId and orderNumber for ordered question retrieval
  quizOrderIdx: index('questions_quiz_order_idx').on(table.quizId, table.orderNumber),
}));

/**
 * Quiz Submissions Table
 * Student attempts at quizzes with answers, scores, and grading status
 * 
 * Requirements:
 * - 6.3: Quiz attempt creation and tracking
 * - 6.4: Auto-grading for objective questions
 * - 6.5: Score calculation
 * - 6.6: Subjective question handling
 * - 6.7: Manual grading workflow
 */
export const quizSubmissions = pgTable('quiz_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id')
    .references(() => quizzes.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: uuid('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  enrollmentId: uuid('enrollment_id')
    .references(() => enrollments.id, { onDelete: 'cascade' })
    .notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  timeTakenSeconds: integer('time_taken_seconds'),
  scorePercentage: decimal('score_percentage', { precision: 5, scale: 2 }),
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  answers: jsonb('answers').notNull(),
  gradingStatus: gradingStatusEnum('grading_status').default('auto_graded').notNull(),
  feedback: text('feedback'),
  gradedAt: timestamp('graded_at'),
  gradedBy: uuid('graded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on quizId for fast lookups of submissions by quiz
  quizIdx: index('quiz_submissions_quiz_idx').on(table.quizId),
  // Index on studentId for fast lookups of submissions by student
  studentIdx: index('quiz_submissions_student_idx').on(table.studentId),
  // Composite index on quizId and studentId for student's quiz attempts
  quizStudentIdx: index('quiz_submissions_quiz_student_idx').on(table.quizId, table.studentId),
  // Index on gradingStatus for filtering submissions by grading status
  gradingStatusIdx: index('quiz_submissions_grading_status_idx').on(table.gradingStatus),
}));

/**
 * Assignments Table
 * File-based tasks with rubrics, due dates, and late submission policies
 * 
 * Requirements:
 * - 7.1: Assignment creation with due dates, file requirements, and rubrics
 */
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  dueDate: timestamp('due_date').notNull(),
  lateSubmissionAllowed: boolean('late_submission_allowed').default(false).notNull(),
  latePenaltyPercentage: integer('late_penalty_percentage').default(0).notNull(),
  maxPoints: integer('max_points').notNull(),
  requiresFileUpload: boolean('requires_file_upload').default(true).notNull(),
  allowedFileTypes: jsonb('allowed_file_types').notNull(),
  maxFileSizeMb: integer('max_file_size_mb').default(10).notNull(),
  rubric: jsonb('rubric'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on lessonId for fast lookups of assignments by lesson
  lessonIdx: index('assignments_lesson_idx').on(table.lessonId),
}));

/**
 * Assignment Submissions Table
 * Student work submissions with files, grading, feedback, and revision tracking
 * 
 * Requirements:
 * - 7.1: Assignment submission with file upload
 * - 7.2: File validation and storage
 * - 7.3: Late submission detection and penalty application
 * - 7.4: Rubric-based grading
 * - 7.5: Detailed feedback provision
 * - 7.6: Revision workflow with parent linking
 * 
 * Note: parentSubmissionId is a UUID field that references another submission's ID.
 * The foreign key constraint will be added via migration to avoid TypeScript
 * circular type inference issues with Drizzle ORM.
 */
export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id')
    .references(() => assignments.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: uuid('student_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  enrollmentId: uuid('enrollment_id')
    .references(() => enrollments.id, { onDelete: 'cascade' })
    .notNull(),
  fileUrl: varchar('file_url', { length: 500 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSizeBytes: integer('file_size_bytes'),
  submissionText: text('submission_text'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  isLate: boolean('is_late').default(false).notNull(),
  pointsAwarded: decimal('points_awarded', { precision: 10, scale: 2 }),
  feedback: text('feedback'),
  gradingStatus: assignmentGradingStatusEnum('grading_status').default('submitted').notNull(),
  gradedAt: timestamp('graded_at'),
  gradedBy: uuid('graded_by').references(() => users.id),
  revisionNumber: integer('revision_number').default(1).notNull(),
  // Self-referencing field - foreign key constraint added via migration
  parentSubmissionId: uuid('parent_submission_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on assignmentId for fast lookups of submissions by assignment
  assignmentIdx: index('assignment_submissions_assignment_idx').on(table.assignmentId),
  // Index on studentId for fast lookups of submissions by student
  studentIdx: index('assignment_submissions_student_idx').on(table.studentId),
  // Composite index on assignmentId and studentId for student's assignment submissions
  assignmentStudentIdx: index('assignment_submissions_assignment_student_idx').on(table.assignmentId, table.studentId),
  // Index on gradingStatus for filtering submissions by grading status
  gradingStatusIdx: index('assignment_submissions_grading_status_idx').on(table.gradingStatus),
}));

/**
 * Type exports for use in application code
 */
export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type NewQuizSubmission = typeof quizSubmissions.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type NewAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;
