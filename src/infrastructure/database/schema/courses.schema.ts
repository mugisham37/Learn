/**
 * Courses Schema
 * 
 * Database schema definitions for course management
 * Includes courses, course modules, and lessons tables
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
  index, 
  uniqueIndex 
} from 'drizzle-orm/pg-core';

import { users } from './users.schema';

/**
 * Difficulty Enum
 * Defines course difficulty levels
 */
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);

/**
 * Course Status Enum
 * Defines the lifecycle states of a course
 */
export const courseStatusEnum = pgEnum('course_status', ['draft', 'pending_review', 'published', 'archived']);

/**
 * Lesson Type Enum
 * Defines the types of lessons that can be created
 */
export const lessonTypeEnum = pgEnum('lesson_type', ['video', 'text', 'quiz', 'assignment']);

/**
 * Courses Table
 * Main course entity with metadata, instructor, status, and pricing
 * 
 * Requirements:
 * - 3.1: Course creation with metadata and slug generation
 */
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  instructorId: uuid('instructor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  enrollmentLimit: integer('enrollment_limit'),
  enrollmentCount: integer('enrollment_count').default(0).notNull(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalReviews: integer('total_reviews').default(0).notNull(),
  status: courseStatusEnum('status').default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on instructorId for fast lookups of courses by instructor
  instructorIdx: index('courses_instructor_idx').on(table.instructorId),
  // Index on status for filtering published/draft courses
  statusIdx: index('courses_status_idx').on(table.status),
  // Index on category for course discovery and filtering
  categoryIdx: index('courses_category_idx').on(table.category),
  // Unique index on slug for URL-based course lookups
  slugIdx: uniqueIndex('courses_slug_idx').on(table.slug),
}));

/**
 * Course Modules Table
 * Logical grouping of lessons within a course with ordering and prerequisites
 * 
 * Requirements:
 * - 3.2: Module management with sequential ordering
 * 
 * Note: prerequisiteModuleId is a UUID field that references another module's ID.
 * The foreign key constraint will be added via migration to avoid TypeScript
 * circular type inference issues with Drizzle ORM.
 */
export const courseModules = pgTable('course_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  orderNumber: integer('order_number').notNull(),
  durationMinutes: integer('duration_minutes').default(0).notNull(),
  // Self-referencing field - foreign key constraint added via migration
  prerequisiteModuleId: uuid('prerequisite_module_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Composite unique index ensuring unique order numbers per course
  courseOrderIdx: uniqueIndex('modules_course_order_idx').on(table.courseId, table.orderNumber),
}));

/**
 * Lessons Table
 * Individual units of educational content with type-specific fields
 * 
 * Requirements:
 * - 3.3: Lesson creation with type-specific validation
 */
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id')
    .references(() => courseModules.id, { onDelete: 'cascade' })
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  lessonType: lessonTypeEnum('lesson_type').notNull(),
  contentUrl: varchar('content_url', { length: 500 }),
  contentText: text('content_text'),
  durationMinutes: integer('duration_minutes'),
  orderNumber: integer('order_number').notNull(),
  isPreview: boolean('is_preview').default(false).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Composite unique index ensuring unique order numbers per module
  moduleOrderIdx: uniqueIndex('lessons_module_order_idx').on(table.moduleId, table.orderNumber),
}));

/**
 * Type exports for use in application code
 */
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseModule = typeof courseModules.$inferSelect;
export type NewCourseModule = typeof courseModules.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
