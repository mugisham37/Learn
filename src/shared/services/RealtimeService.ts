/**
 * Real-time Service Implementation
 * 
 * Concrete implementation of the real-time service interface
 * Wraps Socket.io functionality for use by application services
 * 
 * Requirements: 9.6, 9.7, 9.8
 */

import {
  emitToUser,
  emitToRoom,
  emitToCourse,
  emitToConversation,
  emitToThread,
  getOnlineUsersInCourse,
  getUserPresence,
} from '../../infrastructure/websocket/index.js';
import { logger } from '../utils/logger.js';

import { IRealtimeService, RealtimeEvents, PresenceStatus } from './IRealtimeService.js';

/**
 * Real-time service implementation using Socket.io
 */
export class RealtimeService implements IRealtimeService {
  /**
   * Emits an event to a specific user
   */
  async emitToUser<K extends keyof RealtimeEvents>(
    userId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void> {
    try {
      await emitToUser(userId, event, data);
      
      logger.debug('Real-time event emitted to user', {
        userId,
        event,
        dataKeys: Object.keys(data || {}),
      });
    } catch (error) {
      logger.error('Failed to emit real-time event to user', {
        userId,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Emits an event to a specific room
   */
  async emitToRoom<K extends keyof RealtimeEvents>(
    room: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void> {
    try {
      await emitToRoom(room, event, data);
      
      logger.debug('Real-time event emitted to room', {
        room,
        event,
        dataKeys: Object.keys(data || {}),
      });
    } catch (error) {
      logger.error('Failed to emit real-time event to room', {
        room,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Emits an event to all users in a course
   */
  async emitToCourse<K extends keyof RealtimeEvents>(
    courseId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void> {
    try {
      await emitToCourse(courseId, event, data);
      
      logger.debug('Real-time event emitted to course', {
        courseId,
        event,
        dataKeys: Object.keys(data || {}),
      });
    } catch (error) {
      logger.error('Failed to emit real-time event to course', {
        courseId,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Emits an event to a conversation between two users
   */
  async emitToConversation<K extends keyof RealtimeEvents>(
    userId1: string,
    userId2: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void> {
    try {
      await emitToConversation(userId1, userId2, event, data);
      
      logger.debug('Real-time event emitted to conversation', {
        userId1,
        userId2,
        event,
        dataKeys: Object.keys(data || {}),
      });
    } catch (error) {
      logger.error('Failed to emit real-time event to conversation', {
        userId1,
        userId2,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Emits an event to a discussion thread
   */
  async emitToThread<K extends keyof RealtimeEvents>(
    threadId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void> {
    try {
      await emitToThread(threadId, event, data);
      
      logger.debug('Real-time event emitted to thread', {
        threadId,
        event,
        dataKeys: Object.keys(data || {}),
      });
    } catch (error) {
      logger.error('Failed to emit real-time event to thread', {
        threadId,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Broadcasts user presence to relevant rooms
   */
  async broadcastPresence(
    userId: string,
    status: PresenceStatus,
    courseIds?: string[]
  ): Promise<void> {
    try {
      // Emit presence to user's own room for UI updates
      await this.emitToUser(userId, 'user-presence', {
        userId,
        status,
        timestamp: new Date().toISOString(),
      });

      // Emit presence to course rooms if provided
      if (courseIds && courseIds.length > 0) {
        for (const courseId of courseIds) {
          await this.emitToCourse(courseId, 'user-presence', {
            userId,
            status,
            timestamp: new Date().toISOString(),
          });
        }
      }

      logger.debug('User presence broadcasted', {
        userId,
        status,
        courseCount: courseIds?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to broadcast user presence', {
        userId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Gets online users in a course
   */
  async getOnlineUsersInCourse(courseId: string): Promise<string[]> {
    try {
      const onlineUsers = await getOnlineUsersInCourse(courseId);
      
      logger.debug('Retrieved online users in course', {
        courseId,
        userCount: onlineUsers.length,
      });

      return onlineUsers;
    } catch (error) {
      logger.error('Failed to get online users in course', {
        courseId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Gets user presence status
   */
  async getUserPresence(userId: string): Promise<{
    status: PresenceStatus;
    lastSeen?: string;
  } | null> {
    try {
      const presence = await getUserPresence(userId);
      
      logger.debug('Retrieved user presence', {
        userId,
        status: presence?.status || 'offline',
      });

      return presence as { status: PresenceStatus; lastSeen?: string } | null;
    } catch (error) {
      logger.error('Failed to get user presence', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'offline' };
    }
  }

  /**
   * Emits a notification event to a user
   */
  async emitNotification(
    userId: string,
    notification: {
      notificationId: string;
      type: string;
      title: string;
      content: string;
      actionUrl?: string;
      priority: 'low' | 'medium' | 'high';
    }
  ): Promise<void> {
    await this.emitToUser(userId, 'notification-received', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emits a message event to a conversation
   */
  async emitMessage(
    senderId: string,
    recipientId: string,
    message: {
      messageId: string;
      senderName: string;
      content: string;
      conversationId: string;
    }
  ): Promise<void> {
    await this.emitToConversation(senderId, recipientId, 'message-received', {
      ...message,
      senderId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emits a discussion post event to a thread
   */
  async emitDiscussionPost(
    threadId: string,
    post: {
      postId: string;
      authorId: string;
      authorName: string;
      content: string;
    }
  ): Promise<void> {
    await this.emitToThread(threadId, 'discussion-post-created', {
      ...post,
      threadId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emits an announcement to a course
   */
  async emitAnnouncement(
    courseId: string,
    announcement: {
      announcementId: string;
      title: string;
      content: string;
      publishedAt: string;
    }
  ): Promise<void> {
    await this.emitToCourse(courseId, 'announcement-published', {
      ...announcement,
      courseId,
    });
  }

  /**
   * Emits a quiz event to a user
   */
  async emitQuizEvent(
    userId: string,
    event: 'quiz-started' | 'quiz-submitted',
    data: {
      quizId: string;
      submissionId: string;
      studentId: string;
      startTime?: string;
      score?: number;
      gradingStatus?: string;
    }
  ): Promise<void> {
    if (event === 'quiz-started') {
      await this.emitToUser(userId, 'quiz-started', {
        quizId: data.quizId,
        submissionId: data.submissionId,
        studentId: data.studentId,
        startTime: data.startTime || new Date().toISOString(),
      });
    } else {
      await this.emitToUser(userId, 'quiz-submitted', {
        quizId: data.quizId,
        submissionId: data.submissionId,
        studentId: data.studentId,
        score: data.score,
        gradingStatus: data.gradingStatus || 'pending',
      });
    }
  }

  /**
   * Emits an assignment event to a user
   */
  async emitAssignmentEvent(
    userId: string,
    event: 'assignment-submitted' | 'assignment-graded',
    data: {
      assignmentId: string;
      submissionId: string;
      studentId: string;
      submittedAt?: string;
      isLate?: boolean;
      pointsAwarded?: number;
      feedback?: string;
    }
  ): Promise<void> {
    if (event === 'assignment-submitted') {
      await this.emitToUser(userId, 'assignment-submitted', {
        assignmentId: data.assignmentId,
        submissionId: data.submissionId,
        studentId: data.studentId,
        submittedAt: data.submittedAt || new Date().toISOString(),
        isLate: data.isLate || false,
      });
    } else {
      await this.emitToUser(userId, 'assignment-graded', {
        assignmentId: data.assignmentId,
        submissionId: data.submissionId,
        studentId: data.studentId,
        pointsAwarded: data.pointsAwarded || 0,
        feedback: data.feedback,
      });
    }
  }
}