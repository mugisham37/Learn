-- Rollback Script for Initial Migration (0000_romantic_grandmaster.sql)
-- WARNING: This will drop all tables and data. Use with extreme caution!
-- 
-- Usage:
--   psql postgresql://postgres:password@localhost:5432/learning_platform -f migrations/rollback/0000_rollback.sql
--
-- Or from within psql:
--   \i migrations/rollback/0000_rollback.sql

-- Begin transaction for atomic rollback
BEGIN;

-- Drop all tables in reverse dependency order
-- This ensures foreign key constraints don't prevent drops

-- Analytics tables (no dependencies)
DROP TABLE IF EXISTS "analytics_events" CASCADE;
DROP TABLE IF EXISTS "student_analytics" CASCADE;
DROP TABLE IF EXISTS "course_analytics" CASCADE;

-- Notification tables
DROP TABLE IF EXISTS "notifications" CASCADE;

-- Communication tables
DROP TABLE IF EXISTS "announcements" CASCADE;
DROP TABLE IF EXISTS "discussion_posts" CASCADE;
DROP TABLE IF EXISTS "discussion_threads" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;

-- Payment tables
DROP TABLE IF EXISTS "refunds" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;

-- Certificate tables
DROP TABLE IF EXISTS "certificates" CASCADE;

-- Progress tracking tables
DROP TABLE IF EXISTS "lesson_progress" CASCADE;
DROP TABLE IF EXISTS "enrollments" CASCADE;

-- Assessment tables
DROP TABLE IF EXISTS "assignment_submissions" CASCADE;
DROP TABLE IF EXISTS "assignments" CASCADE;
DROP TABLE IF EXISTS "quiz_submissions" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "quizzes" CASCADE;

-- Course structure tables
DROP TABLE IF EXISTS "lessons" CASCADE;
DROP TABLE IF EXISTS "course_modules" CASCADE;
DROP TABLE IF EXISTS "courses" CASCADE;

-- User tables
DROP TABLE IF EXISTS "user_profiles" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop all enum types
DROP TYPE IF EXISTS "assignment_grading_status" CASCADE;
DROP TYPE IF EXISTS "grading_status" CASCADE;
DROP TYPE IF EXISTS "question_difficulty" CASCADE;
DROP TYPE IF EXISTS "question_type" CASCADE;
DROP TYPE IF EXISTS "quiz_type" CASCADE;
DROP TYPE IF EXISTS "course_status" CASCADE;
DROP TYPE IF EXISTS "difficulty" CASCADE;
DROP TYPE IF EXISTS "lesson_type" CASCADE;
DROP TYPE IF EXISTS "enrollment_status" CASCADE;
DROP TYPE IF EXISTS "progress_status" CASCADE;
DROP TYPE IF EXISTS "notification_type" CASCADE;
DROP TYPE IF EXISTS "priority" CASCADE;
DROP TYPE IF EXISTS "payment_status" CASCADE;
DROP TYPE IF EXISTS "refund_status" CASCADE;
DROP TYPE IF EXISTS "subscription_status" CASCADE;
DROP TYPE IF EXISTS "role" CASCADE;

-- Commit the transaction
COMMIT;

-- Verify all tables are dropped
SELECT 
    'Tables remaining: ' || COUNT(*) as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';

-- Verify all enums are dropped
SELECT 
    'Enums remaining: ' || COUNT(*) as status
FROM pg_type 
WHERE typtype = 'e' 
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Success message
\echo 'Rollback completed successfully!'
\echo 'All tables and enums have been dropped.'
\echo 'The database is now in a clean state.'
