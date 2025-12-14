-- Rollback Query Optimization Indexes Migration
-- Removes optimization indexes if needed

-- User-related indexes
DROP INDEX CONCURRENTLY IF EXISTS users_email_verified_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_role_created_at_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_active_idx;

-- Course-related indexes
DROP INDEX CONCURRENTLY IF EXISTS courses_status_published_at_idx;
DROP INDEX CONCURRENTLY IF EXISTS courses_category_difficulty_idx;
DROP INDEX CONCURRENTLY IF EXISTS courses_price_range_idx;
DROP INDEX CONCURRENTLY IF EXISTS courses_enrollment_count_idx;
DROP INDEX CONCURRENTLY IF EXISTS courses_average_rating_idx;
DROP INDEX CONCURRENTLY IF EXISTS courses_published_idx;

-- Lesson indexes
DROP INDEX CONCURRENTLY IF EXISTS lessons_type_idx;
DROP INDEX CONCURRENTLY IF EXISTS lessons_preview_idx;

-- Enrollment and progress indexes
DROP INDEX CONCURRENTLY IF EXISTS enrollments_student_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS enrollments_course_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS enrollments_progress_idx;
DROP INDEX CONCURRENTLY IF EXISTS enrollments_completed_idx;
DROP INDEX CONCURRENTLY IF EXISTS enrollments_active_idx;

-- Lesson progress indexes
DROP INDEX CONCURRENTLY IF EXISTS lesson_progress_enrollment_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS lesson_progress_lesson_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS lesson_progress_time_spent_idx;
DROP INDEX CONCURRENTLY IF EXISTS lesson_progress_completed_idx;

-- Assessment indexes
DROP INDEX CONCURRENTLY IF EXISTS quizzes_lesson_idx;
DROP INDEX CONCURRENTLY IF EXISTS quiz_submissions_quiz_student_idx;
DROP INDEX CONCURRENTLY IF EXISTS quiz_submissions_grading_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS assignment_submissions_assignment_student_idx;
DROP INDEX CONCURRENTLY IF EXISTS assignment_submissions_grading_status_idx;

-- Communication indexes
DROP INDEX CONCURRENTLY IF EXISTS messages_conversation_idx;
DROP INDEX CONCURRENTLY IF EXISTS messages_recipient_read_idx;
DROP INDEX CONCURRENTLY IF EXISTS discussion_threads_course_activity_idx;
DROP INDEX CONCURRENTLY IF EXISTS discussion_posts_thread_created_idx;

-- Notification indexes
DROP INDEX CONCURRENTLY IF EXISTS notifications_recipient_read_idx;
DROP INDEX CONCURRENTLY IF EXISTS notifications_type_created_idx;
DROP INDEX CONCURRENTLY IF EXISTS notifications_unread_idx;

-- Analytics indexes
DROP INDEX CONCURRENTLY IF EXISTS analytics_events_user_type_time_idx;
DROP INDEX CONCURRENTLY IF EXISTS analytics_events_type_time_idx;

-- Payment indexes
DROP INDEX CONCURRENTLY IF EXISTS payments_user_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS payments_course_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS payments_created_at_idx;

-- Content indexes
DROP INDEX CONCURRENTLY IF EXISTS video_assets_processing_status_idx;
DROP INDEX CONCURRENTLY IF EXISTS file_assets_course_type_idx;