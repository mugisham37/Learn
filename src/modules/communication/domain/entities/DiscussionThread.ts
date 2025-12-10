/**
 * Discussion Thread Domain Entity
 * 
 * Represents a discussion thread in a course forum
 * Contains business logic for thread management and validation
 */

/**
 * Discussion Thread Entity
 * 
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 * - 9.3: Reply threading with nested structure
 */
export class DiscussionThread {
  constructor(
    public readonly id: string,
    public readonly courseId: string,
    public readonly authorId: string,
    public readonly category: string,
    public readonly title: string,
    public readonly content: string,
    public readonly isPinned: boolean = false,
    public readonly isLocked: boolean = false,
    public readonly viewCount: number = 0,
    public readonly replyCount: number = 0,
    public readonly lastActivityAt: Date = new Date(),
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validateTitle();
    this.validateContent();
    this.validateCategory();
  }

  /**
   * Validate thread title
   */
  private validateTitle(): void {
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Thread title is required');
    }
    if (this.title.length > 255) {
      throw new Error('Thread title must be 255 characters or less');
    }
  }

  /**
   * Validate thread content
   */
  private validateContent(): void {
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Thread content is required');
    }
  }

  /**
   * Validate thread category
   */
  private validateCategory(): void {
    if (!this.category || this.category.trim().length === 0) {
      throw new Error('Thread category is required');
    }
    if (this.category.length > 100) {
      throw new Error('Thread category must be 100 characters or less');
    }
  }

  /**
   * Check if thread can be replied to
   */
  canReply(): boolean {
    return !this.isLocked;
  }

  /**
   * Check if thread can be pinned/unpinned by user
   */
  canPin(userRole: string): boolean {
    return userRole === 'educator' || userRole === 'admin';
  }

  /**
   * Check if thread can be locked/unlocked by user
   */
  canLock(userRole: string): boolean {
    return userRole === 'educator' || userRole === 'admin';
  }

  /**
   * Create a new thread instance with updated reply count
   */
  withIncrementedReplyCount(): DiscussionThread {
    return new DiscussionThread(
      this.id,
      this.courseId,
      this.authorId,
      this.category,
      this.title,
      this.content,
      this.isPinned,
      this.isLocked,
      this.viewCount,
      this.replyCount + 1,
      new Date(), // Update last activity
      this.createdAt,
      new Date() // Update timestamp
    );
  }

  /**
   * Create a new thread instance with updated view count
   */
  withIncrementedViewCount(): DiscussionThread {
    return new DiscussionThread(
      this.id,
      this.courseId,
      this.authorId,
      this.category,
      this.title,
      this.content,
      this.isPinned,
      this.isLocked,
      this.viewCount + 1,
      this.replyCount,
      this.lastActivityAt,
      this.createdAt,
      new Date() // Update timestamp
    );
  }

  /**
   * Create a new thread instance with pinned status
   */
  withPinnedStatus(isPinned: boolean): DiscussionThread {
    return new DiscussionThread(
      this.id,
      this.courseId,
      this.authorId,
      this.category,
      this.title,
      this.content,
      isPinned,
      this.isLocked,
      this.viewCount,
      this.replyCount,
      this.lastActivityAt,
      this.createdAt,
      new Date() // Update timestamp
    );
  }

  /**
   * Create a new thread instance with locked status
   */
  withLockedStatus(isLocked: boolean): DiscussionThread {
    return new DiscussionThread(
      this.id,
      this.courseId,
      this.authorId,
      this.category,
      this.title,
      this.content,
      this.isPinned,
      isLocked,
      this.viewCount,
      this.replyCount,
      this.lastActivityAt,
      this.createdAt,
      new Date() // Update timestamp
    );
  }
}

/**
 * Data Transfer Object for creating a new discussion thread
 */
export interface CreateDiscussionThreadDTO {
  courseId: string;
  authorId: string;
  category: string;
  title: string;
  content: string;
}

/**
 * Data Transfer Object for updating a discussion thread
 */
export interface UpdateDiscussionThreadDTO {
  title?: string;
  content?: string;
  category?: string;
  isPinned?: boolean;
  isLocked?: boolean;
}