/**
 * Discussion Repository Implementation
 * 
 * Implements discussion data access using Drizzle ORM
 * Handles threads, posts, voting, and nested reply structures
 */

import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { 
  discussionThreads,
  discussionPosts,
  postVotes,
  DiscussionThread, 
  NewDiscussionThread,
  DiscussionPost,
  NewDiscussionPost
} from '../../../../infrastructure/database/schema/communication.schema.js';
import { users } from '../../../../infrastructure/database/schema/users.schema.js';
import { VoteType } from '../../domain/entities/DiscussionPost.js';
import type { 
  CreateDiscussionPostDTO, 
  UpdateDiscussionPostDTO
} from '../../domain/entities/DiscussionPost.js';
import type { 
  CreateDiscussionThreadDTO, 
  UpdateDiscussionThreadDTO 
} from '../../domain/entities/DiscussionThread.js';

import { 
  IDiscussionRepository,
  DiscussionPagination,
  PaginatedResult,
  ThreadFilter,
  ThreadSortBy,
  PostWithReplies,
  ThreadWithDetails
} from './IDiscussionRepository.js';

/**
 * DiscussionRepository
 * 
 * Provides data access methods for discussion functionality
 * Implements thread and post management with voting and solution marking
 * 
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 */
export class DiscussionRepository implements IDiscussionRepository {
  constructor(private db: NodePgDatabase<Record<string, never>>) {}

  // Thread operations

