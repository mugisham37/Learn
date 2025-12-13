/**
 * Discussion Service Implementation
 *
 * Implements discussion-related business operations with proper validation,
 * authorization, and notification integration. Handles thread creation,
 * replies, voting, and solution marking.
 *
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 */

import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../../../../shared/errors/index.js';
import { sanitizeByContentType } from '../../../../shared/utils/sanitization.js';

import type { ICourseRepository } from '../../../courses/infrastructure/repositories/ICourseRepository.js';
import type { IEnrollmentRepository } from '../../../enrollments/infrastructure/repositories/IEnrollmentRepository.js';
import {
  DiscussionPost,
  CreateDiscussionPostDTO,
  VoteType,
} from '../../domain/entities/DiscussionPost.js';
import {
  DiscussionThread,
  CreateDiscussionThreadDTO,
} from '../../domain/entities/DiscussionThread.js';
import type {
  IDiscussionRepository,
  ThreadWithDetails,
  PostWithReplies,
  PaginatedResult,
  DiscussionPagination,
  ThreadFilter,
  ThreadSortBy,
} from '../../infrastructure/repositories/IDiscussionRepository.js';

import type {
  IDiscussionService,
  CreateThreadDTO,
  CreateReplyDTO,
  VotePostDTO,
  MarkSolutionDTO,
  ThreadCreationResult,
  ReplyCreationResult,
  VoteResult,
  SolutionResult,
} from './IDiscussionService.js';

/**
 * Temporary interfaces for services that will be implemented later
 * These will be replaced with actual implementations when those modules are ready
 */
interface IRealtimeService {
  emitToUser(userId: string, event: string, data: unknown): Promise<void>;
  emitToRoom(roomId: string, event: string, data: unknown): Promise<void>;
}

