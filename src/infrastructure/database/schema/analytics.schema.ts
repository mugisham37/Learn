/**
 * Analytics Schema
 * 
 * Database schema definitions for analytics and reporting
 * Includes course_analytics, student_analytics, and analytics_events tables
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  integer, 
  decimal, 
  timestamp, 
  jsonb, 
  index
} from 'drizzle-orm/pg-core';

import { courses, lessons } from './courses.schema';
import { users } from './users.schema';

/**
 * Course Analytics Table
 * Aggregated metrics and insights about course performance
 * 
 * Requirements:
 * - 12.1: Course analytics aggregation with enrollment, completion, and revenue metrics
 * - 12.7: Analytics event logging for tracking user actions
 */
export const courseAnalytics = pgTable('course_analytics', {
  courseId: uuid('course_id')
    .primaryKey()
    .references(() => courses.id, { onDelete: 'cascade' }),
  totalEnrollments: integer('total_enrollments').default(0).notNull(),
  activeEnrollments: integer('active_enrollments').default(0).notNull(),
  completionCount: integer('completion_count').default(0).notNull(),
  completionRate: decimal('completion_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0').notNull(),
  averageTimeToCompletionDays: integer('average_time_to_completion_days'),
  dropoutRate: decimal('dropout_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  mostDifficultLessonId: uuid('most_difficult_lesson_id')
    .references(() => lessons.id, { onDelete: 'set null' }),
  engagementMetrics: jsonb('engagement_metrics').default({}).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

/**
 * Student Analytics Table
 * Aggregated metrics and insights about student performance and engagement
 * 
 * Requirements:
 * - 12.2: Student analytics aggregation with course progress, scores, and engagement metrics
 * - 12.7: Analytics event logging for tracking user actions
 */
export const studentAnalytics = pgTable('student_analytics', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalCoursesEnrolled: integer('total_courses_enrolled').default(0).notNull(),
  coursesCompleted: integer('courses_completed').default(0).notNull(),
  coursesInProgress: integer('courses_in_progress').default(0).notNull(),
  averageQuizScore: decimal('average_quiz_score', { precision: 5, scale: 2 }),
  totalTimeInvestedMinutes: integer('total_time_invested_minutes').default(0).notNull(),
  currentStreakDays: integer('current_streak_days').default(0).notNull(),
  longestStreakDays: integer('longest_streak_days').default(0).notNull(),
  badgesEarned: jsonb('badges_earned').default([]).notNull(),
  skillRatings: jsonb('skill_ratings').default({}).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

/**
 * Analytics Events Table
 * Raw event data for tracking user actions and system events
 * 
 * Requirements:
 * - 12.7: Analytics event logging with timestamp, user, event type, and contextual data
 */
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: jsonb('event_data').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  // Index on userId for fast lookups of events by user
  userIdx: index('analytics_events_user_idx').on(table.userId),
  // Index on eventType for filtering by event type
  eventTypeIdx: index('analytics_events_event_type_idx').on(table.eventType),
  // Index on timestamp for chronological queries and time-based filtering
  timestampIdx: index('analytics_events_timestamp_idx').on(table.timestamp),
  // Composite index on userId and timestamp for user event history
  userTimestampIdx: index('analytics_events_user_timestamp_idx').on(table.userId, table.timestamp),
  // Composite index on eventType and timestamp for event type analysis over time
  eventTypeTimestampIdx: index('analytics_events_event_type_timestamp_idx').on(table.eventType, table.timestamp),
}));

/**
 * Type exports for use in application code
 */
export type CourseAnalytics = typeof courseAnalytics.$inferSelect;
export type NewCourseAnalytics = typeof courseAnalytics.$inferInsert;
export type StudentAnalytics = typeof studentAnalytics.$inferSelect;
export type NewStudentAnalytics = typeof studentAnalytics.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
