/**
 * Notification Entity
 *
 * Core domain entity representing a system notification.
 * Encapsulates notification content, delivery status, and business rules.
 *
 * Requirements: 10.1, 10.4, 10.5, 10.6
 */

/**
 * Notification type enumeration
 */
export type NotificationType =
  | 'new_message'
  | 'assignment_due'
  | 'grade_posted'
  | 'course_update'
  | 'announcement'
  | 'discussion_reply'
  | 'enrollment_confirmed'
  | 'certificate_issued'
  | 'payment_received'
  | 'refund_processed';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'normal' | 'high' | 'urgent';

/**
 * Notification metadata interface
 */
export interface NotificationMetadata {
  courseId?: string;
  lessonId?: string;
  assignmentId?: string;
  quizId?: string;
  messageId?: string;
  discussionThreadId?: string;
  paymentId?: string;
  enrollmentId?: string;
  [key: string]: unknown;
}

/**
 * Notification entity properties
 */
export interface NotificationProps {
  id: string;
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date;
  metadata: NotificationMetadata;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * Notification creation properties (for new notifications)
 */
export interface CreateNotificationProps {
  recipientId: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  metadata?: NotificationMetadata;
  expiresAt?: Date;
}

/**
 * Notification batch group interface
 */
export interface NotificationBatchGroup {
  recipientId: string;
  notificationType: NotificationType;
  notifications: Notification[];
  batchTitle: string;
  batchContent: string;
  priority: NotificationPriority;
  metadata: NotificationMetadata;
}

/**
 * Notification entity
 *
 * Represents a system notification with content, delivery status, and business rules.
 * Enforces validation and provides methods for notification lifecycle management.
 */
export class Notification {
  private readonly _id: string;
  private readonly _recipientId: string;
  private readonly _notificationType: NotificationType;
  private readonly _title: string;
  private readonly _content: string;
  private readonly _actionUrl?: string;
  private readonly _priority: NotificationPriority;
  private _isRead: boolean;
  private _readAt?: Date;
  private readonly _metadata: NotificationMetadata;
  private readonly _expiresAt?: Date;
  private readonly _createdAt: Date;

  /**
   * Creates a new Notification entity
   *
   * @param props - Notification properties
   */
  private constructor(props: NotificationProps) {
    this._id = props.id;
    this._recipientId = props.recipientId;
    this._notificationType = props.notificationType;
    this._title = props.title;
    this._content = props.content;
    this._actionUrl = props.actionUrl;
    this._priority = props.priority;
    this._isRead = props.isRead;
    this._readAt = props.readAt;
    this._metadata = { ...props.metadata };
    this._expiresAt = props.expiresAt;
    this._createdAt = props.createdAt;
  }

  /**
   * Factory method to create a new Notification entity
   *
   * @param props - Notification creation properties
   * @returns Notification entity
   * @throws Error if validation fails
   */
  static create(props: CreateNotificationProps): Notification {
    // Generate ID (in real implementation, this would come from a UUID generator)
    const id = crypto.randomUUID();
    const createdAt = new Date();

    // Validate required fields
    if (!props.recipientId || props.recipientId.trim().length === 0) {
      throw new Error('Recipient ID is required');
    }

    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Notification title is required');
    }

    if (props.title.length > 255) {
      throw new Error('Notification title cannot exceed 255 characters');
    }

    if (!props.content || props.content.trim().length === 0) {
      throw new Error('Notification content is required');
    }

    if (props.content.length > 10000) {
      throw new Error('Notification content cannot exceed 10000 characters');
    }

    // Validate notification type
    const validTypes: NotificationType[] = [
      'new_message',
      'assignment_due',
      'grade_posted',
      'course_update',
      'announcement',
      'discussion_reply',
      'enrollment_confirmed',
      'certificate_issued',
      'payment_received',
      'refund_processed',
    ];
    if (!validTypes.includes(props.notificationType)) {
      throw new Error(`Invalid notification type: ${props.notificationType}`);
    }

    // Validate priority
    const priority = props.priority || 'normal';
    const validPriorities: NotificationPriority[] = ['normal', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    // Validate action URL if provided
    if (props.actionUrl && props.actionUrl.length > 500) {
      throw new Error('Action URL cannot exceed 500 characters');
    }

    // Validate expiration date if provided
    if (props.expiresAt && props.expiresAt <= createdAt) {
      throw new Error('Expiration date must be in the future');
    }

    // Set default expiration for certain notification types if not provided
    let expiresAt = props.expiresAt;
    if (!expiresAt) {
      expiresAt = Notification.getDefaultExpiration(props.notificationType, createdAt);
    }

    const notificationProps: NotificationProps = {
      id,
      recipientId: props.recipientId,
      notificationType: props.notificationType,
      title: props.title.trim(),
      content: props.content.trim(),
      actionUrl: props.actionUrl?.trim(),
      priority,
      isRead: false,
      metadata: props.metadata || {},
      expiresAt,
      createdAt,
    };

    return new Notification(notificationProps);
  }

