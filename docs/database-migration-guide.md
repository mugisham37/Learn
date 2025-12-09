# Database Migration Guide

This guide provides comprehensive instructions for managing database migrations in the Learning Platform Backend.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Running Migrations](#running-migrations)
5. [Verification](#verification)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Overview

The Learning Platform uses Drizzle ORM for database schema management and migrations. The migration system:

- Generates SQL migrations from TypeScript schema definitions
- Tracks applied migrations in a journal
- Supports rollback for disaster recovery
- Provides verification tools to ensure schema correctness

### Migration Files

- **Schema Definitions**: `src/infrastructure/database/schema/*.schema.ts`
- **Generated Migrations**: `migrations/*.sql`
- **Migration Tracker**: `migrations/meta/_journal.json`
- **Rollback Scripts**: `migrations/rollback/*.sql`

## Prerequisites

### Required Software

1. **Node.js** >= 20.0.0
2. **PostgreSQL** >= 15
3. **Docker** (optional, for local development)

### Environment Setup

Ensure your `.env` file contains the correct database connection string:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/learning_platform
```

## Initial Setup

### Step 1: Start Database Services

#### Using Docker (Recommended for Development)

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Or start only PostgreSQL
docker-compose up -d postgres
```

#### Using Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create the database
createdb learning_platform

# Or using psql
psql -U postgres -c "CREATE DATABASE learning_platform;"
```

### Step 2: Verify Database Connection

```bash
# Test connection using psql
psql postgresql://postgres:password@localhost:5432/learning_platform -c "SELECT version();"
```

Expected output should show PostgreSQL version information.

### Step 3: Generate Initial Migration

The initial migration has already been generated. To regenerate (if needed):

```bash
npm run db:generate
```

This will:
- Read all schema files from `src/infrastructure/database/schema/`
- Generate SQL migration in `migrations/` directory
- Update the migration journal

### Step 4: Run the Migration

```bash
npm run db:migrate
```

This will:
- Connect to the database
- Execute all pending migrations
- Update the migration tracking table

Expected output:
```
Running migrations...
Migrations completed successfully
```

### Step 5: Verify Migration

```bash
npm run db:verify
```

This will check:
- All 24 tables were created
- All 16 enum types exist
- Foreign key constraints are in place
- Indexes are created
- Primary keys exist

Expected output:
```
✅ All verification checks passed!
The database migration was applied successfully.
```

## Running Migrations

### Development Workflow

1. **Make Schema Changes**
   ```typescript
   // Edit files in src/infrastructure/database/schema/
   export const newTable = pgTable('new_table', {
     id: uuid('id').primaryKey().defaultRandom(),
     // ... columns
   });
   ```

2. **Generate Migration**
   ```bash
   npm run db:generate
   ```

3. **Review Generated SQL**
   ```bash
   # Check the new migration file in migrations/
   cat migrations/0001_*.sql
   ```

4. **Run Migration**
   ```bash
   npm run db:migrate
   ```

5. **Verify Changes**
   ```bash
   npm run db:verify
   ```

### Production Deployment

1. **Pre-Deployment Checklist**
   - [ ] Backup production database
   - [ ] Test migration in staging environment
   - [ ] Review migration SQL for performance impact
   - [ ] Plan rollback strategy
   - [ ] Schedule maintenance window if needed

2. **Run Migration**
   ```bash
   # Set production DATABASE_URL
   export DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname"
   
   # Run migration
   npm run db:migrate
   ```

3. **Post-Deployment Verification**
   ```bash
   npm run db:verify
   ```

## Verification

### Automated Verification

The verification script checks:

```bash
npm run db:verify
```

### Manual Verification

#### Using psql

```bash
# Connect to database
psql postgresql://postgres:password@localhost:5432/learning_platform

# List all tables
\dt

# Describe a specific table
\d users

# List all enums
\dT

# List all foreign keys
\d+ users

# Check indexes
\di

# Exit
\q
```

#### Using PgAdmin

1. Open http://localhost:5050
2. Login with:
   - Email: admin@learningplatform.com
   - Password: admin
3. Connect to server:
   - Host: postgres
   - Port: 5432
   - Database: learning_platform
   - Username: postgres
   - Password: password
4. Browse schema in the left panel

### Expected Schema

**Tables (24)**:
- Users: `users`, `user_profiles`
- Courses: `courses`, `course_modules`, `lessons`
- Enrollments: `enrollments`, `lesson_progress`, `certificates`
- Assessments: `quizzes`, `questions`, `quiz_submissions`, `assignments`, `assignment_submissions`
- Communication: `messages`, `discussion_threads`, `discussion_posts`, `announcements`
- Notifications: `notifications`
- Analytics: `course_analytics`, `student_analytics`, `analytics_events`
- Payments: `payments`, `subscriptions`, `refunds`

**Enums (16)**:
- `role`, `course_status`, `difficulty`, `lesson_type`
- `enrollment_status`, `progress_status`
- `quiz_type`, `question_type`, `question_difficulty`, `grading_status`, `assignment_grading_status`
- `notification_type`, `priority`
- `payment_status`, `subscription_status`, `refund_status`

## Rollback

### When to Rollback

- Migration caused data corruption
- Application errors after migration
- Performance degradation
- Need to revert to previous schema

### Rollback Process

**⚠️ WARNING**: Rollback will delete all data in the database!

1. **Backup Current Data** (if needed)
   ```bash
   pg_dump postgresql://postgres:password@localhost:5432/learning_platform > backup.sql
   ```

2. **Run Rollback Script**
   ```bash
   psql postgresql://postgres:password@localhost:5432/learning_platform -f migrations/rollback/0000_rollback.sql
   ```

3. **Verify Rollback**
   ```bash
   psql postgresql://postgres:password@localhost:5432/learning_platform -c "\dt"
   ```
   
   Should show no tables.

4. **Re-run Migration** (if needed)
   ```bash
   npm run db:migrate
   ```

### Partial Rollback

For specific tables only:

```sql
-- Connect to database
psql postgresql://postgres:password@localhost:5432/learning_platform

-- Drop specific table
DROP TABLE IF EXISTS table_name CASCADE;

-- Verify
\dt
```

## Troubleshooting

### Issue: Connection Refused

**Symptoms**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:

1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   # or
   pg_isready -h localhost -p 5432
   ```

2. Start PostgreSQL:
   ```bash
   docker-compose up -d postgres
   ```

3. Verify DATABASE_URL in `.env`

### Issue: Database Does Not Exist

**Symptoms**:
```
Error: database "learning_platform" does not exist
```

**Solutions**:

1. Create the database:
   ```bash
   createdb learning_platform
   # or
   psql -U postgres -c "CREATE DATABASE learning_platform;"
   ```

2. Or use Docker which creates it automatically:
   ```bash
   docker-compose up -d postgres
   ```

### Issue: Permission Denied

**Symptoms**:
```
Error: permission denied for schema public
```

**Solutions**:

1. Grant permissions:
   ```sql
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
   ```

2. Or use superuser credentials in DATABASE_URL

### Issue: Migration Already Applied

**Symptoms**:
```
Error: relation "users" already exists
```

**Solutions**:

1. Check migration journal:
   ```bash
   cat migrations/meta/_journal.json
   ```

2. If tables exist but journal is empty, either:
   - Drop all tables and re-run migration
   - Or manually update journal (not recommended)

3. Recommended: Use rollback script then re-migrate:
   ```bash
   psql postgresql://postgres:password@localhost:5432/learning_platform -f migrations/rollback/0000_rollback.sql
   npm run db:migrate
   ```

### Issue: Foreign Key Constraint Violation

**Symptoms**:
```
Error: insert or update on table violates foreign key constraint
```

**Solutions**:

1. Check if referenced table exists:
   ```sql
   \dt
   ```

2. Verify foreign key constraints:
   ```sql
   \d+ table_name
   ```

3. Ensure migration order is correct (parent tables before child tables)

### Issue: Enum Type Already Exists

**Symptoms**:
```
Error: type "role" already exists
```

**Solutions**:

1. The migration handles this with `DO $ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $;`

2. If still failing, manually drop and recreate:
   ```sql
   DROP TYPE IF EXISTS role CASCADE;
   ```

## Best Practices

### Schema Design

1. **Use Descriptive Names**
   - Tables: plural nouns (`users`, `courses`)
   - Columns: snake_case (`created_at`, `user_id`)
   - Enums: singular nouns (`role`, `status`)

2. **Always Include Timestamps**
   ```typescript
   createdAt: timestamp('created_at').defaultNow().notNull(),
   updatedAt: timestamp('updated_at').defaultNow().notNull(),
   ```

3. **Use UUIDs for Primary Keys**
   ```typescript
   id: uuid('id').primaryKey().defaultRandom(),
   ```

4. **Add Indexes for Foreign Keys**
   ```typescript
   (table) => ({
     userIdx: index('table_user_idx').on(table.userId),
   })
   ```

### Migration Management

1. **Never Modify Existing Migrations**
   - Once applied, migrations are immutable
   - Create new migrations for changes

2. **Test Migrations Locally First**
   - Run in development environment
   - Verify with test data
   - Check performance impact

3. **Review Generated SQL**
   - Always review before applying
   - Check for unexpected changes
   - Verify index creation

4. **Backup Before Production Migrations**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

5. **Use Transactions**
   - Drizzle wraps migrations in transactions automatically
   - Ensures atomic application

6. **Document Complex Migrations**
   - Add comments to SQL
   - Update schema documentation
   - Note breaking changes

### Performance Considerations

1. **Create Indexes Concurrently** (for large tables)
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
   ```

2. **Avoid Locking Operations**
   - Schedule during low-traffic periods
   - Use `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` instead of NOT NULL with default

3. **Monitor Migration Duration**
   - Test with production-like data volumes
   - Plan maintenance windows accordingly

### Security

1. **Protect Sensitive Data**
   - Never log passwords or tokens
   - Use environment variables for credentials
   - Restrict database user permissions

2. **Validate Input**
   - Use CHECK constraints where appropriate
   - Enforce data integrity at database level

3. **Audit Changes**
   - Keep migration history in version control
   - Document who applied migrations and when
   - Maintain rollback scripts

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Schema Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)

## Support

For issues or questions:

1. Check this guide first
2. Review Drizzle ORM documentation
3. Check PostgreSQL logs: `docker-compose logs postgres`
4. Contact the development team
