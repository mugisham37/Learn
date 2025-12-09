/**
 * Verification script for schema exports
 * 
 * This script verifies that all schemas can be imported from the main index
 */

import { 
  // Users schema
  users,
  userProfiles,
  roleEnum,
  
  // Courses schema
  courses,
  courseModules,
  lessons,
  difficultyEnum,
  courseStatusEnum,
  lessonTypeEnum,
  
  // Enrollments schema
  enrollments,
  lessonProgress,
  certificates,
  enrollmentStatusEnum,
  progressStatusEnum
} from '../src/infrastructure/database/schema/index.js';

console.log('✓ All schemas imported from main index successfully');

// Verify all tables exist
const tables = [
  { name: 'users', table: users },
  { name: 'userProfiles', table: userProfiles },
  { name: 'courses', table: courses },
  { name: 'courseModules', table: courseModules },
  { name: 'lessons', table: lessons },
  { name: 'enrollments', table: enrollments },
  { name: 'lessonProgress', table: lessonProgress },
  { name: 'certificates', table: certificates }
];

for (const { name, table } of tables) {
  if (!table) {
    throw new Error(`${name} table not defined`);
  }
  console.log(`✓ ${name} table exported`);
}

// Verify all enums exist
const enums = [
  { name: 'roleEnum', enum: roleEnum },
  { name: 'difficultyEnum', enum: difficultyEnum },
  { name: 'courseStatusEnum', enum: courseStatusEnum },
  { name: 'lessonTypeEnum', enum: lessonTypeEnum },
  { name: 'enrollmentStatusEnum', enum: enrollmentStatusEnum },
  { name: 'progressStatusEnum', enum: progressStatusEnum }
];

for (const { name, enum: enumDef } of enums) {
  if (!enumDef) {
    throw new Error(`${name} not defined`);
  }
  console.log(`✓ ${name} exported`);
}

console.log('\n✅ All schema exports verified successfully!');
