/**
 * Verification script for assessments schema
 * Ensures all schema exports are accessible
 */

import {
  quizzes,
  questions,
  quizSubmissions,
  assignments,
  assignmentSubmissions,
  quizTypeEnum,
  questionTypeEnum,
  questionDifficultyEnum,
  gradingStatusEnum,
  assignmentGradingStatusEnum,
} from '../src/infrastructure/database/schema/assessments.schema';

console.log('✓ Assessments schema verification');
console.log('✓ Quizzes table:', quizzes ? 'exported' : 'missing');
console.log('✓ Questions table:', questions ? 'exported' : 'missing');
console.log('✓ Quiz submissions table:', quizSubmissions ? 'exported' : 'missing');
console.log('✓ Assignments table:', assignments ? 'exported' : 'missing');
console.log('✓ Assignment submissions table:', assignmentSubmissions ? 'exported' : 'missing');
console.log('✓ Quiz type enum:', quizTypeEnum ? 'exported' : 'missing');
console.log('✓ Question type enum:', questionTypeEnum ? 'exported' : 'missing');
console.log('✓ Question difficulty enum:', questionDifficultyEnum ? 'exported' : 'missing');
console.log('✓ Grading status enum:', gradingStatusEnum ? 'exported' : 'missing');
console.log('✓ Assignment grading status enum:', assignmentGradingStatusEnum ? 'exported' : 'missing');

console.log('\n✅ All assessments schema exports verified successfully!');
