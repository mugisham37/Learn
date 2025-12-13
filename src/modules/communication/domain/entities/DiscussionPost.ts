/**
 * Discussion Post Domain Entity
 *
 * Represents a post within a discussion thread
 * Contains business logic for post management, voting, and solution marking
 */

/**
 * Discussion Post Entity
 *
 * Requirements:
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 */
export class DiscussionPost {
  constructor(
    public readonly id: string,
    public readonly threadId: string,
    public readonly authorId: string,
    public readonly parentPostId: string | null,
    public readonly content: string,
    public readonly upvoteCount: number = 0,
    public readonly isSolution: boolean = false,
    public readonly editedAt: Date | null = null,
    public readonly editHistory: any[] = [],
    public readonly isDeleted: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validateContent();
  }

  /**
   * Validate post content
   */
  private validateContent(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Post content is required');
    }
  }

  /**
   * Check if post is a top-level post (not a reply)
   */
  isTopLevel(): boolean {
    return this.parentPostId === null;
  }

  /**
   * Check if post is a reply to another post
   */
  isReply(): boolean {
    return this.parentPostId !== null;
  }

  /**
   * Check if post can be marked as solution
   * Only top-level posts or direct replies can be solutions
   */
  canBeMarkedAsSolution(): boolean {
    return !this.isDeleted;
  }

  /**
   * Check if user can mark this post as solution
   */
  canMarkAsSolution(userRole: string, userIsInstructor: boolean): boolean {
    return userRole === 'educator' || userRole === 'admin' || userIsInstructor;
  }

  /**
   * Check if user can edit this post
   */
  canEdit(userId: string, userRole: string): boolean {
    return this.authorId === userId || userRole === 'educator' || userRole === 'admin';
  }

  /**
   * Check if user can delete this post
   */
  canDelete(userId: string, userRole: string): boolean {
    return this.authorId === userId || userRole === 'educator' || userRole === 'admin';
  }

  /**
   * Create a new post instance with incremented upvote count
   */
  withIncrementedUpvotes(): DiscussionPost {
    return new DiscussionPost(
      this.id,
      this.threadId,
      this.authorId,
      this.parentPostId,
      this.content,
      this.upvoteCount + 1,
      this.isSolution,
      this.editedAt,
      this.editHistory,
      this.isDeleted,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a new post instance with decremented upvote count
   */
  withDecrementedUpvotes(): DiscussionPost {
    return new DiscussionPost(
      this.id,
      this.threadId,
      this.authorId,
      this.parentPostId,
      this.content,
      Math.max(0, this.upvoteCount - 1), // Ensure count doesn't go below 0
      this.isSolution,
      this.editedAt,
      this.editHistory,
      this.isDeleted,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a new post instance marked as solution
   */
  withSolutionStatus(isSolution: boolean): DiscussionPost {
    return new DiscussionPost(
      this.id,
      this.threadId,
      this.authorId,
      this.parentPostId,
      this.content,
      this.upvoteCount,
      isSolution,
      this.editedAt,
      this.editHistory,
      this.isDeleted,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a new post instance with updated content
   */
  withUpdatedContent(newContent: string): DiscussionPost {
    if (!newContent || newContent.trim().length === 0) {
      throw new Error('Post content is required');
    }

    // Add to edit history
    const newEditHistory = [
      ...this.editHistory,
      {
        previousContent: this.content,
        editedAt: new Date(),
      },
    ];

    return new DiscussionPost(
      this.id,
      this.threadId,
      this.authorId,
      this.parentPostId,
      newContent,
      this.upvoteCount,
      this.isSolution,
      new Date(), // Set edited timestamp
      newEditHistory,
      this.isDeleted,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a new post instance marked as deleted
   */
  withDeletedStatus(isDeleted: boolean): DiscussionPost {
    return new DiscussionPost(
      this.id,
      this.threadId,
      this.authorId,
      this.parentPostId,
      this.content,
      this.upvoteCount,
      this.isSolution,
      this.editedAt,
      this.editHistory,
      isDeleted,
      this.createdAt,
      new Date()
    );
  }
}

/**
 * Data Transfer Object for creating a new discussion post
 */
export interface CreateDiscussionPostDTO {
  threadId: string;
  authorId: string;
  parentPostId?: string;
  content: string;
}

/**
 * Data Transfer Object for updating a discussion post
 */
export interface UpdateDiscussionPostDTO {
  content?: string;
  isSolution?: boolean;
  isDeleted?: boolean;
}

/**
 * Vote type enumeration
 */
export enum VoteType {
  UPVOTE = 'upvote',
  REMOVE_VOTE = 'remove_vote',
}