interface INotificationService {
  createNotification(
    recipientId: string,
    data: {
      type: string;
      title: string;
      content: string;
      actionUrl?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void>;
}

/**
 * DiscussionService
 *
 * Handles discussion functionality with proper business logic validation,
 * enrollment checks, authorization, and notification integration
 */
export class DiscussionService implements IDiscussionService {
  constructor(
    private readonly discussionRepository: IDiscussionRepository,
    private readonly enrollmentRepository: IEnrollmentRepository,
    private readonly courseRepository: ICourseRepository,
    private readonly realtimeService?: IRealtimeService,
    private readonly notificationService?: INotificationService
  ) {}

  /**
   * Create a new discussion thread with enrollment validation
   */
  async createThread(data: CreateThreadDTO): Promise<ThreadCreationResult> {
    // Validate input
    this.validateCreateThreadInput(data);

    // Check if course exists
    const course = await this.courseRepository.findById(data.courseId);
    if (!course) {
      throw new NotFoundError('course', data.courseId);
    }

    // Validate user enrollment in the course
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      data.authorId,
      data.courseId
    );

    if (!enrollment || enrollment.status !== 'active') {
      throw new AuthorizationError(
        'User must be enrolled in the course to create discussion threads',
        'student',
        data.authorId
      );
    }

    // Create the thread with sanitized content
    const threadData: CreateDiscussionThreadDTO = {
      courseId: data.courseId,
      authorId: data.authorId,
      category: data.category,
      title: data.title,
      content: sanitizeByContentType(data.content, 'discussion.content'),
    };

    const createdThread = await this.discussionRepository.createThread(threadData);

    // Convert to domain entity
    const thread = new DiscussionThread(
      createdThread.id,
      createdThread.courseId,
      createdThread.authorId,
      createdThread.category,
      createdThread.title,
      createdThread.content,
      createdThread.isPinned,
      createdThread.isLocked,
      createdThread.viewCount,
      createdThread.replyCount,
      createdThread.lastActivityAt,
      createdThread.createdAt,
      createdThread.updatedAt
    );

    // Emit real-time event to course participants
    if (this.realtimeService) {
      await this.realtimeService.emitToRoom(`course_${data.courseId}`, 'thread_created', {
        threadId: thread.id,
        title: thread.title,
        authorId: thread.authorId,
        category: thread.category,
      });
    }

    return {
      thread,
      enrollmentValidated: true,
    };
  }

  /**
   * Reply to a discussion thread with threading support
   */
  async replyToThread(data: CreateReplyDTO): Promise<ReplyCreationResult> {
    // Validate input
    this.validateCreateReplyInput(data);

    // Check if thread exists and get course info
    const thread = await this.discussionRepository.findThreadById(data.threadId);
    if (!thread) {
      throw new NotFoundError('thread', data.threadId);
    }

    // Check if thread is locked
    if (thread.isLocked) {
      throw new AuthorizationError('Cannot reply to locked thread', 'student', data.authorId);
    }

    // Validate user enrollment in the course
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      data.authorId,
      thread.courseId
    );

    if (!enrollment || enrollment.status !== 'active') {
      throw new AuthorizationError(
        'User must be enrolled in the course to reply to discussions',
        'student',
        data.authorId
      );
    }

    // If replying to a specific post, validate parent post exists
    if (data.parentPostId) {
      const parentPost = await this.discussionRepository.findPostById(data.parentPostId);
      if (!parentPost) {
        throw new NotFoundError('post', data.parentPostId);
      }

      // Ensure parent post belongs to the same thread
      if (parentPost.threadId !== data.threadId) {
        throw new ValidationError('Parent post does not belong to the specified thread');
      }
    }

    // Create the reply with sanitized content
    const postData: CreateDiscussionPostDTO = {
      threadId: data.threadId,
      authorId: data.authorId,
      parentPostId: data.parentPostId,
      content: sanitizeByContentType(data.content, 'post.content'),
    };

    const createdPost = await this.discussionRepository.createPost(postData);

    // Convert to domain entity
    const post = new DiscussionPost(
      createdPost.id,
      createdPost.threadId,
      createdPost.authorId,
      createdPost.parentPostId,
      createdPost.content,
      createdPost.upvoteCount,
      createdPost.isSolution,
      createdPost.editedAt,
      createdPost.editHistory as unknown[],
      createdPost.isDeleted,
      createdPost.createdAt,
      createdPost.updatedAt
    );

    // Update thread activity and reply count
    await Promise.all([
      this.discussionRepository.updateThreadLastActivity(data.threadId),
      this.discussionRepository.incrementThreadReplyCount(data.threadId),
    ]);

    // Collect notification recipients
    const notificationsSent: string[] = [];

    // Notify thread author if this is a top-level reply
    if (!data.parentPostId && thread.authorId !== data.authorId) {
      await this.sendReplyNotification(
        thread.authorId,
        thread.title,
        data.content,
        thread.id,
        'thread'
      );
      notificationsSent.push(thread.authorId);
    }

    // Notify parent post author if this is a nested reply
    if (data.parentPostId) {
      const parentPost = await this.discussionRepository.findPostById(data.parentPostId);
      if (parentPost && parentPost.authorId !== data.authorId) {
        await this.sendReplyNotification(
          parentPost.authorId,
          thread.title,
          data.content,
          thread.id,
          'post'
        );
        notificationsSent.push(parentPost.authorId);
      }
    }

    // Emit real-time event
    if (this.realtimeService) {
      await this.realtimeService.emitToRoom(`thread_${data.threadId}`, 'post_created', {
        postId: post.id,
        threadId: data.threadId,
        authorId: post.authorId,
        content: post.content,
        parentPostId: post.parentPostId,
      });
    }

    return {
      post,
      notificationsSent,
    };
  }

  /**
   * Vote on a post with duplicate prevention
   */
  async votePost(data: VotePostDTO): Promise<VoteResult> {
    // Validate input
    this.validateVotePostInput(data);

    // Check if post exists and get thread/course info
    const post = await this.discussionRepository.findPostById(data.postId);
    if (!post) {
      throw new NotFoundError('post', data.postId);
    }

    const thread = await this.discussionRepository.findThreadById(post.threadId);
    if (!thread) {
      throw new NotFoundError('thread', post.threadId);
    }

    // Validate user enrollment in the course
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      data.userId,
      thread.courseId
    );

    if (!enrollment || enrollment.status !== 'active') {
      throw new AuthorizationError(
        'User must be enrolled in the course to vote on posts',
        'student',
        data.userId
      );
    }

