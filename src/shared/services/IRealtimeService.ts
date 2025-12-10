/**
 * Real-time Service Interface
 * 
 * Defines the contract for real-time communication services
 * Used by application services to emit real-time events
 * 
 * Requirements: 9.6, 9.7, 9.8
 */

/**
 * User presence status
 */
export type PresenceStatus = 'online' | 'offline' | 'away';

/**
 * Real-time event types
 */
export interface RealtimeEvents {
  // Notification events
  'notification-received': {
    notificationId: string;
    type: string;
    title: string;
    content: string;
    actionUrl?: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: string;
  };

  // Message events
  'message-received': {
    messageId: string;
    senderId: string;
    senderName: string;
    content: string;
    conversationId: string;
    timestamp: string;
  };

  // Discussion events
  'discussion-post-created': {
    postId: string;
    threadId: string;
    authorId: string;
    authorName: string;
    content: string;
    timestamp: string;
  };

  'discussion-post-voted': {
    postId: string;
    threadId: string;
    voteCount: number;
    voterId: string;
  };

  'discussion-solution-marked': {
    postId: string;
    threadId: string;
    authorId: string;
    markedBy: string;
  };

  // Course events
  'course-updated': {
    courseId: string;
    updateType: 'content' | 'metadata' | 'published';
    timestamp: string;
  };

  'lesson-progress-updated': {
    enrollmentId: string;
    lessonId: string;
    status: 'not_started' | 'in_progress' | 'completed';
    progressPercentage: number;
  };

  // Quiz events
  'quiz-started': {
    quizId: string;
    submissionId: string;
    studentId: string;
    startTime: string;
  };

  'quiz-submitted': {
    quizId: string;
    submissionId: string;
    studentId: string;
    score?: number;
    gradingStatus: string;
  };

  // Assignment events
  'assignment-submitted': {
    assignmentId: string;
    submissionId: string;
    studentId: string;
    submittedAt: string;
    isLate: boolean;
  };

  'assignment-graded': {
    assignmentId: string;
    submissionId: string;
    studentId: string;
    pointsAwarded: number;
    feedback?: string;
  };

  // Announcement events
  'announcement-published': {
    announcementId: string;
    courseId: string;
    title: string;
    content: string;
    publishedAt: string;
  };

  // Presence events
  'user-presence': {
    userId: string;
    status: PresenceStatus;
    timestamp: string;
  };

  // Typing events
  'user-typing': {
    userId: string;
    type: 'start' | 'stop';
  };

  // Certificate events
  'certificate-generated': {
    certificateId: string;
    enrollmentId: string;
    studentId: string;
    courseId: string;
    pdfUrl: string;
    verificationUrl: string;
  };

  // Payment events
  'payment-completed': {
    paymentId: string;
    enrollmentId: string;
    studentId: string;
    courseId: string;
    amount: number;
    currency: string;
  };

  // Error events
  'error': {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Real-time service interface for emitting events to users and rooms
 */
export interface IRealtimeService {
  /**
   * Emits an event to a specific user
   */
  emitToUser<K extends keyof RealtimeEvents>(
    userId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void>;

  /**
   * Emits an event to a specific room
   */
  emitToRoom<K extends keyof RealtimeEvents>(
    room: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void>;

  /**
   * Emits an event to all users in a course
   */
  emitToCourse<K extends keyof RealtimeEvents>(
    courseId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void>;

  /**
   * Emits an event to a conversation between two users
   */
  emitToConversation<K extends keyof RealtimeEvents>(
    userId1: string,
    userId2: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void>;

  /**
   * Emits an event to a discussion thread
   */
  emitToThread<K extends keyof RealtimeEvents>(
    threadId: string,
    event: K,
    data: RealtimeEvents[K]
  ): Promise<void>;

  /**
   * Broadcasts user presence to relevant rooms
   */
  broadcastPresence(
    userId: string,
    status: PresenceStatus,
    courseIds?: string[]
  ): Promise<void>;

  /**
   * Gets online users in a course
   */
  getOnlineUsersInCourse(courseId: string): Promise<string[]>;

  /**
   * Gets user presence status
   */
  getUserPresence(userId: string): Promise<{
    status: PresenceStatus;
    lastSeen?: string;
  } | null>;
}