  /**
   * Create a new discussion thread
   */
  async createThread(data: CreateDiscussionThreadDTO): Promise<DiscussionThread> {
    const threadData: NewDiscussionThread = {
      courseId: data.courseId,
      authorId: data.authorId,
      category: data.category,
      title: data.title,
      content: data.content,
      isPinned: false,
      isLocked: false,
      viewCount: 0,
      replyCount: 0,
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [thread] = await this.db
      .insert(discussionThreads)
      .values(threadData)
      .returning();

    if (!thread) {
      throw new Error('Failed to create discussion thread');
    }

    return thread;
  }

  /**
   * Find thread by ID
   */
  async findThreadById(id: string): Promise<DiscussionThread | null> {
    const [thread] = await this.db
      .select()
      .from(discussionThreads)
      .where(eq(discussionThreads.id, id))
      .limit(1);

    return thread || null;
  }

  /**
   * Find threads by course with filtering and pagination
   */
  async findThreadsByCourse(
    courseId: string,
    filter: ThreadFilter,
    sortBy: ThreadSortBy,
    sortOrder: 'asc' | 'desc',
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<ThreadWithDetails>> {
    // Build where conditions
    const whereConditions = [eq(discussionThreads.courseId, courseId)];

    if (filter.category) {
      whereConditions.push(eq(discussionThreads.category, filter.category));
    }
    if (filter.isPinned !== undefined) {
      whereConditions.push(eq(discussionThreads.isPinned, filter.isPinned));
    }
    if (filter.isLocked !== undefined) {
      whereConditions.push(eq(discussionThreads.isLocked, filter.isLocked));
    }
    if (filter.authorId) {
      whereConditions.push(eq(discussionThreads.authorId, filter.authorId));
    }

    const whereClause = and(...whereConditions);

    // Determine sort column
    let sortColumn;
    switch (sortBy) {
      case ThreadSortBy.CREATED_AT:
        sortColumn = discussionThreads.createdAt;
        break;
      case ThreadSortBy.LAST_ACTIVITY:
        sortColumn = discussionThreads.lastActivityAt;
        break;
      case ThreadSortBy.REPLY_COUNT:
        sortColumn = discussionThreads.replyCount;
        break;
      case ThreadSortBy.VIEW_COUNT:
        sortColumn = discussionThreads.viewCount;
        break;
      default:
        sortColumn = discussionThreads.lastActivityAt;
    }

    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get total count
    const totalCountResult = await this.db
      .select({ totalCount: count() })
      .from(discussionThreads)
      .where(whereClause);
    
    const totalCount = totalCountResult[0]?.totalCount || 0;

    // Get threads with author information
    const threadsWithAuthor = await this.db
      .select({
        // Thread fields
        id: discussionThreads.id,
        courseId: discussionThreads.courseId,
        authorId: discussionThreads.authorId,
        category: discussionThreads.category,
        title: discussionThreads.title,
        content: discussionThreads.content,
        isPinned: discussionThreads.isPinned,
        isLocked: discussionThreads.isLocked,
        viewCount: discussionThreads.viewCount,
        replyCount: discussionThreads.replyCount,
        lastActivityAt: discussionThreads.lastActivityAt,
        createdAt: discussionThreads.createdAt,
        updatedAt: discussionThreads.updatedAt,
        // Author fields
        authorEmail: users.email,
        authorFullName: sql<string>`COALESCE((SELECT full_name FROM user_profiles WHERE user_id = ${users.id}), ${users.email})`,
        authorAvatarUrl: sql<string | null>`(SELECT avatar_url FROM user_profiles WHERE user_id = ${users.id})`,
      })
      .from(discussionThreads)
      .leftJoin(users, eq(discussionThreads.authorId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pagination.limit)
      .offset(pagination.offset);

    // Transform results to include author information
    const threadsWithDetails: ThreadWithDetails[] = threadsWithAuthor.map(row => ({
      id: row.id,
      courseId: row.courseId,
      authorId: row.authorId,
      category: row.category,
      title: row.title,
      content: row.content,
      isPinned: row.isPinned,
      isLocked: row.isLocked,
      viewCount: row.viewCount,
      replyCount: row.replyCount,
      lastActivityAt: row.lastActivityAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.authorEmail ? {
        id: row.authorId,
        email: row.authorEmail,
        fullName: row.authorFullName,
        avatarUrl: row.authorAvatarUrl || undefined,
      } : undefined,
    }));

    return {
      items: threadsWithDetails,
      totalCount: Number(totalCount),
      hasMore: pagination.offset + threadsWithDetails.length < Number(totalCount),
      nextCursor: threadsWithDetails.length > 0 
        ? threadsWithDetails[threadsWithDetails.length - 1]?.id 
        : undefined
    };
  }

  /**
   * Update thread
   */
  async updateThread(id: string, data: UpdateDiscussionThreadDTO): Promise<DiscussionThread> {
    const updateData: Partial<NewDiscussionThread> = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.db
      .update(discussionThreads)
      .set(updateData)
      .where(eq(discussionThreads.id, id))
      .returning();

    const thread = result[0];
    if (!thread) {
      throw new Error('Thread not found');
    }

    return thread;
  }

  /**
   * Delete thread (soft delete)
   */
  async deleteThread(id: string): Promise<void> {
    // For now, we'll implement hard delete since there's no soft delete field in schema
    // In a production system, you might want to add an isDeleted field
    await this.db
      .delete(discussionThreads)
      .where(eq(discussionThreads.id, id));
  }

  /**
   * Increment thread view count
   */
  async incrementThreadViewCount(id: string): Promise<void> {
    await this.db
      .update(discussionThreads)
      .set({
        viewCount: sql`${discussionThreads.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(discussionThreads.id, id));
  }

  /**
   * Increment thread reply count
   */
  async incrementThreadReplyCount(id: string): Promise<void> {
    await this.db
      .update(discussionThreads)
      .set({
        replyCount: sql`${discussionThreads.replyCount} + 1`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discussionThreads.id, id));
  }

  /**
   * Update thread last activity timestamp
   */
  async updateThreadLastActivity(id: string): Promise<void> {
    await this.db
      .update(discussionThreads)
      .set({
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discussionThreads.id, id));
  }

  // Post operations

  /**
   * Create a new discussion post
   */
  async createPost(data: CreateDiscussionPostDTO): Promise<DiscussionPost> {
    const postData: NewDiscussionPost = {
      threadId: data.threadId,
      authorId: data.authorId,
      parentPostId: data.parentPostId || null,
      content: data.content,
      upvoteCount: 0,
      isSolution: false,
      editedAt: null,
      editHistory: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [post] = await this.db
      .insert(discussionPosts)
      .values(postData)
      .returning();

    if (!post) {
      throw new Error('Failed to create discussion post');
    }

    // Increment thread reply count
    await this.incrementThreadReplyCount(data.threadId);

    return post;
  }

  /**
   * Find post by ID
   */
  async findPostById(id: string): Promise<DiscussionPost | null> {
    const [post] = await this.db
      .select()
      .from(discussionPosts)
      .where(and(
        eq(discussionPosts.id, id),
        eq(discussionPosts.isDeleted, false)
      ))
      .limit(1);

    return post || null;
  }

  /**
   * Find posts by thread with nested structure
   */
  async findPostsByThread(
    threadId: string,
    userId?: string,
    pagination?: DiscussionPagination
  ): Promise<PaginatedResult<PostWithReplies>> {
    // First, get all posts for the thread
    const allPosts = await this.db
      .select({
        // Post fields
        id: discussionPosts.id,
        threadId: discussionPosts.threadId,
        authorId: discussionPosts.authorId,
        parentPostId: discussionPosts.parentPostId,
        content: discussionPosts.content,
        upvoteCount: discussionPosts.upvoteCount,
        isSolution: discussionPosts.isSolution,
        editedAt: discussionPosts.editedAt,
        editHistory: discussionPosts.editHistory,
        isDeleted: discussionPosts.isDeleted,
        createdAt: discussionPosts.createdAt,
        updatedAt: discussionPosts.updatedAt,
        // Author fields
        authorEmail: users.email,
        authorFullName: sql<string>`COALESCE((SELECT full_name FROM user_profiles WHERE user_id = ${users.id}), ${users.email})`,
        authorAvatarUrl: sql<string | null>`(SELECT avatar_url FROM user_profiles WHERE user_id = ${users.id})`,
      })
      .from(discussionPosts)
      .leftJoin(users, eq(discussionPosts.authorId, users.id))
      .where(and(
        eq(discussionPosts.threadId, threadId),
        eq(discussionPosts.isDeleted, false)
      ))
      .orderBy(asc(discussionPosts.createdAt));

    // Get user votes if userId is provided
    let userVotes: Set<string> = new Set();
    if (userId && allPosts.length > 0) {
      const postIds = allPosts.map(p => p.id);
      const votes = await this.db
        .select({ postId: postVotes.postId })
        .from(postVotes)
        .where(and(
          eq(postVotes.userId, userId),
          inArray(postVotes.postId, postIds)
        ));
      userVotes = new Set(votes.map(v => v.postId));
    }

    // Transform to PostWithReplies and build nested structure
    const postsMap = new Map<string, PostWithReplies>();
    const topLevelPosts: PostWithReplies[] = [];

    // First pass: create all posts
    for (const row of allPosts) {
      const post: PostWithReplies = {
        id: row.id,
        threadId: row.threadId,
        authorId: row.authorId,
        parentPostId: row.parentPostId,
        content: row.content,
        upvoteCount: row.upvoteCount,
        isSolution: row.isSolution,
        editedAt: row.editedAt,
        editHistory: row.editHistory,
        isDeleted: row.isDeleted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        replies: [],
        author: row.authorEmail ? {
          id: row.authorId,
          email: row.authorEmail,
          fullName: row.authorFullName,
          avatarUrl: row.authorAvatarUrl || undefined,
        } : undefined,
        hasUserVoted: userId ? userVotes.has(row.id) : undefined,
      };

      postsMap.set(row.id, post);

      if (!row.parentPostId) {
        topLevelPosts.push(post);
      }
    }

    // Second pass: build nested structure
    for (const post of postsMap.values()) {
      if (post.parentPostId) {
        const parent = postsMap.get(post.parentPostId);
        if (parent) {
          parent.replies!.push(post);
        }
      }
    }

    // Apply pagination to top-level posts only
    const paginatedPosts = pagination 
      ? topLevelPosts.slice(pagination.offset, pagination.offset + pagination.limit)
      : topLevelPosts;

    return {
      items: paginatedPosts,
      totalCount: topLevelPosts.length,
      hasMore: pagination 
        ? pagination.offset + paginatedPosts.length < topLevelPosts.length
        : false,
      nextCursor: paginatedPosts.length > 0 
        ? paginatedPosts[paginatedPosts.length - 1]?.id 
        : undefined
    };
  }

  /**
   * Find posts by author
   */
  async findPostsByAuthor(
    authorId: string,
    pagination: DiscussionPagination
  ): Promise<PaginatedResult<DiscussionPost>> {
    // Get total count
    const totalCountResult = await this.db
      .select({ totalCount: count() })
      .from(discussionPosts)
      .where(and(
        eq(discussionPosts.authorId, authorId),
        eq(discussionPosts.isDeleted, false)
      ));
    
    const totalCount = totalCountResult[0]?.totalCount || 0;

    // Get posts
    const posts = await this.db
      .select()
      .from(discussionPosts)
      .where(and(
        eq(discussionPosts.authorId, authorId),
        eq(discussionPosts.isDeleted, false)
      ))
      .orderBy(desc(discussionPosts.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return {
      items: posts,
      totalCount: Number(totalCount),
      hasMore: pagination.offset + posts.length < Number(totalCount),
      nextCursor: posts.length > 0 
        ? posts[posts.length - 1]?.id 
        : undefined
    };
  }

  /**
   * Update post
   */
  async updatePost(id: string, data: UpdateDiscussionPostDTO): Promise<DiscussionPost> {
    const updateData: Partial<NewDiscussionPost> = {
      ...data,
      updatedAt: new Date(),
    };

    // If content is being updated, set editedAt timestamp
    if (data.content) {
      updateData.editedAt = new Date();
    }

    const result = await this.db
      .update(discussionPosts)
      .set(updateData)
      .where(eq(discussionPosts.id, id))
      .returning();

    const post = result[0];
    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  /**
   * Delete post (soft delete)
   */
  async deletePost(id: string): Promise<void> {
    await this.db
      .update(discussionPosts)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(discussionPosts.id, id));
  }

  /**
   * Mark post as solution
   */
  async markPostAsSolution(postId: string, isSolution: boolean): Promise<DiscussionPost> {
    const result = await this.db
      .update(discussionPosts)
      .set({
        isSolution,
        updatedAt: new Date(),
      })
      .where(eq(discussionPosts.id, postId))
      .returning();

    const post = result[0];
    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  // Voting operations

  /**
   * Vote on a post (upvote or remove vote)
   */
  async voteOnPost(postId: string, userId: string, voteType: VoteType): Promise<void> {
    if (voteType === VoteType.UPVOTE) {
      // Check if user has already voted
      const existingVote = await this.db
        .select()
        .from(postVotes)
        .where(and(
          eq(postVotes.postId, postId),
          eq(postVotes.userId, userId)
        ))
        .limit(1);

      if (existingVote.length === 0) {
        // Add vote
        await this.db.insert(postVotes).values({
          postId,
          userId,
          createdAt: new Date(),
        });

        // Increment upvote count
        await this.db
          .update(discussionPosts)
          .set({
            upvoteCount: sql`${discussionPosts.upvoteCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(discussionPosts.id, postId));
      }
    } else if (voteType === VoteType.REMOVE_VOTE) {
      // Remove vote
      const deletedVotes = await this.db
        .delete(postVotes)
        .where(and(
          eq(postVotes.postId, postId),
          eq(postVotes.userId, userId)
        ))
        .returning();

      if (deletedVotes.length > 0) {
        // Decrement upvote count
        await this.db
          .update(discussionPosts)
          .set({
            upvoteCount: sql`GREATEST(0, ${discussionPosts.upvoteCount} - 1)`,
            updatedAt: new Date(),
          })
          .where(eq(discussionPosts.id, postId));
      }
    }
  }

  /**
   * Check if user has voted on a post
   */
  async hasUserVotedOnPost(postId: string, userId: string): Promise<boolean> {
    const [vote] = await this.db
      .select()
      .from(postVotes)
      .where(and(
        eq(postVotes.postId, postId),
        eq(postVotes.userId, userId)
      ))
      .limit(1);

    return !!vote;
  }

  /**
   * Get vote count for a post
   */
  async getPostVoteCount(postId: string): Promise<number> {
    const voteCountResult = await this.db
      .select({ voteCount: count() })
      .from(postVotes)
      .where(eq(postVotes.postId, postId));

    return Number(voteCountResult[0]?.voteCount || 0);
  }

  /**
   * Get posts voted by user
   */
  async getPostsVotedByUser(userId: string, pagination: DiscussionPagination): Promise<PaginatedResult<DiscussionPost>> {
    // Get total count
    const totalCountResult = await this.db
      .select({ totalCount: count() })
      .from(postVotes)
      .innerJoin(discussionPosts, eq(postVotes.postId, discussionPosts.id))
      .where(and(
        eq(postVotes.userId, userId),
        eq(discussionPosts.isDeleted, false)
      ));
    
    const totalCount = totalCountResult[0]?.totalCount || 0;

    // Get posts
    const posts = await this.db
      .select({
        id: discussionPosts.id,
        threadId: discussionPosts.threadId,
        authorId: discussionPosts.authorId,
        parentPostId: discussionPosts.parentPostId,
        content: discussionPosts.content,
        upvoteCount: discussionPosts.upvoteCount,
        isSolution: discussionPosts.isSolution,
        editedAt: discussionPosts.editedAt,
        editHistory: discussionPosts.editHistory,
        isDeleted: discussionPosts.isDeleted,
        createdAt: discussionPosts.createdAt,
        updatedAt: discussionPosts.updatedAt,
      })
      .from(postVotes)
      .innerJoin(discussionPosts, eq(postVotes.postId, discussionPosts.id))
      .where(and(
        eq(postVotes.userId, userId),
        eq(discussionPosts.isDeleted, false)
      ))
      .orderBy(desc(postVotes.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return {
      items: posts,
      totalCount: Number(totalCount),
      hasMore: pagination.offset + posts.length < Number(totalCount),
      nextCursor: posts.length > 0 
        ? posts[posts.length - 1]?.id 
        : undefined
    };
  }

  // Statistics and analytics

  /**
   * Get thread statistics for a course
   */
  async getThreadStatistics(courseId: string): Promise<{
    totalThreads: number;
    totalPosts: number;
    activeThreads: number;
    pinnedThreads: number;
  }> {
    // Get thread counts
    const threadStatsResult = await this.db
      .select({
        totalThreads: count(),
        pinnedThreads: sql<number>`COUNT(CASE WHEN ${discussionThreads.isPinned} = true THEN 1 END)`,
        activeThreads: sql<number>`COUNT(CASE WHEN ${discussionThreads.replyCount} > 0 THEN 1 END)`,
      })
      .from(discussionThreads)
      .where(eq(discussionThreads.courseId, courseId));

    const threadStats = threadStatsResult[0];

    // Get total posts count
    const postStatsResult = await this.db
      .select({ totalPosts: count() })
      .from(discussionPosts)
      .innerJoin(discussionThreads, eq(discussionPosts.threadId, discussionThreads.id))
      .where(and(
        eq(discussionThreads.courseId, courseId),
        eq(discussionPosts.isDeleted, false)
      ));

    const postStats = postStatsResult[0];

    return {
      totalThreads: Number(threadStats?.totalThreads || 0),
      totalPosts: Number(postStats?.totalPosts || 0),
      activeThreads: Number(threadStats?.activeThreads || 0),
      pinnedThreads: Number(threadStats?.pinnedThreads || 0),
    };
  }

  /**
   * Get user participation statistics
   */
  async getUserParticipationStats(userId: string, courseId?: string): Promise<{
    threadsCreated: number;
    postsCreated: number;
    solutionsMarked: number;
    votesReceived: number;
  }> {
    // Build where conditions
    const threadWhere = courseId 
      ? and(eq(discussionThreads.authorId, userId), eq(discussionThreads.courseId, courseId))
      : eq(discussionThreads.authorId, userId);

    const postWhere = courseId
      ? and(
          eq(discussionPosts.authorId, userId),
          eq(discussionPosts.isDeleted, false)
        )
      : and(eq(discussionPosts.authorId, userId), eq(discussionPosts.isDeleted, false));

    // Get threads created
    const threadCountResult = await this.db
      .select({ count: count() })
      .from(discussionThreads)
      .where(threadWhere);

    // Get posts created
    const postCountResult = await this.db
      .select({ count: count() })
      .from(discussionPosts)
      .where(postWhere);

    // Get solutions marked
    const solutionCountResult = await this.db
      .select({ count: count() })
      .from(discussionPosts)
      .where(and(
        postWhere,
        eq(discussionPosts.isSolution, true)
      ));

    // Get votes received
    const voteCountResult = await this.db
      .select({ count: count() })
      .from(postVotes)
      .innerJoin(discussionPosts, eq(postVotes.postId, discussionPosts.id))
      .where(and(
        eq(discussionPosts.authorId, userId),
        eq(discussionPosts.isDeleted, false)
      ));

    const threadCount = threadCountResult[0];
    const postCount = postCountResult[0];
    const solutionCount = solutionCountResult[0];
    const voteCount = voteCountResult[0];

    return {
      threadsCreated: Number(threadCount?.count || 0),
      postsCreated: Number(postCount?.count || 0),
      solutionsMarked: Number(solutionCount?.count || 0),
      votesReceived: Number(voteCount?.count || 0),
    };
  }
}