    // Prevent self-voting
    if (post.authorId === data.userId) {
      throw new ValidationError('Users cannot vote on their own posts');
    }

    // Check if user has already voted
    const hasVoted = await this.discussionRepository.hasUserVotedOnPost(data.postId, data.userId);
    let previousVoteRemoved = false;

    if (data.voteType === VoteType.UPVOTE) {
      if (hasVoted) {
        throw new ConflictError('User has already voted on this post', 'vote');
      }

      // Add the vote
      await this.discussionRepository.voteOnPost(data.postId, data.userId, VoteType.UPVOTE);
    } else if (data.voteType === VoteType.REMOVE_VOTE) {
      if (!hasVoted) {
        throw new ValidationError('Cannot remove vote that does not exist');
      }

      // Remove the vote
      await this.discussionRepository.voteOnPost(data.postId, data.userId, VoteType.REMOVE_VOTE);
      previousVoteRemoved = true;
    }

    // Get updated vote count
    const newVoteCount = await this.discussionRepository.getPostVoteCount(data.postId);

    // Emit real-time event
    if (this.realtimeService) {
      await this.realtimeService.emitToRoom(`thread_${post.threadId}`, 'post_voted', {
        postId: data.postId,
        voteCount: newVoteCount,
        voteType: data.voteType,
      });
    }

