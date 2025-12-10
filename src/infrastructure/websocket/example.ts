/**
 * WebSocket Usage Examples
 * 
 * This file demonstrates how to use the WebSocket infrastructure
 * in various scenarios throughout the application.
 */

import { RealtimeService } from '../../shared/services/RealtimeService.js';
import { 
  emitToUser, 
  emitToCourse, 
  emitToConversation, 
  emitToThread,
  getOnlineUsersInCourse,
  getUserPresence 
} from './index.js';

// Initialize the realtime service
const realtimeService = new RealtimeService();

/**
 * Example 1: Sending a notification to a user
 */
export async function sendNotificationExample() {
  await realtimeService.emitNotification('user-123', {
    notificationId: 'notif-456',
    type: 'assignment_graded',
    title: 'Assignment Graded',
    content: 'Your assignment "Introduction to TypeScript" has been graded',
    actionUrl: '/assignments/assignment-789',
    priority: 'medium',
  });
}

/**
 * Example 2: Broadcasting a course announcement
 */
export async function broadcastAnnouncementExample() {
  await realtimeService.emitAnnouncement('course-123', {
    announcementId: 'announce-456',
    title: 'Class Cancelled',
    content: 'Tomorrow\'s class is cancelled due to weather conditions',
    publishedAt: new Date().toISOString(),
  });
}

/**
 * Example 3: Sending a direct message
 */
export async function sendDirectMessageExample() {
  await realtimeService.emitMessage('sender-123', 'recipient-456', {
    messageId: 'msg-789',
    senderName: 'John Doe',
    content: 'Hi! I have a question about the assignment',
    conversationId: 'conv-101',
  });
}

/**
 * Example 4: Notifying about a new discussion post
 */
export async function notifyDiscussionPostExample() {
  await realtimeService.emitDiscussionPost('thread-123', {
    postId: 'post-456',
    authorId: 'user-789',
    authorName: 'Jane Smith',
    content: 'I think the answer is related to the concept we learned in chapter 3',
  });
}

/**
 * Example 5: Quiz session events
 */
export async function quizSessionExample() {
  // Notify when quiz starts
  await realtimeService.emitQuizEvent('student-123', 'quiz-started', {
    quizId: 'quiz-456',
    submissionId: 'submission-789',
    studentId: 'student-123',
    startTime: new Date().toISOString(),
  });

  // Notify when quiz is submitted
  await realtimeService.emitQuizEvent('student-123', 'quiz-submitted', {
    quizId: 'quiz-456',
    submissionId: 'submission-789',
    studentId: 'student-123',
    score: 85,
    gradingStatus: 'auto_graded',
  });
}

/**
 * Example 6: Assignment workflow
 */
export async function assignmentWorkflowExample() {
  // Notify when assignment is submitted
  await realtimeService.emitAssignmentEvent('student-123', 'assignment-submitted', {
    assignmentId: 'assignment-456',
    submissionId: 'submission-789',
    studentId: 'student-123',
    submittedAt: new Date().toISOString(),
    isLate: false,
  });

  // Notify when assignment is graded
  await realtimeService.emitAssignmentEvent('student-123', 'assignment-graded', {
    assignmentId: 'assignment-456',
    submissionId: 'submission-789',
    studentId: 'student-123',
    pointsAwarded: 95,
    feedback: 'Excellent work! Your analysis was thorough and well-structured.',
  });
}

/**
 * Example 7: Presence management
 */
export async function presenceManagementExample() {
  // Broadcast user coming online
  await realtimeService.broadcastPresence('user-123', 'online', ['course-456', 'course-789']);

  // Get online users in a course
  const onlineUsers = await getOnlineUsersInCourse('course-456');
  console.log(`${onlineUsers.length} users are currently online in the course`);

  // Check specific user presence
  const userPresence = await getUserPresence('user-123');
  if (userPresence?.status === 'online') {
    console.log('User is currently online');
  } else {
    console.log(`User was last seen: ${userPresence?.lastSeen}`);
  }
}

/**
 * Example 8: Low-level event emission
 */
export async function lowLevelEventExample() {
  // Direct event emission to user
  await emitToUser('user-123', 'lesson-progress-updated', {
    enrollmentId: 'enrollment-456',
    lessonId: 'lesson-789',
    status: 'completed',
    progressPercentage: 75,
  });

  // Direct event emission to course
  await emitToCourse('course-123', 'course-updated', {
    courseId: 'course-123',
    updateType: 'content',
    timestamp: new Date().toISOString(),
  });

  // Direct event emission to conversation
  await emitToConversation('user-123', 'user-456', 'user-typing', {
    userId: 'user-123',
    type: 'start',
  });

  // Direct event emission to thread
  await emitToThread('thread-123', 'discussion-solution-marked', {
    postId: 'post-456',
    threadId: 'thread-123',
    authorId: 'user-789',
    markedBy: 'educator-101',
  });
}

/**
 * Example 9: Error handling
 */
export async function errorHandlingExample() {
  try {
    await realtimeService.emitNotification('invalid-user-id', {
      notificationId: 'notif-123',
      type: 'test',
      title: 'Test Notification',
      content: 'This is a test',
      priority: 'low',
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
    // Handle error appropriately - maybe queue for retry
  }
}

/**
 * Example 10: Batch operations
 */
export async function batchOperationsExample() {
  const courseId = 'course-123';
  const onlineUsers = await getOnlineUsersInCourse(courseId);

  // Send notification to all online users in the course
  const notifications = onlineUsers.map(userId => 
    realtimeService.emitNotification(userId, {
      notificationId: `notif-${userId}-${Date.now()}`,
      type: 'course_update',
      title: 'Course Material Updated',
      content: 'New lecture slides have been uploaded',
      actionUrl: `/courses/${courseId}/materials`,
      priority: 'medium',
    })
  );

  await Promise.all(notifications);
  console.log(`Sent notifications to ${onlineUsers.length} online users`);
}