/**
 * Additional Database Indexes for Query Optimization
 * 
 * Strategic indexes to optimize frequently used queries based on analysis
 * Implements requirement 15.1 for database query optimization
 */

import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from '../../../shared/utils/logger';

/**
 * Index Definition
 */
interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'partial';
  condition?: string;
  description: string;
}

/**
 * Strategic indexes for query optimization
 */
const OPTIMIZATION_INDEXES: IndexDefinition[] = [
  // User-related optimizations
  {
    name: 'users_email_verified_idx',
    table: 'users',
    columns: ['email_verified'],
    type: 'btree',
    description: 'Optimize queries filtering by email verification status',
  },
  {
    name: 'users_role_created_at_idx',
    table: 'users',
    columns: ['role', 'created_at'],
    type: 'btree',
    description: 'Composite index for role-based queries with date ordering',
  },
  {
    name: 'users_active_idx',
    table: 'users',
    columns: ['id'],
    type: 'partial',
    condition: 'deleted_at IS NULL',
    description: 'Partial index for active (non-deleted) users',
  },

  // Course-related optimizations
  {
    name: 'courses_status_published_at_idx',
    table: 'courses',
    columns: ['status', 'published_at'],
    type: 'btree',
    description: 'Optimize published course queries with date ordering',
  },
  {
    name: 'courses_category_difficulty_idx',
    table: 'courses',
    columns: ['category', 'difficulty'],
    type: 'btree',
    description: 'Composite index for course filtering by category and difficulty',
  },
  {
    name: 'courses_price_range_idx',
    table: 'courses',
    columns: ['price'],
    type: 'btree',
    description: 'Optimize price range queries for course discovery',
  },
  {
    name: 'courses_enrollment_count_idx',
    table: 'courses',
    columns: ['enrollment_count'],
    type: 'btree',
    description: 'Optimize popularity-based course sorting',
  },
  {
    name: 'courses_average_rating_idx',
    table: 'courses',
    columns: ['average_rating'],
    type: 'btree',
    description: 'Optimize rating-based course sorting',
  },
  {
    name: 'courses_published_idx',
    table: 'courses',
    columns: ['id'],
    type: 'partial',
    condition: "status = 'published'",
    description: 'Partial index for published courses only',
  },

  // Module and lesson optimizations
  {
    name: 'course_modules_course_order_idx',
    table: 'course_modules',
    columns: ['course_id', 'order_number'],
    type: 'btree',
    description: 'Optimize module ordering within courses (already exists as unique)',
  },
  {
    name: 'lessons_module_order_idx',
    table: 'lessons',
    columns: ['module_id', 'order_number'],
    type: 'btree',
    description: 'Optimize lesson ordering within modules (already exists as unique)',
  },
  {
    name: 'lessons_type_idx',
    table: 'lessons',
    columns: ['lesson_type'],
    type: 'btree',
    description: 'Optimize queries filtering by lesson type',
  },
  {
    name: 'lessons_preview_idx',
    table: 'lessons',
    columns: ['is_preview'],
    type: 'btree',
    description: 'Optimize queries for preview lessons',
  },

  // Enrollment and progress optimizations
  {
    name: 'enrollments_student_status_idx',
    table: 'enrollments',
    columns: ['student_id', 'status'],
    type: 'btree',
    description: 'Optimize student enrollment queries by status',
  },
  {
    name: 'enrollments_course_status_idx',
    table: 'enrollments',
    columns: ['course_id', 'status'],
    type: 'btree',
    description: 'Optimize course enrollment queries by status',
  },
  {
    name: 'enrollments_progress_idx',
    table: 'enrollments',
    columns: ['progress_percentage'],
    type: 'btree',
    description: 'Optimize progress-based queries',
  },
  {
    name: 'enrollments_completed_idx',
    table: 'enrollments',
    columns: ['completed_at'],
    type: 'btree',
    description: 'Optimize completion date queries',
  },
  {
    name: 'enrollments_active_idx',
    table: 'enrollments',
    columns: ['student_id', 'course_id'],
    type: 'partial',
    condition: "status = 'active'",
    description: 'Partial index for active enrollments only',
  },

  // Lesson progress optimizations
  {
    name: 'lesson_progress_enrollment_status_idx',
    table: 'lesson_progress',
    columns: ['enrollment_id', 'status'],
    type: 'btree',
    description: 'Optimize progress queries by status',
  },
  {
    name: 'lesson_progress_lesson_status_idx',
    table: 'lesson_progress',
    columns: ['lesson_id', 'status'],
    type: 'btree',
    description: 'Optimize lesson-specific progress queries',
  },
  {
    name: 'lesson_progress_time_spent_idx',
    table: 'lesson_progress',
    columns: ['time_spent_seconds'],
    type: 'btree',
    description: 'Optimize time-based analytics queries',
  },
  {
    name: 'lesson_progress_completed_idx',
    table: 'lesson_progress',
    columns: ['enrollment_id'],
    type: 'partial',
    condition: "status = 'completed'",
    description: 'Partial index for completed lessons only',
  },

  // Assessment optimizations
  {
    name: 'quizzes_lesson_idx',
    table: 'quizzes',
    columns: ['lesson_id'],
    type: 'btree',
    description: 'Optimize quiz lookups by lesson',
  },
  {
    name: 'quiz_submissions_quiz_student_idx',
    table: 'quiz_submissions',
    columns: ['quiz_id', 'student_id'],
    type: 'btree',
    description: 'Optimize quiz submission queries',
  },
  {
    name: 'quiz_submissions_grading_status_idx',
    table: 'quiz_submissions',
    columns: ['grading_status'],
    type: 'btree',
    description: 'Optimize grading workflow queries',
  },
  {
    name: 'assignment_submissions_assignment_student_idx',
    table: 'assignment_submissions',
    columns: ['assignment_id', 'student_id'],
    type: 'btree',
    description: 'Optimize assignment submission queries',
  },
  {
    name: 'assignment_submissions_grading_status_idx',
    table: 'assignment_submissions',
    columns: ['grading_status'],
    type: 'btree',
    description: 'Optimize assignment grading workflow',
  },

  // Communication optimizations
  {
    name: 'messages_conversation_idx',
    table: 'messages',
    columns: ['conversation_id', 'created_at'],
    type: 'btree',
    description: 'Optimize message retrieval by conversation with ordering',
  },
  {
    name: 'messages_recipient_read_idx',
    table: 'messages',
    columns: ['recipient_id', 'is_read'],
    type: 'btree',
    description: 'Optimize unread message queries',
  },
  {
    name: 'discussion_threads_course_activity_idx',
    table: 'discussion_threads',
    columns: ['course_id', 'last_activity_at'],
    type: 'btree',
    description: 'Optimize discussion thread queries with activity ordering',
  },
  {
    name: 'discussion_posts_thread_created_idx',
    table: 'discussion_posts',
    columns: ['thread_id', 'created_at'],
    type: 'btree',
    description: 'Optimize post retrieval by thread with chronological ordering',
  },

  // Notification optimizations
  {
    name: 'notifications_recipient_read_idx',
    table: 'notifications',
    columns: ['recipient_id', 'is_read'],
    type: 'btree',
    description: 'Optimize unread notification queries',
  },
  {
    name: 'notifications_type_created_idx',
    table: 'notifications',
    columns: ['notification_type', 'created_at'],
    type: 'btree',
    description: 'Optimize notification queries by type with date ordering',
  },
  {
    name: 'notifications_unread_idx',
    table: 'notifications',
    columns: ['recipient_id'],
    type: 'partial',
    condition: 'is_read = false',
    description: 'Partial index for unread notifications only',
  },

  // Analytics optimizations
  {
    name: 'analytics_events_user_type_time_idx',
    table: 'analytics_events',
    columns: ['user_id', 'event_type', 'timestamp'],
    type: 'btree',
    description: 'Composite index for user event analysis',
  },
  {
    name: 'analytics_events_type_time_idx',
    table: 'analytics_events',
    columns: ['event_type', 'timestamp'],
    type: 'btree',
    description: 'Optimize event type analysis over time',
  },

  // Payment optimizations
  {
    name: 'payments_user_status_idx',
    table: 'payments',
    columns: ['user_id', 'status'],
    type: 'btree',
    description: 'Optimize payment queries by user and status',
  },
  {
    name: 'payments_course_status_idx',
    table: 'payments',
    columns: ['course_id', 'status'],
    type: 'btree',
    description: 'Optimize course revenue queries',
  },
  {
    name: 'payments_created_at_idx',
    table: 'payments',
    columns: ['created_at'],
    type: 'btree',
    description: 'Optimize time-based payment analytics',
  },

  // Content optimizations
  {
    name: 'video_assets_processing_status_idx',
    table: 'video_assets',
    columns: ['processing_status'],
    type: 'btree',
    description: 'Optimize video processing status queries',
  },
  {
    name: 'file_assets_course_type_idx',
    table: 'file_assets',
    columns: ['course_id', 'file_type'],
    type: 'btree',
    description: 'Optimize file queries by course and type',
  },
];

