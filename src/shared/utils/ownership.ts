/**
 * Ownership Verification Utilities
 * 
 * Provides ownership verification functions for different resource types.
 * These functions check if a user owns or has permission to access a resource.
 * 
 * These functions should be registered with the middleware system during
 * application initialization using registerOwnershipVerifier().
 * 
 * @example
 * // In application initialization (src/index.ts or module initialization)
 * import { registerOwnershipVerifier } from '@shared/middleware/index.js';
 * import {
 *   verifyCourseOwnership,
 *   verifyEnrollmentOwnership,
 *   verifyAssignmentSubmissionOwnership,
 *   verifyQuizSubmissionOwnership,
 *   verifyMessageOwnership,
 *   verifyDiscussionThreadOwnership,
 *   verifyDiscussionPostOwnership,
 * } from '@shared/utils/ownership.js';
 * 
 * // Register all ownership verifiers
 * registerOwnershipVerifier('course', verifyCourseOwnership);
 * registerOwnershipVerifier('enrollment', verifyEnrollmentOwnership);
 * registerOwnershipVerifier('assignment_submission', verifyAssignmentSubmissionOwnership);
 * registerOwnershipVerifier('quiz_submission', verifyQuizSubmissionOwnership);
 * registerOwnershipVerifier('message', verifyMessageOwnership);
 * registerOwnershipVerifier('discussion_thread', verifyDiscussionThreadOwnership);
 * registerOwnershipVerifier('discussion_post', verifyDiscussionPostOwnership);
 * 
 * Requirements: 2.4
 */

import { sql } from 'drizzle-orm';

import { getReadDb } from '../../infrastructure/database/index.js';

/**
 * Verify if a user owns a course (is the instructor)
 * 
 * @param userId - ID of the user to check
 * @param courseId - ID of the course
 * @returns True if user is the course instructor, false otherwise
 */
export async function verifyCourseOwnership(
  userId: string,
  courseId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the instructor of the course
    const result = await db.execute(
      sql`SELECT instructor_id FROM courses WHERE id = ${courseId} AND deleted_at IS NULL`
    );

    if (result.rows.length === 0) {
      // Course not found
      return false;
    }

    const course = result.rows[0] as { instructor_id: string };
    return course.instructor_id === userId;
  } catch (error) {
    console.error('Error verifying course ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns an enrollment (is the enrolled student)
 * 
 * @param userId - ID of the user to check
 * @param enrollmentId - ID of the enrollment
 * @returns True if user is the enrolled student, false otherwise
 */
export async function verifyEnrollmentOwnership(
  userId: string,
  enrollmentId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the student in the enrollment
    const result = await db.execute(
      sql`SELECT student_id FROM enrollments WHERE id = ${enrollmentId}`
    );

    if (result.rows.length === 0) {
      // Enrollment not found
      return false;
    }

    const enrollment = result.rows[0] as { student_id: string };
    return enrollment.student_id === userId;
  } catch (error) {
    console.error('Error verifying enrollment ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns an assignment submission (is the submitting student)
 * 
 * @param userId - ID of the user to check
 * @param submissionId - ID of the assignment submission
 * @returns True if user is the submitting student, false otherwise
 */
export async function verifyAssignmentSubmissionOwnership(
  userId: string,
  submissionId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the student who made the submission
    const result = await db.execute(
      sql`SELECT student_id FROM assignment_submissions WHERE id = ${submissionId}`
    );

    if (result.rows.length === 0) {
      // Submission not found
      return false;
    }

    const submission = result.rows[0] as { student_id: string };
    return submission.student_id === userId;
  } catch (error) {
    console.error('Error verifying assignment submission ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns a quiz submission (is the submitting student)
 * 
 * @param userId - ID of the user to check
 * @param submissionId - ID of the quiz submission
 * @returns True if user is the submitting student, false otherwise
 */
export async function verifyQuizSubmissionOwnership(
  userId: string,
  submissionId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the student who made the submission
    const result = await db.execute(
      sql`SELECT student_id FROM quiz_submissions WHERE id = ${submissionId}`
    );

    if (result.rows.length === 0) {
      // Submission not found
      return false;
    }

    const submission = result.rows[0] as { student_id: string };
    return submission.student_id === userId;
  } catch (error) {
    console.error('Error verifying quiz submission ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns a message (is sender or recipient)
 * 
 * @param userId - ID of the user to check
 * @param messageId - ID of the message
 * @returns True if user is sender or recipient, false otherwise
 */
export async function verifyMessageOwnership(
  userId: string,
  messageId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is sender or recipient
    const result = await db.execute(
      sql`SELECT sender_id, recipient_id FROM messages WHERE id = ${messageId}`
    );

    if (result.rows.length === 0) {
      // Message not found
      return false;
    }

    const message = result.rows[0] as { sender_id: string; recipient_id: string };
    return message.sender_id === userId || message.recipient_id === userId;
  } catch (error) {
    console.error('Error verifying message ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns a discussion thread (is the author)
 * 
 * @param userId - ID of the user to check
 * @param threadId - ID of the discussion thread
 * @returns True if user is the thread author, false otherwise
 */
export async function verifyDiscussionThreadOwnership(
  userId: string,
  threadId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the author of the thread
    const result = await db.execute(
      sql`SELECT author_id FROM discussion_threads WHERE id = ${threadId}`
    );

    if (result.rows.length === 0) {
      // Thread not found
      return false;
    }

    const thread = result.rows[0] as { author_id: string };
    return thread.author_id === userId;
  } catch (error) {
    console.error('Error verifying discussion thread ownership:', error);
    throw error;
  }
}

/**
 * Verify if a user owns a discussion post (is the author)
 * 
 * @param userId - ID of the user to check
 * @param postId - ID of the discussion post
 * @returns True if user is the post author, false otherwise
 */
export async function verifyDiscussionPostOwnership(
  userId: string,
  postId: string
): Promise<boolean> {
  try {
    const db = getReadDb();
    
    // Query to check if user is the author of the post
    const result = await db.execute(
      sql`SELECT author_id FROM discussion_posts WHERE id = ${postId}`
    );

    if (result.rows.length === 0) {
      // Post not found
      return false;
    }

    const post = result.rows[0] as { author_id: string };
    return post.author_id === userId;
  } catch (error) {
    console.error('Error verifying discussion post ownership:', error);
    throw error;
  }
}