    return {
      success: true,
      previousVoteRemoved,
      newVoteCount,
    };
  }

  /**
   * Mark a post as solution with educator authorization
   */
  async markSolution(data: MarkSolutionDTO): Promise<SolutionResult> {
    // Validate input
    this.validateMarkSolutionInput(data);

    // Check if post exists and get thread/course info
    const post = await this.discussionRepository.findPostById(data.postId);
    if (!post) {
      throw new NotFoundError('post', data.postId);
    }

    const thread = await this.discussionRepository.findThreadById(post.threadId);
    if (!thread) {
      throw new NotFoundError('thread', post.threadId);
    }

    // Get course to check if user is the instructor
    const course = await this.courseRepository.findById(thread.courseId);
    if (!course) {
      throw new NotFoundError('course', thread.courseId);
    }

    // Check if user is authorized to mark solutions (course instructor or admin)
    const isInstructor = course.instructorId === data.educatorId;

    // For now, we'll assume the user role is passed or we need to get it from user service
    // This would typically involve checking user role from the user repository
    if (!isInstructor) {
      // Additional check could be added here for admin role
      throw new AuthorizationError(
        'Only course instructors can mark posts as solutions',
        'educator',
        data.educatorId
      );
    }

    // Mark the post as solution
    const updatedPostData = await this.discussionRepository.markPostAsSolution(
      data.postId,
      data.isSolution
    );

    // Convert to domain entity
    const updatedPost = new DiscussionPost(
      updatedPostData.id,
      updatedPostData.threadId,
      updatedPostData.authorId,
      updatedPostData.parentPostId,
      updatedPostData.content,
      updatedPostData.upvoteCount,
      updatedPostData.isSolution,
      updatedPostData.editedAt,
      updatedPostData.editHistory as unknown[],
      updatedPostData.isDeleted,
      updatedPostData.createdAt,
      updatedPostData.updatedAt
    );

    let authorNotified = false;

    // Notify post author if marking as solution (not when unmarking)
    if (data.isSolution && post.authorId !== data.educatorId) {
      await this.sendSolutionNotification(post.authorId, thread.title, post.content);
      authorNotified = true;
    }

    // Emit real-time event
    if (this.realtimeService) {
      await this.realtimeService.emitToRoom(`thread_${post.threadId}`, 'solution_marked', {
        postId: data.postId,
        isSolution: data.isSolution,
        markedBy: data.educatorId,
      });
    }

    return {
      post: updatedPost,
      authorNotified,
    };
  }

  /**
   * Get threads for a course with filtering and pagination
   */
  async getThreadsByCourse(
    courseId: string,
    userId: string,
    filter: ThreadFilter,
    sortBy: ThreadSortBy,
    sortOrder: 'asc' | 'desc',
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<ThreadWithDetails>> {
    // Validate user enrollment in the course
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(userId, courseId);

    if (!enrollment || enrollment.status !== 'active') {
      throw new AuthorizationError(
        'User must be enrolled in the course to view discussions',
        'student',
        userId
      );
    }

    return this.discussionRepository.findThreadsByCourse(
      courseId,
      filter,
      sortBy,
      sortOrder,
      pagination
    );
  }

  /**
   * Get posts for a thread with nested structure
   */
  async getPostsByThread(
    threadId: string,
    userId: string,
    pagination?: DiscussionPagination
  ): Promise<PaginatedResult<PostWithReplies>> {
    // Check if thread exists and get course info
    const thread = await this.discussionRepository.findThreadById(threadId);
    if (!thread) {
      throw new NotFoundError('thread', threadId);
    }

    // Validate user enrollment in the course
    const enrollment = await this.enrollmentRepository.findByStudentAndCourse(
      userId,
      thread.courseId
    );

    if (!enrollment || enrollment.status !== 'active') {
      throw new AuthorizationError(
        'User must be enrolled in the course to view discussion posts',
        'student',
        userId
      );
    }

    // Increment view count for the thread
    await this.discussionRepository.incrementThreadViewCount(threadId);

    return this.discussionRepository.findPostsByThread(threadId, userId, pagination);
  }

  /**
   * Update thread activity timestamp
   */
  async updateThreadActivity(threadId: string): Promise<void> {
    await this.discussionRepository.updateThreadLastActivity(threadId);
  }

  /**
   * Private helper methods
   */

  private validateCreateThreadInput(data: CreateThreadDTO): void {
    if (!data.courseId?.trim()) {
      throw new ValidationError('Course ID is required');
    }
    if (!data.authorId?.trim()) {
      throw new ValidationError('Author ID is required');
    }
    if (!data.category?.trim()) {
      throw new ValidationError('Category is required');
    }
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    if (!data.content?.trim()) {
      throw new ValidationError('Content is required');
    }
  }

  private validateCreateReplyInput(data: CreateReplyDTO): void {
    if (!data.threadId?.trim()) {
      throw new ValidationError('Thread ID is required');
    }
    if (!data.authorId?.trim()) {
      throw new ValidationError('Author ID is required');
    }
    if (!data.content?.trim()) {
      throw new ValidationError('Content is required');
    }
  }

  private validateVotePostInput(data: VotePostDTO): void {
    if (!data.postId?.trim()) {
      throw new ValidationError('Post ID is required');
    }
    if (!data.userId?.trim()) {
      throw new ValidationError('User ID is required');
    }
    if (!Object.values(VoteType).includes(data.voteType)) {
      throw new ValidationError('Invalid vote type');
    }
  }

  private validateMarkSolutionInput(data: MarkSolutionDTO): void {
    if (!data.postId?.trim()) {
      throw new ValidationError('Post ID is required');
    }
    if (!data.educatorId?.trim()) {
      throw new ValidationError('Educator ID is required');
    }
    if (typeof data.isSolution !== 'boolean') {
      throw new ValidationError('isSolution must be a boolean');
    }
  }

  private async sendReplyNotification(
    recipientId: string,
    threadTitle: string,
    replyContent: string,
    threadId: string,
    replyType: 'thread' | 'post'
  ): Promise<void> {
    if (!this.notificationService) return;

    const title =
      replyType === 'thread' ? 'New reply to your discussion thread' : 'New reply to your post';

    const content = `Someone replied to your ${replyType} in "${threadTitle}": ${replyContent.substring(0, 100)}${replyContent.length > 100 ? '...' : ''}`;

    await this.notificationService.createNotification(recipientId, {
      type: 'discussion_reply',
      title,
      content,
      actionUrl: `/discussions/threads/${threadId}`,
      metadata: {
        threadId,
        replyType,
      },
    });
  }

  private async sendSolutionNotification(
    recipientId: string,
    threadTitle: string,
    postContent: string
  ): Promise<void> {
    if (!this.notificationService) return;

    const title = 'Your post was marked as a solution!';
    const content = `Your post in "${threadTitle}" was marked as the solution: ${postContent.substring(0, 100)}${postContent.length > 100 ? '...' : ''}`;

    await this.notificationService.createNotification(recipientId, {
      type: 'solution_marked',
      title,
      content,
      metadata: {
        threadTitle,
      },
    });
  }
}
