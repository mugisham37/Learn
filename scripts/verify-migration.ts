/**
 * Migration Verification Script
 * 
 * Verifies that the database migration was applied correctly by checking:
 * - All expected tables exist
 * - All expected enums exist
 * - All foreign key constraints are in place
 * - All indexes are created
 * 
 * Usage: tsx scripts/verify-migration.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface VerificationResult {
  category: string;
  expected: number;
  actual: number;
  status: 'PASS' | 'FAIL';
  details?: string[];
}

const EXPECTED_TABLES = [
  'users',
  'user_profiles',
  'courses',
  'course_modules',
  'lessons',
  'enrollments',
  'lesson_progress',
  'certificates',
  'quizzes',
  'questions',
  'quiz_submissions',
  'assignments',
  'assignment_submissions',
  'messages',
  'discussion_threads',
  'discussion_posts',
  'announcements',
  'notifications',
  'course_analytics',
  'student_analytics',
  'analytics_events',
  'payments',
  'subscriptions',
  'refunds',
];

const EXPECTED_ENUMS = [
  'role',
  'course_status',
  'difficulty',
  'lesson_type',
  'enrollment_status',
  'progress_status',
  'quiz_type',
  'question_type',
  'question_difficulty',
  'grading_status',
  'assignment_grading_status',
  'notification_type',
  'priority',
  'payment_status',
  'subscription_status',
  'refund_status',
];

async function verifyTables(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const actualTables = result.rows.map((row) => row.table_name);
  const missingTables = EXPECTED_TABLES.filter((t) => !actualTables.includes(t));
  const extraTables = actualTables.filter((t) => !EXPECTED_TABLES.includes(t));

  const details: string[] = [];
  if (missingTables.length > 0) {
    details.push(`Missing tables: ${missingTables.join(', ')}`);
  }
  if (extraTables.length > 0) {
    details.push(`Extra tables: ${extraTables.join(', ')}`);
  }

  return {
    category: 'Tables',
    expected: EXPECTED_TABLES.length,
    actual: actualTables.length,
    status: missingTables.length === 0 && extraTables.length === 0 ? 'PASS' : 'FAIL',
    details: details.length > 0 ? details : undefined,
  };
}

async function verifyEnums(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT typname 
    FROM pg_type 
    WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY typname
  `);

  const actualEnums = result.rows.map((row) => row.typname);
  const missingEnums = EXPECTED_ENUMS.filter((e) => !actualEnums.includes(e));
  const extraEnums = actualEnums.filter((e) => !EXPECTED_ENUMS.includes(e));

  const details: string[] = [];
  if (missingEnums.length > 0) {
    details.push(`Missing enums: ${missingEnums.join(', ')}`);
  }
  if (extraEnums.length > 0) {
    details.push(`Extra enums: ${extraEnums.join(', ')}`);
  }

  return {
    category: 'Enums',
    expected: EXPECTED_ENUMS.length,
    actual: actualEnums.length,
    status: missingEnums.length === 0 && extraEnums.length === 0 ? 'PASS' : 'FAIL',
    details: details.length > 0 ? details : undefined,
  };
}

async function verifyForeignKeys(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
  `);

  const actualCount = parseInt(result.rows[0].count);
  // We expect many foreign keys based on the schema
  const expectedMinimum = 30; // Minimum expected foreign keys

  return {
    category: 'Foreign Keys',
    expected: expectedMinimum,
    actual: actualCount,
    status: actualCount >= expectedMinimum ? 'PASS' : 'FAIL',
    details: actualCount < expectedMinimum ? [`Expected at least ${expectedMinimum} foreign keys`] : undefined,
  };
}

async function verifyIndexes(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
  `);

  const actualCount = parseInt(result.rows[0].count);
  // We expect many indexes based on the schema
  const expectedMinimum = 40; // Minimum expected indexes (excluding primary keys)

  return {
    category: 'Indexes',
    expected: expectedMinimum,
    actual: actualCount,
    status: actualCount >= expectedMinimum ? 'PASS' : 'FAIL',
    details: actualCount < expectedMinimum ? [`Expected at least ${expectedMinimum} indexes`] : undefined,
  };
}

async function verifyPrimaryKeys(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'PRIMARY KEY'
      AND table_schema = 'public'
  `);

  const actualCount = parseInt(result.rows[0].count);
  const expectedCount = EXPECTED_TABLES.length;

  return {
    category: 'Primary Keys',
    expected: expectedCount,
    actual: actualCount,
    status: actualCount === expectedCount ? 'PASS' : 'FAIL',
    details: actualCount !== expectedCount ? [`Expected ${expectedCount} primary keys, found ${actualCount}`] : undefined,
  };
}

async function verifyUniqueConstraints(): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'UNIQUE'
      AND table_schema = 'public'
  `);

  const actualCount = parseInt(result.rows[0].count);
  const expectedMinimum = 10; // Minimum expected unique constraints

  return {
    category: 'Unique Constraints',
    expected: expectedMinimum,
    actual: actualCount,
    status: actualCount >= expectedMinimum ? 'PASS' : 'FAIL',
    details: actualCount < expectedMinimum ? [`Expected at least ${expectedMinimum} unique constraints`] : undefined,
  };
}

async function runVerification(): Promise<void> {
  console.log('🔍 Verifying Database Migration...\n');
  console.log('=' .repeat(80));

  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Run all verification checks
    const results: VerificationResult[] = await Promise.all([
      verifyTables(),
      verifyEnums(),
      verifyPrimaryKeys(),
      verifyForeignKeys(),
      verifyIndexes(),
      verifyUniqueConstraints(),
    ]);

    // Display results
    console.log('Verification Results:');
    console.log('-'.repeat(80));

    let allPassed = true;
    for (const result of results) {
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${statusIcon} ${result.category.padEnd(20)} Expected: ${result.expected.toString().padStart(3)}  Actual: ${result.actual.toString().padStart(3)}  [${result.status}]`);
      
      if (result.details) {
        result.details.forEach((detail) => {
          console.log(`   ⚠️  ${detail}`);
        });
      }

      if (result.status === 'FAIL') {
        allPassed = false;
      }
    }

    console.log('=' .repeat(80));

    if (allPassed) {
      console.log('\n✅ All verification checks passed!');
      console.log('The database migration was applied successfully.\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some verification checks failed!');
      console.log('Please review the migration and fix any issues.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run verification
void runVerification();
