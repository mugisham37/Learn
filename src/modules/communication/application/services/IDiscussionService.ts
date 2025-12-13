/**
 * Discussion Service Interface
 *
 * Defines the contract for discussion-related business operations.
 * Handles thread creation, replies, voting, and solution marking
 * with proper authorization and notification integration.
 *
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 */

import type { DiscussionThread } from '../../domain/entities/DiscussionThread.js';
import type { DiscussionPost, VoteType } from '../../domain/entities/DiscussionPost.js';
import type {
  ThreadWithDetails,
  PostWithReplies,
  PaginatedResult,
  DiscussionPagination,
  ThreadFilter,
  ThreadSortBy,
} from '../../infrastructure/repositories/IDiscussionRepository.js';

/**
 * Data Transfer Object for creating a discussion thread
 */
export interface CreateThreadDTO {
  courseId: string;
  authorId: string;
  category: string;
  title: string;
  content: string;
}

/**
 * Data Transfer Object for creating a discussion post/reply
 */
export interface CreateReplyDTO {
  threadId: string;
  authorId: string;
  content: string;
  parentPostId?: string;
}

/**
 * Data Transfer Object for voting on a post
 */
export interface VotePostDTO {
  postId: string;
  userId: string;
  voteType: VoteType;
}

/**
 * Data Transfer Object for marking a post as solution
 */
export interface MarkSolutionDTO {
  postId: string;
  educatorId: string;
  isSolution: boolean;
}

/**
 * Thread creation result with validation details
 */
export interface ThreadCreationResult {
  thread: DiscussionThread;
  enrollmentValidated: boolean;
}

/**
 * Reply creation result with notification details
 */
export interface ReplyCreationResult {
  post: DiscussionPost;
  notificationsSent: string[]; // Array of user IDs who received notifications
}

/**
 * Vote result with duplicate prevention details
 */
export interface VoteResult {
  success: boolean;
  previousVoteRemoved: boolean;
  newVoteCount: number;
}

/**
 * Solution marking result with notification details
 */
export interface SolutionResult {
  post: DiscussionPost;
  authorNotified: boolean;
}

/**
 * Discussion Service Interface
 *
 * Provides high-level business operations for discussion functionality
 * with proper validation, authorization, and side effects (notifications)
 */
export interface IDiscussionService {
  /**
   * Create a new discussion thread with enrollment validation
   *
   * @param data - Thread creation data
   * @returns Thread creation result with validation status
   * @throws ValidationError if input data is invalid
   * @throws AuthorizationError if user is not enrolled in the course
   * @throws NotFoundError if course doesn't exist
   */
  createThread(data: CreateThreadDTO): Promise<ThreadCreationResult>;

  /**
   * Reply to a discussion thread with threading support
   *
   * @param data - Reply creation data
   * @returns Reply creation result with notification details
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if thread or parent post doesn't exist
   * @throws AuthorizationError if thread is locked or user not enrolled
   */
  replyToThread(data: CreateReplyDTO): Promise<ReplyCreationResult>;

  /**
   * Vote on a post with duplicate prevention
   *
   * @param data - Vote data
   * @returns Vote result with duplicate prevention details
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if post doesn't exist
   * @throws AuthorizationError if user cannot vote (not enrolled, etc.)
   */
  votePost(data: VotePostDTO): Promise<VoteResult>;

  /**
   * Mark a post as solution with educator authorization
   *
   * @param data - Solution marking data
   * @returns Solution result with notification details
   * @throws ValidationError if input data is invalid
   * @throws NotFoundError if post doesn't exist
   * @throws AuthorizationError if user is not an educator for the course
   */
  markSolution(data: MarkSolutionDTO): Promise<SolutionResult>;

  /**
   * Get threads for a course with filtering and pagination
   *
   * @param courseId - Course ID
   * @param userId - User ID for enrollment validation
   * @param filter - Thread filter options
   * @param sortBy - Sort criteria
   * @param sortOrder - Sort order
   * @param pagination - Pagination parameters
   * @returns Paginated thread results
   * @throws AuthorizationError if user is not enrolled in the course
   */
  getThreadsByCourse(
    courseId: string,
    userId: string,
    filter: ThreadFilter,
    sortBy: ThreadSortBy,
    sortOrder: 'asc' | 'desc',
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<ThreadWithDetails>>;

  /**
   * Get posts for a thread with nested structure
   *
   * @param threadId - Thread ID
   * @param userId - User ID for enrollment validation and vote status
   * @param pagination - Pagination parameters
   * @returns Paginated post results with nested replies
   * @throws AuthorizationError if user is not enrolled in the course
   * @throws NotFoundError if thread doesn't exist
   */
  getPostsByThread(
    threadId: string,
    userId: string,
    pagination?: DiscussionPagination
  ): Promise<PaginatedResult<PostWithReplies>>;

  /**
   * Update thread activity timestamp
   * Internal method called when posts are added to a thread
   *
   * @param threadId - Thread ID
   */
  updateThreadActivity(threadId: string): Promise<void>;
}
