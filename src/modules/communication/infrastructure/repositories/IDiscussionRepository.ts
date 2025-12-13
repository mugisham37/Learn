/**
 * Discussion Repository Interface
 *
 * Defines data access methods for discussion functionality
 * Supports threads, posts, voting, and solution marking
 */

import type {
  DiscussionThread,
  NewDiscussionThread,
  DiscussionPost,
  NewDiscussionPost,
  PostVote,
  NewPostVote,
} from '../../../../infrastructure/database/schema/communication.schema.js';
import type {
  CreateDiscussionThreadDTO,
  UpdateDiscussionThreadDTO,
} from '../../domain/entities/DiscussionThread.js';
import type {
  CreateDiscussionPostDTO,
  UpdateDiscussionPostDTO,
  VoteType,
} from '../../domain/entities/DiscussionPost.js';

/**
 * Pagination parameters for discussion queries
 */
export interface DiscussionPagination {
  limit: number;
  offset: number;
  cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Thread filter options
 */
export interface ThreadFilter {
  category?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  authorId?: string;
}

/**
 * Thread sorting options
 */
export enum ThreadSortBy {
  CREATED_AT = 'created_at',
  LAST_ACTIVITY = 'last_activity',
  REPLY_COUNT = 'reply_count',
  VIEW_COUNT = 'view_count',
}

/**
 * Post with nested replies structure
 */
export interface PostWithReplies extends DiscussionPost {
  replies?: PostWithReplies[];
  author?: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  };
  hasUserVoted?: boolean;
}

/**
 * Thread with author and post count information
 */
export interface ThreadWithDetails extends DiscussionThread {
  author?: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
  };
}

/**
 * Discussion Repository Interface
 *
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 */
export interface IDiscussionRepository {
  // Thread operations
  /**
   * Create a new discussion thread
   */
  createThread(data: CreateDiscussionThreadDTO): Promise<DiscussionThread>;

  /**
   * Find thread by ID
   */
  findThreadById(id: string): Promise<DiscussionThread | null>;

  /**
   * Find threads by course with filtering and pagination
   */
  findThreadsByCourse(
    courseId: string,
    filter: ThreadFilter,
    sortBy: ThreadSortBy,
    sortOrder: 'asc' | 'desc',
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<ThreadWithDetails>>;

  /**
   * Update thread
   */
  updateThread(id: string, data: UpdateDiscussionThreadDTO): Promise<DiscussionThread>;

  /**
   * Delete thread (soft delete)
   */
  deleteThread(id: string): Promise<void>;

  /**
   * Increment thread view count
   */
  incrementThreadViewCount(id: string): Promise<void>;

  /**
   * Increment thread reply count
   */
  incrementThreadReplyCount(id: string): Promise<void>;

  /**
   * Update thread last activity timestamp
   */
  updateThreadLastActivity(id: string): Promise<void>;

  // Post operations
  /**
   * Create a new discussion post
   */
  createPost(data: CreateDiscussionPostDTO): Promise<DiscussionPost>;

  /**
   * Find post by ID
   */
  findPostById(id: string): Promise<DiscussionPost | null>;

  /**
   * Find posts by thread with nested structure
   */
  findPostsByThread(
    threadId: string,
    userId?: string,
    pagination?: DiscussionPagination
  ): Promise<PaginatedResult<PostWithReplies>>;

  /**
   * Find posts by author
   */
  findPostsByAuthor(
    authorId: string,
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<DiscussionPost>>;

  /**
   * Update post
   */
  updatePost(id: string, data: UpdateDiscussionPostDTO): Promise<DiscussionPost>;

  /**
   * Delete post (soft delete)
   */
  deletePost(id: string): Promise<void>;

  /**
   * Mark post as solution
   */
  markPostAsSolution(postId: string, isSolution: boolean): Promise<DiscussionPost>;

  // Voting operations
  /**
   * Vote on a post (upvote or remove vote)
   */
  voteOnPost(postId: string, userId: string, voteType: VoteType): Promise<void>;

  /**
   * Check if user has voted on a post
   */
  hasUserVotedOnPost(postId: string, userId: string): Promise<boolean>;

  /**
   * Get vote count for a post
   */
  getPostVoteCount(postId: string): Promise<number>;

  /**
   * Get posts voted by user
   */
  getPostsVotedByUser(
    userId: string,
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<DiscussionPost>>;

  // Statistics and analytics
  /**
   * Get thread statistics for a course
   */
  getThreadStatistics(courseId: string): Promise<{
    totalThreads: number;
    totalPosts: number;
    activeThreads: number;
    pinnedThreads: number;
  }>;

  /**
   * Get user participation statistics
   */
  getUserParticipationStats(
    userId: string,
    courseId?: string
  ): Promise<{
    threadsCreated: number;
    postsCreated: number;
    solutionsMarked: number;
    votesReceived: number;
  }>;
}
