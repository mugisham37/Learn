/**
 * Discussion Service Unit Tests
 *
 * Tests the discussion service implementation with proper mocking
 * and validation of business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscussionService } from '../DiscussionService.js';
import { DiscussionThread } from '../../../domain/entities/DiscussionThread.js';
import { DiscussionPost, VoteType } from '../../../domain/entities/DiscussionPost.js';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../../../../../shared/errors/index.js';
import type { IDiscussionRepository } from '../../../infrastructure/repositories/IDiscussionRepository.js';
import type { IEnrollmentRepository } from '../../../../enrollments/infrastructure/repositories/IEnrollmentRepository.js';
import type { ICourseRepository } from '../../../../courses/infrastructure/repositories/ICourseRepository.js';

// Mock repositories
const mockDiscussionRepository: Partial<IDiscussionRepository> = {
  createThread: vi.fn(),
  findThreadById: vi.fn(),
  createPost: vi.fn(),
  findPostById: vi.fn(),
  updateThreadLastActivity: vi.fn(),
  incrementThreadReplyCount: vi.fn(),
  voteOnPost: vi.fn(),
  hasUserVotedOnPost: vi.fn(),
  getPostVoteCount: vi.fn(),
  markPostAsSolution: vi.fn(),
  incrementThreadViewCount: vi.fn(),
  findThreadsByCourse: vi.fn(),
  findPostsByThread: vi.fn(),
};

const mockEnrollmentRepository: Partial<IEnrollmentRepository> = {
  findByStudentAndCourse: vi.fn(),
};

const mockCourseRepository: Partial<ICourseRepository> = {
  findById: vi.fn(),
};

const mockRealtimeService = {
  emitToUser: vi.fn(),
  emitToRoom: vi.fn(),
};

const mockNotificationService = {
  createNotification: vi.fn(),
};

describe('DiscussionService', () => {
  let discussionService: DiscussionService;

  beforeEach(() => {
    vi.clearAllMocks();
    discussionService = new DiscussionService(
      mockDiscussionRepository as IDiscussionRepository,
      mockEnrollmentRepository as IEnrollmentRepository,
      mockCourseRepository as ICourseRepository,
      mockRealtimeService,
      mockNotificationService
    );
  });

  describe('createThread', () => {
    const validThreadData = {
      courseId: 'course-123',
      authorId: 'user-123',
      category: 'general',
      title: 'Test Thread',
      content: 'This is a test thread',
    };

    it('should create a thread successfully when user is enrolled', async () => {
      // Arrange
      const mockCourse = { id: 'course-123', title: 'Test Course', instructorId: 'instructor-123' };
      const mockEnrollment = {
        id: 'enrollment-123',
        studentId: 'user-123',
        courseId: 'course-123',
        status: 'active',
      };
      const mockCreatedThread = {
        id: 'thread-123',
        courseId: 'course-123',
        authorId: 'user-123',
        category: 'general',
        title: 'Test Thread',
        content: 'This is a test thread',
        isPinned: false,
        isLocked: false,
        viewCount: 0,
        replyCount: 0,
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCourseRepository.findById = vi.fn().mockResolvedValue(mockCourse);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(mockEnrollment);
      mockDiscussionRepository.createThread = vi.fn().mockResolvedValue(mockCreatedThread);

      // Act
      const result = await discussionService.createThread(validThreadData);

      // Assert
      expect(result.enrollmentValidated).toBe(true);
      expect(result.thread).toBeInstanceOf(DiscussionThread);
      expect(result.thread.title).toBe('Test Thread');
      expect(mockDiscussionRepository.createThread).toHaveBeenCalledWith({
        courseId: 'course-123',
        authorId: 'user-123',
        category: 'general',
        title: 'Test Thread',
        content: 'This is a test thread',
      });
    });

    it('should throw NotFoundError when course does not exist', async () => {
      // Arrange
      mockCourseRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(discussionService.createThread(validThreadData)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when user is not enrolled', async () => {
      // Arrange
      const mockCourse = { id: 'course-123', title: 'Test Course' };
      mockCourseRepository.findById = vi.fn().mockResolvedValue(mockCourse);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(discussionService.createThread(validThreadData)).rejects.toThrow(
        AuthorizationError
      );
    });

    it('should throw ValidationError for invalid input', async () => {
      // Arrange
      const invalidData = { ...validThreadData, title: '' };

      // Act & Assert
      await expect(discussionService.createThread(invalidData)).rejects.toThrow(ValidationError);
    });
  });

  describe('replyToThread', () => {
    const validReplyData = {
      threadId: 'thread-123',
      authorId: 'user-123',
      content: 'This is a reply',
    };

    it('should create a reply successfully when user is enrolled', async () => {
      // Arrange
      const mockThread = {
        id: 'thread-123',
        courseId: 'course-123',
        authorId: 'author-123',
        title: 'Test Thread',
        isLocked: false,
      };
      const mockEnrollment = {
        id: 'enrollment-123',
        studentId: 'user-123',
        courseId: 'course-123',
        status: 'active',
      };
      const mockCreatedPost = {
        id: 'post-123',
        threadId: 'thread-123',
        authorId: 'user-123',
        parentPostId: null,
        content: 'This is a reply',
        upvoteCount: 0,
        isSolution: false,
        editedAt: null,
        editHistory: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(mockEnrollment);
      mockDiscussionRepository.createPost = vi.fn().mockResolvedValue(mockCreatedPost);
      mockDiscussionRepository.updateThreadLastActivity = vi.fn().mockResolvedValue(undefined);
      mockDiscussionRepository.incrementThreadReplyCount = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await discussionService.replyToThread(validReplyData);

      // Assert
      expect(result.post).toBeInstanceOf(DiscussionPost);
      expect(result.post.content).toBe('This is a reply');
      expect(result.notificationsSent).toHaveLength(1); // Thread author should be notified
      expect(mockDiscussionRepository.createPost).toHaveBeenCalledWith({
        threadId: 'thread-123',
        authorId: 'user-123',
        parentPostId: undefined,
        content: 'This is a reply',
      });
    });

    it('should throw AuthorizationError when thread is locked', async () => {
      // Arrange
      const mockThread = { id: 'thread-123', courseId: 'course-123', isLocked: true };
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);

      // Act & Assert
      await expect(discussionService.replyToThread(validReplyData)).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('votePost', () => {
    const validVoteData = {
      postId: 'post-123',
      userId: 'user-123',
      voteType: VoteType.UPVOTE,
    };

    it('should add vote successfully when user has not voted', async () => {
      // Arrange
      const mockPost = { id: 'post-123', threadId: 'thread-123', authorId: 'author-123' };
      const mockThread = { id: 'thread-123', courseId: 'course-123' };
      const mockEnrollment = {
        id: 'enrollment-123',
        studentId: 'user-123',
        courseId: 'course-123',
        status: 'active',
      };

      mockDiscussionRepository.findPostById = vi.fn().mockResolvedValue(mockPost);
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(mockEnrollment);
      mockDiscussionRepository.hasUserVotedOnPost = vi.fn().mockResolvedValue(false);
      mockDiscussionRepository.voteOnPost = vi.fn().mockResolvedValue(undefined);
      mockDiscussionRepository.getPostVoteCount = vi.fn().mockResolvedValue(1);

      // Act
      const result = await discussionService.votePost(validVoteData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.previousVoteRemoved).toBe(false);
      expect(result.newVoteCount).toBe(1);
      expect(mockDiscussionRepository.voteOnPost).toHaveBeenCalledWith(
        'post-123',
        'user-123',
        VoteType.UPVOTE
      );
    });

    it('should throw ConflictError when user has already voted', async () => {
      // Arrange
      const mockPost = { id: 'post-123', threadId: 'thread-123', authorId: 'author-123' };
      const mockThread = { id: 'thread-123', courseId: 'course-123' };
      const mockEnrollment = {
        id: 'enrollment-123',
        studentId: 'user-123',
        courseId: 'course-123',
        status: 'active',
      };

      mockDiscussionRepository.findPostById = vi.fn().mockResolvedValue(mockPost);
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(mockEnrollment);
      mockDiscussionRepository.hasUserVotedOnPost = vi.fn().mockResolvedValue(true);

      // Act & Assert
      await expect(discussionService.votePost(validVoteData)).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when user tries to vote on own post', async () => {
      // Arrange
      const mockPost = { id: 'post-123', threadId: 'thread-123', authorId: 'user-123' }; // Same as voter
      const mockThread = { id: 'thread-123', courseId: 'course-123' };
      const mockEnrollment = {
        id: 'enrollment-123',
        studentId: 'user-123',
        courseId: 'course-123',
        status: 'active',
      };

      mockDiscussionRepository.findPostById = vi.fn().mockResolvedValue(mockPost);
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockEnrollmentRepository.findByStudentAndCourse = vi.fn().mockResolvedValue(mockEnrollment);

      // Act & Assert
      await expect(discussionService.votePost(validVoteData)).rejects.toThrow(ValidationError);
    });
  });

  describe('markSolution', () => {
    const validSolutionData = {
      postId: 'post-123',
      educatorId: 'instructor-123',
      isSolution: true,
    };

    it('should mark post as solution when educator is course instructor', async () => {
      // Arrange
      const mockPost = {
        id: 'post-123',
        threadId: 'thread-123',
        authorId: 'student-123',
        content: 'Great answer!',
      };
      const mockThread = { id: 'thread-123', courseId: 'course-123', title: 'Test Thread' };
      const mockCourse = { id: 'course-123', instructorId: 'instructor-123' };
      const mockUpdatedPost = {
        id: 'post-123',
        threadId: 'thread-123',
        authorId: 'student-123',
        parentPostId: null,
        content: 'Great answer!',
        upvoteCount: 0,
        isSolution: true,
        editedAt: null,
        editHistory: [],
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDiscussionRepository.findPostById = vi.fn().mockResolvedValue(mockPost);
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockCourseRepository.findById = vi.fn().mockResolvedValue(mockCourse);
      mockDiscussionRepository.markPostAsSolution = vi.fn().mockResolvedValue(mockUpdatedPost);

      // Act
      const result = await discussionService.markSolution(validSolutionData);

      // Assert
      expect(result.post).toBeInstanceOf(DiscussionPost);
      expect(result.post.isSolution).toBe(true);
      expect(result.authorNotified).toBe(true);
      expect(mockDiscussionRepository.markPostAsSolution).toHaveBeenCalledWith('post-123', true);
    });

    it('should throw AuthorizationError when user is not course instructor', async () => {
      // Arrange
      const mockPost = { id: 'post-123', threadId: 'thread-123', authorId: 'student-123' };
      const mockThread = { id: 'thread-123', courseId: 'course-123' };
      const mockCourse = { id: 'course-123', instructorId: 'different-instructor' }; // Different instructor

      mockDiscussionRepository.findPostById = vi.fn().mockResolvedValue(mockPost);
      mockDiscussionRepository.findThreadById = vi.fn().mockResolvedValue(mockThread);
      mockCourseRepository.findById = vi.fn().mockResolvedValue(mockCourse);

      // Act & Assert
      await expect(discussionService.markSolution(validSolutionData)).rejects.toThrow(
        AuthorizationError
      );
    });
  });
});
