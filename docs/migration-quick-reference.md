# Database Migration Quick Reference

Quick reference for common database migration tasks.

## Common Commands

### Setup & Start

```bash
# Start database services
npm run docker:up

# Stop database services
npm run docker:down

# View database logs
npm run docker:logs
```

### Migration Operations

```bash
# Generate new migration from schema changes
npm run db:generate

# Run all pending migrations
npm run db:migrate

# Verify migration was applied correctly
npm run db:verify

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Database Access

```bash
# Connect with psql
psql postgresql://postgres:password@localhost:5432/learning_platform

# Connect with PgAdmin
# Open http://localhost:5050
# Email: admin@learningplatform.com
# Password: admin
```

### Rollback

```bash
# Rollback initial migration (⚠️ DELETES ALL DATA!)
psql postgresql://postgres:password@localhost:5432/learning_platform -f migrations/rollback/0000_rollback.sql
```

## Useful psql Commands

```sql
-- List all tables
\dt

-- Describe table structure
\d table_name

-- List all enums
\dT

-- List all indexes
\di

-- List all foreign keys
SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';

-- Show table sizes
\dt+

-- Exit psql
\q
```

## Quick Checks

### Verify Database Connection

```bash
psql postgresql://postgres:password@localhost:5432/learning_platform -c "SELECT version();"
```

### Count Tables

```bash
psql postgresql://postgres:password@localhost:5432/learning_platform -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### List All Tables

```bash
psql postgresql://postgres:password@localhost:5432/learning_platform -c "\dt"
```

## Troubleshooting

### Database Not Running

```bash
# Check if container is running
docker ps | grep postgres

# Start if not running
docker-compose up -d postgres

# Check logs
docker-compose logs postgres
```

### Connection Issues

```bash
# Test connection
pg_isready -h localhost -p 5432

# Check DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

### Reset Database

```bash
# Stop services
docker-compose down

# Remove volumes (⚠️ DELETES ALL DATA!)
docker-compose down -v

# Start fresh
docker-compose up -d postgres

# Run migrations
npm run db:migrate
```

## Environment Variables

```env
# Required in .env file
DATABASE_URL=postgresql://postgres:password@localhost:5432/learning_platform
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

## File Locations

```
├── src/infrastructure/database/
│   ├── schema/              # Schema definitions
│   │   ├── users.schema.ts
│   │   ├── courses.schema.ts
│   │   └── ...
│   ├── index.ts            # Database connection
│   └── migrate.ts          # Migration runner
├── migrations/
│   ├── 0000_*.sql          # Generated migrations
│   ├── rollback/           # Rollback scripts
│   └── meta/               # Migration tracking
├── scripts/
│   └── verify-migration.ts # Verification script
└── docs/
    └── database-migration-guide.md  # Full guide
```

## Schema Overview

**24 Tables**:
- Users (2): users, user_profiles
- Courses (3): courses, course_modules, lessons
- Enrollments (3): enrollments, lesson_progress, certificates
- Assessments (5): quizzes, questions, quiz_submissions, assignments, assignment_submissions
- Communication (4): messages, discussion_threads, discussion_posts, announcements
- Notifications (1): notifications
- Analytics (3): course_analytics, student_analytics, analytics_events
- Payments (3): payments, subscriptions, refunds

**16 Enums**:
- role, course_status, difficulty, lesson_type
- enrollment_status, progress_status
- quiz_type, question_type, question_difficulty
- grading_status, assignment_grading_status
- notification_type, priority
- payment_status, subscription_status, refund_status

## Need Help?

See the full guide: `docs/database-migration-guide.md`