  /**
   * Factory method to reconstitute a Notification entity from persistence
   *
   * @param props - Notification properties from database
   * @returns Notification entity
   */
  static fromPersistence(props: NotificationProps): Notification {
    return new Notification(props);
  }

  /**
   * Gets default expiration date for a notification type
   *
   * @param notificationType - Type of notification
   * @param createdAt - Creation date
   * @returns Default expiration date or undefined for non-expiring notifications
   */
  private static getDefaultExpiration(
    notificationType: NotificationType,
    createdAt: Date
  ): Date | undefined {
    const expirationDays: Record<NotificationType, number | null> = {
      new_message: 30, // Messages expire after 30 days
      assignment_due: null, // Assignment due notifications don't expire
      grade_posted: null, // Grade notifications don't expire
      course_update: 7, // Course updates expire after 7 days
      announcement: 14, // Announcements expire after 14 days
      discussion_reply: 7, // Discussion replies expire after 7 days
      enrollment_confirmed: null, // Enrollment confirmations don't expire
      certificate_issued: null, // Certificate notifications don't expire
      payment_received: null, // Payment confirmations don't expire
      refund_processed: null, // Refund notifications don't expire
    };

    const days = expirationDays[notificationType];
    if (days === null) {
      return undefined;
    }

    const expirationDate = new Date(createdAt);
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get recipientId(): string {
    return this._recipientId;
  }

  get notificationType(): NotificationType {
    return this._notificationType;
  }

  get title(): string {
    return this._title;
  }

  get content(): string {
    return this._content;
  }

  get actionUrl(): string | undefined {
    return this._actionUrl;
  }

  get priority(): NotificationPriority {
    return this._priority;
  }

  get isRead(): boolean {
    return this._isRead;
  }

  get readAt(): Date | undefined {
    return this._readAt;
  }

  get metadata(): NotificationMetadata {
    return { ...this._metadata };
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  // Business logic methods

  /**
   * Checks if the notification is expired
   *
   * @param currentDate - Current date (defaults to now)
   * @returns True if notification is expired
   */
  isExpired(currentDate: Date = new Date()): boolean {
    if (!this._expiresAt) {
      return false;
    }
    return currentDate > this._expiresAt;
  }

  /**
   * Checks if the notification is urgent priority
   *
   * @returns True if notification is urgent
   */
  isUrgent(): boolean {
    return this._priority === 'urgent';
  }

  /**
   * Checks if the notification is high priority
   *
   * @returns True if notification is high priority
   */
  isHighPriority(): boolean {
    return this._priority === 'high';
  }

  /**
   * Checks if the notification can be batched with similar notifications
   *
   * @returns True if notification can be batched
   */
  canBeBatched(): boolean {
    // Urgent notifications should not be batched
    if (this.isUrgent()) {
      return false;
    }

    // Certain notification types can be batched
    const batchableTypes: NotificationType[] = [
      'course_update',
      'announcement',
      'discussion_reply',
      'new_message',
    ];

    return batchableTypes.includes(this._notificationType);
  }

  /**
   * Checks if this notification can be batched with another notification
   *
   * @param other - Another notification
   * @returns True if notifications can be batched together
   */
  canBatchWith(other: Notification): boolean {
    if (!this.canBeBatched() || !other.canBeBatched()) {
      return false;
    }

    // Must be for the same recipient and notification type
    return (
      this._recipientId === other._recipientId &&
      this._notificationType === other._notificationType &&
      this._priority === other._priority
    );
  }

  /**
   * Marks the notification as read
   *
   * @throws Error if notification is already read
   */
  markAsRead(): void {
    if (this._isRead) {
      throw new Error('Notification is already marked as read');
    }

    if (this.isExpired()) {
      throw new Error('Cannot mark expired notification as read');
    }

    this._isRead = true;
    this._readAt = new Date();
  }

  /**
   * Marks the notification as unread (for testing or admin purposes)
   *
   * @throws Error if notification is not read
   */
  markAsUnread(): void {
    if (!this._isRead) {
      throw new Error('Notification is already unread');
    }

    this._isRead = false;
    this._readAt = undefined;
  }

  /**
   * Gets the age of the notification in milliseconds
   *
   * @param currentDate - Current date (defaults to now)
   * @returns Age in milliseconds
   */
  getAge(currentDate: Date = new Date()): number {
    return currentDate.getTime() - this._createdAt.getTime();
  }

  /**
   * Gets the time until expiration in milliseconds
   *
   * @param currentDate - Current date (defaults to now)
   * @returns Time until expiration in milliseconds, or null if no expiration
   */
  getTimeUntilExpiration(currentDate: Date = new Date()): number | null {
    if (!this._expiresAt) {
      return null;
    }
    return this._expiresAt.getTime() - currentDate.getTime();
  }

  /**
   * Creates a batch group from multiple notifications
   *
   * @param notifications - Array of notifications to batch
   * @returns Notification batch group
   * @throws Error if notifications cannot be batched together
   */
  static createBatchGroup(notifications: Notification[]): NotificationBatchGroup {
    if (notifications.length === 0) {
      throw new Error('Cannot create batch group from empty notifications array');
    }

    if (notifications.length === 1) {
      throw new Error('Cannot create batch group from single notification');
    }

    // Validate all notifications can be batched together
    const firstNotification = notifications[0];
    if (!firstNotification) {
      throw new Error('First notification is undefined');
    }

    for (let i = 1; i < notifications.length; i++) {
      const currentNotification = notifications[i];
      if (!currentNotification) {
        throw new Error(`Notification at index ${i} is undefined`);
      }
      if (!firstNotification.canBatchWith(currentNotification)) {
        throw new Error(`Notification ${currentNotification.id} cannot be batched with others`);
      }
    }

    // Generate batch content based on notification type
    const batchTitle = Notification.generateBatchTitle(
      firstNotification.notificationType,
      notifications.length
    );

    const batchContent = Notification.generateBatchContent(
      firstNotification.notificationType,
      notifications
    );

    // Combine metadata from all notifications
    const combinedMetadata: NotificationMetadata = {};
    notifications.forEach((notification) => {
      Object.assign(combinedMetadata, notification.metadata);
    });

    return {
      recipientId: firstNotification.recipientId,
      notificationType: firstNotification.notificationType,
      notifications,
      batchTitle,
      batchContent,
      priority: firstNotification.priority,
      metadata: combinedMetadata,
    };
  }

  /**
   * Generates a batch title for multiple notifications
   *
   * @param notificationType - Type of notifications
   * @param count - Number of notifications
   * @returns Batch title
   */
  private static generateBatchTitle(notificationType: NotificationType, count: number): string {
    const titleTemplates: Record<NotificationType, string> = {
      new_message: `${count} new messages`,
      assignment_due: `${count} assignments due`,
      grade_posted: `${count} new grades posted`,
      course_update: `${count} course updates`,
      announcement: `${count} new announcements`,
      discussion_reply: `${count} new discussion replies`,
      enrollment_confirmed: `${count} enrollment confirmations`,
      certificate_issued: `${count} certificates issued`,
      payment_received: `${count} payment confirmations`,
      refund_processed: `${count} refund notifications`,
    };

    return titleTemplates[notificationType] || `${count} notifications`;
  }

  /**
   * Generates batch content for multiple notifications
   *
   * @param notificationType - Type of notifications
   * @param notifications - Array of notifications
   * @returns Batch content
   */
  private static generateBatchContent(
    notificationType: NotificationType,
    notifications: Notification[]
  ): string {
    const count = notifications.length;

    switch (notificationType) {
      case 'new_message':
        return `You have ${count} new messages waiting for you.`;

      case 'assignment_due':
        return `You have ${count} assignments due soon. Don't forget to submit them on time.`;

      case 'grade_posted':
        return `${count} new grades have been posted for your courses.`;

      case 'course_update':
        return `${count} of your courses have been updated with new content or information.`;

      case 'announcement':
        return `${count} new announcements have been posted in your courses.`;

      case 'discussion_reply':
        return `You have ${count} new replies in course discussions you're following.`;

      default:
        return `You have ${count} new notifications.`;
    }
  }

  /**
   * Converts the entity to a plain object for persistence
   *
   * @returns Plain object representation
   */
  toPersistence(): {
    id: string;
    recipientId: string;
    notificationType: NotificationType;
    title: string;
    content: string;
    actionUrl?: string;
    priority: NotificationPriority;
    isRead: boolean;
    readAt?: Date;
    metadata: NotificationMetadata;
    expiresAt?: Date;
    createdAt: Date;
  } {
    return {
      id: this._id,
      recipientId: this._recipientId,
      notificationType: this._notificationType,
      title: this._title,
      content: this._content,
      actionUrl: this._actionUrl,
      priority: this._priority,
      isRead: this._isRead,
      readAt: this._readAt,
      metadata: { ...this._metadata },
      expiresAt: this._expiresAt,
      createdAt: this._createdAt,
    };
  }

  /**
   * Returns JSON representation
   *
   * @returns JSON object
   */
  toJSON(): {
    id: string;
    recipientId: string;
    notificationType: NotificationType;
    title: string;
    content: string;
    actionUrl?: string;
    priority: NotificationPriority;
    isRead: boolean;
    readAt?: Date;
    metadata: NotificationMetadata;
    expiresAt?: Date;
    createdAt: Date;
  } {
    return this.toPersistence();
  }
}