/**
 * Create optimization indexes
 */
export async function createOptimizationIndexes(db: NodePgDatabase<any>): Promise<void> {
  logger.info('Creating database optimization indexes...');

  for (const index of OPTIMIZATION_INDEXES) {
    try {
      await createIndex(db, index);
      logger.info(`Created index: ${index.name}`, { 
        table: index.table, 
        columns: index.columns,
        description: index.description 
      });
    } catch (error) {
      // Index might already exist, log warning but continue
      logger.warn(`Failed to create index ${index.name}`, { error });
    }
  }

  logger.info('Database optimization indexes creation completed');
}

/**
 * Create a single index
 */
async function createIndex(db: NodePgDatabase<any>, index: IndexDefinition): Promise<void> {
  let indexSql: string;

  if (index.type === 'partial' && index.condition) {
    // Partial index
    indexSql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns.join(', ')}) WHERE ${index.condition}`;
  } else {
    // Regular index
    const indexType = index.type === 'btree' ? '' : ` USING ${index.type}`;
    indexSql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table}${indexType} (${index.columns.join(', ')})`;
  }

  await db.execute(sql.raw(indexSql));
}

/**
 * Drop optimization indexes (for rollback)
 */
export async function dropOptimizationIndexes(db: NodePgDatabase<any>): Promise<void> {
  logger.info('Dropping database optimization indexes...');

  for (const index of OPTIMIZATION_INDEXES) {
    try {
      await db.execute(sql.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${index.name}`));
      logger.info(`Dropped index: ${index.name}`);
    } catch (error) {
      logger.warn(`Failed to drop index ${index.name}`, { error });
    }
  }

  logger.info('Database optimization indexes removal completed');
}

/**
 * Analyze index usage and effectiveness
 */
export async function analyzeIndexUsage(db: NodePgDatabase<any>): Promise<{
  unusedIndexes: string[];
  heavilyUsedIndexes: string[];
  indexSizes: Array<{ name: string; size: string; table: string }>;
}> {
  try {
    // Get unused indexes
    const unusedResult = await db.execute(sql.raw(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
      ORDER BY schemaname, tablename, indexname
    `));

    // Get heavily used indexes
    const heavyUsageResult = await db.execute(sql.raw(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE idx_tup_read > 10000 OR idx_tup_fetch > 10000
      ORDER BY (idx_tup_read + idx_tup_fetch) DESC
      LIMIT 20
    `));

    // Get index sizes
    const sizeResult = await db.execute(sql.raw(`
      SELECT 
        t.tablename,
        indexname,
        pg_size_pretty(pg_relation_size(c.oid)) AS size
      FROM pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      LEFT JOIN pg_index i ON i.indrelid = c.oid
      LEFT JOIN pg_class c2 ON c2.oid = i.indexrelid
      WHERE t.schemaname = 'public' AND c2.relname IS NOT NULL
      ORDER BY pg_relation_size(c2.oid) DESC
    `));

    return {
      unusedIndexes: unusedResult.map((row: any) => row.indexname),
      heavilyUsedIndexes: heavyUsageResult.map((row: any) => row.indexname),
      indexSizes: sizeResult.map((row: any) => ({
        name: row.indexname,
        size: row.size,
        table: row.tablename,
      })),
    };
  } catch (error) {
    logger.error('Failed to analyze index usage', { error });
    throw error;
  }
}

/**
 * Update table statistics for better query planning
 */
export async function updateTableStatistics(db: NodePgDatabase<any>): Promise<void> {
  logger.info('Updating table statistics for query optimization...');

  const tables = [
    'users', 'user_profiles', 'courses', 'course_modules', 'lessons',
    'enrollments', 'lesson_progress', 'certificates', 'quizzes', 'questions',
    'quiz_submissions', 'assignments', 'assignment_submissions',
    'messages', 'discussion_threads', 'discussion_posts', 'announcements',
    'notifications', 'analytics_events', 'payments', 'subscriptions', 'refunds',
    'video_assets', 'file_assets'
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`ANALYZE ${table}`));
      logger.debug(`Updated statistics for table: ${table}`);
    } catch (error) {
      logger.warn(`Failed to update statistics for table ${table}`, { error });
    }
  }

  logger.info('Table statistics update completed');
}