-- Query Optimization Indexes Migration
-- Adds strategic indexes for improved query performance
-- Requirements: 15.1 - Database query optimization

-- User-related optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_email_verified_idx ON users (email_verified);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_role_created_at_idx ON users (role, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_active_idx ON users (id) WHERE deleted_at IS NULL;

-- Course-related optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_status_published_at_idx ON courses (status, published_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_category_difficulty_idx ON courses (category, difficulty);
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_price_range_idx ON courses (price);
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_enrollment_count_idx ON courses (enrollment_count);
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_average_rating_idx ON courses (average_rating);
CREATE INDEX CONCURRENTLY IF NOT EXISTS courses_published_idx ON courses (id) WHERE status = 'published';

-- Lesson optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS lessons_type_idx ON lessons (lesson_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS lessons_preview_idx ON lessons (is_preview);

-- Enrollment and progress optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS enrollments_student_status_idx ON enrollments (student_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS enrollments_course_status_idx ON enrollments (course_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS enrollments_progress_idx ON enrollments (progress_percentage);
CREATE INDEX CONCURRENTLY IF NOT EXISTS enrollments_completed_idx ON enrollments (completed_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS enrollments_active_idx ON enrollments (student_id, course_id) WHERE status = 'active';

-- Lesson progress optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS lesson_progress_enrollment_status_idx ON lesson_progress (enrollment_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS lesson_progress_lesson_status_idx ON lesson_progress (lesson_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS lesson_progress_time_spent_idx ON lesson_progress (time_spent_seconds);
CREATE INDEX CONCURRENTLY IF NOT EXISTS lesson_progress_completed_idx ON lesson_progress (enrollment_id) WHERE status = 'completed';

-- Assessment optimizations (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quizzes') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS quizzes_lesson_idx ON quizzes (lesson_id);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quiz_submissions') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS quiz_submissions_quiz_student_idx ON quiz_submissions (quiz_id, student_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS quiz_submissions_grading_status_idx ON quiz_submissions (grading_status);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignment_submissions') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS assignment_submissions_assignment_student_idx ON assignment_submissions (assignment_id, student_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS assignment_submissions_grading_status_idx ON assignment_submissions (grading_status);
    END IF;
END $$;

-- Communication optimizations (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_recipient_read_idx ON messages (recipient_id, is_read);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discussion_threads') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS discussion_threads_course_activity_idx ON discussion_threads (course_id, last_activity_at);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discussion_posts') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS discussion_posts_thread_created_idx ON discussion_posts (thread_id, created_at);
    END IF;
END $$;

-- Notification optimizations (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_recipient_read_idx ON notifications (recipient_id, is_read);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_type_created_idx ON notifications (notification_type, created_at);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_unread_idx ON notifications (recipient_id) WHERE is_read = false;
    END IF;
END $$;

-- Analytics optimizations (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_events_user_type_time_idx ON analytics_events (user_id, event_type, timestamp);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_events_type_time_idx ON analytics_events (event_type, timestamp);
    END IF;
END $$;

-- Payment optimizations (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_user_status_idx ON payments (user_id, status);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_course_status_idx ON payments (course_id, status);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_created_at_idx ON payments (created_at);
    END IF;
END $$;

-- Content optimizations (if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'video_assets') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS video_assets_processing_status_idx ON video_assets (processing_status);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'file_assets') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS file_assets_course_type_idx ON file_assets (course_id, file_type);
    END IF;
END $$;

-- Update table statistics for better query planning
ANALYZE users;
ANALYZE user_profiles;
ANALYZE courses;
ANALYZE course_modules;
ANALYZE lessons;
ANALYZE enrollments;
ANALYZE lesson_progress;
ANALYZE certificates;

-- Analyze other tables if they exist
DO $$
DECLARE
    table_name text;
    tables_to_analyze text[] := ARRAY[
        'quizzes', 'questions', 'quiz_submissions', 'assignments', 'assignment_submissions',
        'messages', 'discussion_threads', 'discussion_posts', 'announcements',
        'notifications', 'analytics_events', 'payments', 'subscriptions', 'refunds',
        'video_assets', 'file_assets'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_analyze
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = table_name) THEN
            EXECUTE 'ANALYZE ' || table_name;
        END IF;
    END LOOP;
END $$;