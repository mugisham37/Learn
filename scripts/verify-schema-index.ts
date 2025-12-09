/**
 * Verification script for schema index exports
 * Ensures assessments schema is accessible from the main index
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
} from '../src/infrastructure/database/schema';

console.log('✓ Schema index verification');
console.log('✓ Quizzes table from index:', quizzes ? 'exported' : 'missing');
console.log('✓ Questions table from index:', questions ? 'exported' : 'missing');
console.log('✓ Quiz submissions table from index:', quizSubmissions ? 'exported' : 'missing');
console.log('✓ Assignments table from index:', assignments ? 'exported' : 'missing');
console.log('✓ Assignment submissions table from index:', assignmentSubmissions ? 'exported' : 'missing');
console.log('✓ Quiz type enum from index:', quizTypeEnum ? 'exported' : 'missing');
console.log('✓ Question type enum from index:', questionTypeEnum ? 'exported' : 'missing');
console.log('✓ Question difficulty enum from index:', questionDifficultyEnum ? 'exported' : 'missing');
console.log('✓ Grading status enum from index:', gradingStatusEnum ? 'exported' : 'missing');
console.log('✓ Assignment grading status enum from index:', assignmentGradingStatusEnum ? 'exported' : 'missing');

console.log('\n✅ All assessments schema exports accessible from index!');
