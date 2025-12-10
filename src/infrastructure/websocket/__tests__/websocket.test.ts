/**
 * WebSocket Infrastructure Tests
 * 
 * Tests for Socket.io server configuration and basic functionality
 */

import { describe, it, expect } from 'vitest';
import { SocketRooms } from '../index.js';

describe('WebSocket Infrastructure', () => {

  describe('Room Naming Conventions', () => {
    it('should generate correct user room names', () => {
      const userId = 'user-123';
      const room = SocketRooms.user(userId);
      expect(room).toBe('user:user-123');
    });

    it('should generate correct course room names', () => {
      const courseId = 'course-456';
      const room = SocketRooms.course(courseId);
      expect(room).toBe('course:course-456');
    });

    it('should generate consistent conversation room names regardless of parameter order', () => {
      const user1 = 'user-123';
      const user2 = 'user-456';
      
      const room1 = SocketRooms.conversation(user1, user2);
      const room2 = SocketRooms.conversation(user2, user1);
      
      expect(room1).toBe(room2);
      expect(room1).toBe('conversation:user-123:user-456');
    });

    it('should generate correct thread room names', () => {
      const threadId = 'thread-789';
      const room = SocketRooms.thread(threadId);
      expect(room).toBe('thread:thread-789');
    });

    it('should generate correct lesson room names', () => {
      const lessonId = 'lesson-101';
      const room = SocketRooms.lesson(lessonId);
      expect(room).toBe('lesson:lesson-101');
    });

    it('should generate correct quiz room names', () => {
      const quizId = 'quiz-202';
      const userId = 'user-303';
      const room = SocketRooms.quiz(quizId, userId);
      expect(room).toBe('quiz:quiz-202:user-303');
    });
  });
});