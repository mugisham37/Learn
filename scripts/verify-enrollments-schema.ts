/**
 * Verification script for enrollments schema
 * 
 * This script verifies that the enrollments schema is properly defined
 * and can be imported without errors
 */

import { 
  enrollments, 
  lessonProgress, 
  certificates,
  enrollmentStatusEnum,
  progressStatusEnum,
  type Enrollment,
  type LessonProgress,
  type Certificate
} from '../src/infrastructure/database/schema/enrollments.schema.js';

console.log('✓ Enrollments schema imported successfully');

// Verify table definitions exist
if (!enrollments) {
  throw new Error('Enrollments table not defined');
}
console.log('✓ Enrollments table defined');

if (!lessonProgress) {
  throw new Error('Lesson progress table not defined');
}
console.log('✓ Lesson progress table defined');

if (!certificates) {
  throw new Error('Certificates table not defined');
}
console.log('✓ Certificates table defined');

// Verify enums exist
if (!enrollmentStatusEnum) {
  throw new Error('Enrollment status enum not defined');
}
console.log('✓ Enrollment status enum defined');

if (!progressStatusEnum) {
  throw new Error('Progress status enum not defined');
}
console.log('✓ Progress status enum defined');

// Verify types can be used
const testEnrollment: Partial<Enrollment> = {
  progressPercentage: '75.50',
  status: 'active'
};

const testProgress: Partial<LessonProgress> = {
  status: 'completed',
  timeSpentSeconds: 600
};

const testCertificate: Partial<Certificate> = {
  certificateId: 'TEST-CERT-001',
  pdfUrl: 'https://example.com/certificate.pdf'
};

console.log('✓ Type definitions working correctly');
console.log('\n✅ All enrollments schema verifications passed!');
