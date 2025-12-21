/**
 * GraphQL Response Types
 * 
 * Defines the expected structure of GraphQL responses for server-side data fetching.
 * These types should match the actual GraphQL schema when the backend is available.
 */

// Import entity types to avoid duplication
import type {
  User,
  Course,
  Quiz,
  QuizAttempt,
  Assignment,
  AssignmentSubmission,
  Enrollment,
  PageInfo,
  Message,
  DiscussionThread,
  DiscussionReply,
  Announcement,
  PresenceUpdate,
  ConversationConnection,
  ThreadConnection,
  Certificate,
  LessonProgress,
  StreamingUrl,
  CourseConnection,
  EnrollmentConnection,
} from './entities';

// GraphQL Response wrappers
export interface GraphQLResponse<T> {
  data: T | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  loading?: boolean;
}

// Assessment-related response types
export interface GetQuizResponse {
  quiz: Quiz;
}

export interface GetQuizAttemptResponse {
  quizAttempt: QuizAttempt;
}

export interface GetAssignmentResponse {
  assignment: Assignment;
}

export interface StartQuizResponse {
  startQuiz: QuizAttempt;
}

export interface SubmitQuizResponse {
  submitQuiz: QuizAttempt;
}

export interface SubmitAssignmentResponse {
  submitAssignment: AssignmentSubmission;
}

export interface GradeAssignmentResponse {
  gradeAssignment: AssignmentSubmission;
}

export interface GetQuizAnalyticsResponse {
  quizAnalytics: {
    totalAttempts: number;
    averageScore: number;
    passRate: number;
    averageTimeSpent: number;
    questionAnalytics: Array<{
      questionId: string;
      correctAnswerRate: number;
      averageTimeSpent: number;
      commonWrongAnswers: string[];
    }>;
    scoreDistribution: Array<{
      range: string;
      count: number;
    }>;
    attemptsByDate: Array<{
      date: string;
      count: number;
    }>;
  };
}

export interface GetAssignmentAnalyticsResponse {
  assignmentAnalytics: {
    totalSubmissions: number;
    averageGrade: number;
    submissionRate: number;
    averageTimeToSubmit: number;
    gradeDistribution: Array<{
      range: string;
      count: number;
    }>;
    submissionsByDate: Array<{
      date: string;
      count: number;
    }>;
    lateSubmissions: {
      count: number;
      percentage: number;
    };
  };
}

export interface GetStudentAssessmentProgressResponse {
  studentAssessmentProgress: {
    totalQuizzes: number;
    completedQuizzes: number;
    averageQuizScore: number;
    totalAssignments: number;
    submittedAssignments: number;
    averageAssignmentGrade: number;
    overallProgress: number;
    recentActivity: Array<{
      type: string;
      title: string;
      completedAt: string;
      score: number;
    }>;
  };
}

export interface GetAssessmentAttemptsResponse {
  assessmentAttempts: Array<{
    id: string;
    attemptNumber: number;
    startedAt: string;
    submittedAt?: string;
    score: number;
    status: string;
    timeSpent: number;
    answers: Array<{
      questionId: string;
      answer: string;
      isCorrect: boolean;
      timeSpent: number;
    }>;
  }>;
}

// User-related response types
export interface GetCurrentUserResponse {
  currentUser: User;
}

export interface GetUserByIdResponse {
  user: User;
}

export interface UpdateProfileResponse {
  updateProfile: User;
}

export interface UpdateNotificationPreferencesResponse {
  updateNotificationPreferences: User;
}

export interface LoginResponse {
  login: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
}

export interface RegisterResponse {
  register: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
}

export interface LogoutResponse {
  logout: boolean;
}

export interface VerifyEmailResponse {
  verifyEmail: boolean;
}

export interface RequestPasswordResetResponse {
  requestPasswordReset: boolean;
}

export interface ResetPasswordResponse {
  resetPassword: boolean;
}

export interface RefreshTokenResponse {
  refreshToken: {
    accessToken: string;
    refreshToken: string;
  };
}

// Query response types
export interface MeQueryResponse {
  me: User;
}

export interface CoursesQueryResponse {
  courses: {
    edges: Array<{
      node: Course;
      cursor: string;
    }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export interface CourseBySlugQueryResponse {
  courseBySlug: Course;
}

export interface MyEnrollmentsQueryResponse {
  myEnrollments: {
    edges: Array<{
      node: Enrollment;
      cursor: string;
    }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

// Input types for queries
export interface CourseFilter {
  category?: string;
  difficulty?: string;
  featured?: boolean;
}

export interface CourseSort {
  field: 'CREATED_AT' | 'UPDATED_AT' | 'TITLE' | 'RATING';
  direction: 'ASC' | 'DESC';
}

export interface EnrollmentFilter {
  status?: string;
}

// Utility types for server functions
export interface CoursesResult {
  courses: Course[];
  pageInfo: PageInfo;
  totalCount: number;
  errors?: Array<{ message: string }>;
}

export interface EnrollmentsResult {
  enrollments: Enrollment[];
  pageInfo: PageInfo;
  totalCount: number;
  errors?: Array<{ message: string }>;
}

// Communication-related response types
export interface GetConversationsResponse {
  conversations: ConversationConnection;
}

export interface GetConversationMessagesResponse {
  conversation: {
    id: string;
    participants: User[];
    messages: {
      edges: Array<{
        node: Message;
        cursor: string;
      }>;
      pageInfo: PageInfo;
    };
  };
}

export interface GetDiscussionThreadsResponse {
  discussionThreads: ThreadConnection;
}

export interface GetThreadRepliesResponse {
  discussionThread: {
    id: string;
    title: string;
    content: string;
    author: User;
    course: Course;
    lesson?: {
      id: string;
      title: string;
    };
    isPinned: boolean;
    isLocked: boolean;
    replies: {
      edges: Array<{
        node: DiscussionReply;
        cursor: string;
      }>;
      pageInfo: PageInfo;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface SendMessageResponse {
  sendMessage: Message;
}

export interface CreateThreadResponse {
  createDiscussionThread: DiscussionThread;
}

export interface ReplyToThreadResponse {
  replyToThread: DiscussionReply;
}

export interface MessageAddedSubscription {
  messageAdded: Message;
}

export interface UserTypingSubscription {
  userTyping: {
    userId: string;
    isTyping: boolean;
    conversationId: string;
  };
}

export interface GetAnnouncementsResponse {
  announcements: {
    edges: Array<{
      node: Announcement;
      cursor: string;
    }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export interface CreateAnnouncementResponse {
  createAnnouncement: Announcement;
}

export interface UpdateAnnouncementResponse {
  updateAnnouncement: Announcement;
}

export interface PublishAnnouncementResponse {
  publishAnnouncement: Announcement;
}

export interface DeleteAnnouncementResponse {
  deleteAnnouncement: boolean;
}

export interface GetCoursePresenceResponse {
  coursePresence: PresenceUpdate[];
}

export interface UpdatePresenceResponse {
  updatePresence: boolean;
}

export interface AnnouncementPublishedSubscription {
  announcementPublished: Announcement;
}

export interface UserPresenceSubscription {
  userPresence: PresenceUpdate;
}

export interface ThreadTypingSubscription {
  typingIndicator: {
    userId: string;
    user: User;
    threadId: string;
    isTyping: boolean;
  };
}

// Content-related response types
export interface GetStreamingUrlResponse {
  generateStreamingUrl: StreamingUrl;
}

export interface GetVideoAssetResponse {
  videoAsset: {
    id: string;
    lesson: {
      id: string;
    };
    uploadedBy: {
      id: string;
    };
    originalFileName: string;
    originalFileSize: number;
    mimeType: string;
    s3Bucket: string;
    s3Key: string;
    s3Region: string;
    processingStatus: string;
    processingJobId?: string;
    processingStartedAt?: string;
    processingCompletedAt?: string;
    processingErrorMessage?: string;
    durationSeconds?: number;
    originalResolution?: string;
    originalBitrate?: number;
    originalFrameRate?: number;
    hlsManifestUrl?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    availableResolutions: Array<{
      resolution: string;
      url: string;
      bitrate: number;
      width: number;
      height: number;
    }>;
    cloudfrontDistribution?: string;
    streamingUrls: {
      hls?: string;
      dash?: string;
      mp4?: string;
    };
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    formattedDuration?: string;
    formattedFileSize?: string;
    isProcessing: boolean;
    isProcessed: boolean;
    isProcessingFailed: boolean;
    isReadyForStreaming: boolean;
    processingProgress?: number;
    bestResolution?: {
      resolution: string;
      url: string;
      bitrate: number;
      width: number;
      height: number;
    };
    hasThumbnail: boolean;
    hasPreview: boolean;
    supportsAdaptiveStreaming: boolean;
  };
}

export interface GetFileAssetResponse {
  fileAsset: {
    id: string;
    course?: {
      id: string;
    };
    lesson?: {
      id: string;
    };
    uploadedBy: {
      id: string;
    };
    fileName: string;
    originalFileName: string;
    fileSize: number;
    mimeType: string;
    assetType: string;
    s3Bucket: string;
    s3Key: string;
    s3Region: string;
    isPublic: boolean;
    accessLevel: string;
    cloudfrontUrl?: string;
    processingStatus?: string;
    processingErrorMessage?: string;
    variants?: {
      thumbnail?: string;
      compressed?: string;
      preview?: string;
    };
    description?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
    formattedFileSize: string;
    fileExtension: string;
    displayName: string;
    isImage: boolean;
    isDocument: boolean;
    isAudio: boolean;
    isArchive: boolean;
    isProcessing: boolean;
    isProcessed: boolean;
    isProcessingFailed: boolean;
    isExpired: boolean;
    isPubliclyAccessible: boolean;
    cdnUrl?: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    compressedUrl?: string;
    hasThumbnail: boolean;
    hasPreview: boolean;
    imageDimensions?: {
      width: number;
      height: number;
    };
    pageCount?: number;
    isSafeForPreview: boolean;
    timeUntilExpiration?: number;
    isExpiringSoon: boolean;
    iconClass: string;
  };
}

export interface GetVideoProcessingStatusResponse {
  videoProcessingStatus: {
    id: string;
    videoAsset: {
      id: string;
    };
    jobType: string;
    externalJobId?: string;
    externalServiceName?: string;
    status: string;
    progress: number;
    startedAt?: string;
    completedAt?: string;
    result?: Record<string, unknown>;
    errorMessage?: string;
    errorCode?: string;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt?: string;
    priority: number;
    scheduledFor?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    isPending: boolean;
    isInProgress: boolean;
    isCompleted: boolean;
    isFailed: boolean;
    isCancelled: boolean;
    isFinal: boolean;
    canRetry: boolean;
    isReadyForRetry: boolean;
    isScheduled: boolean;
    isReadyToExecute: boolean;
    duration?: number;
    formattedDuration?: string;
    timeUntilRetry?: number;
    timeUntilScheduled?: number;
    estimatedCompletionTime?: string;
    hasExceededTimeout: boolean;
    priorityDescription: string;
    isHighPriority: boolean;
    jobTypeDescription: string;
  };
}

// Course-related response types
export interface GetCoursesResponse {
  courses: CourseConnection;
}

export interface GetCourseResponse {
  course: Course;
}

export interface GetMyCoursesResponse {
  myCourses: CourseConnection;
}

export interface CreateCourseResponse {
  createCourse: Course;
}

export interface UpdateCourseResponse {
  updateCourse: Course;
}

export interface PublishCourseResponse {
  publishCourse: Course;
}

// Enrollment-related response types
export interface GetMyEnrollmentsResponse {
  myEnrollments: EnrollmentConnection;
}

export interface GetEnrollmentProgressResponse {
  enrollment: Enrollment;
}

export interface EnrollInCourseResponse {
  enrollInCourse: Enrollment;
}

export interface UpdateLessonProgressResponse {
  updateLessonProgress: LessonProgress;
}

export interface GetMyCertificatesResponse {
  myCertificates: Certificate[];
}

export interface VerifyCertificateResponse {
  verifyCertificate: Certificate;
}

export interface CheckEnrollmentEligibilityResponse {
  checkEnrollmentEligibility: {
    eligible: boolean;
    reasons: string[];
    requiresPayment: boolean;
    paymentAmount?: number;
    enrollmentLimit?: number;
    currentEnrollments: number;
  };
}

export interface CheckLessonAccessResponse {
  checkLessonAccess: {
    canAccess: boolean;
    reasons: string[];
    prerequisiteModules?: Array<{
      moduleId: string;
      moduleTitle: string;
      isCompleted: boolean;
    }>;
  };
}

export interface WithdrawEnrollmentResponse {
  withdrawEnrollment: boolean;
}

export interface CompleteLessonResponse {
  completeLesson: LessonProgress;
}

export interface ResetLessonProgressResponse {
  resetLessonProgress: LessonProgress;
}

export interface RegenerateCertificateResponse {
  regenerateCertificate: Certificate;
}

// Payment-related response types
export interface CreateCheckoutSessionResponse {
  createCheckoutSession: {
    sessionId: string;
    sessionUrl: string;
    paymentId: string;
  };
}

export interface GetPaymentHistoryResponse {
  getPaymentHistory: {
    payments: Array<{
      id: string;
      userId: string;
      courseId?: string;
      stripePaymentIntentId?: string;
      stripeCheckoutSessionId?: string;
      amount: number;
      currency: string;
      status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
      paymentMethod?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
      course?: {
        id: string;
        title: string;
        thumbnailUrl?: string;
      };
      refunds: Array<{
        id: string;
        amount: number;
        reason?: string;
        status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
        createdAt: string;
      }>;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GetPaymentResponse {
  getPayment: {
    id: string;
    userId: string;
    courseId?: string;
    stripePaymentIntentId?: string;
    stripeCheckoutSessionId?: string;
    amount: number;
    currency: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    course?: {
      id: string;
      title: string;
      description?: string;
      thumbnailUrl?: string;
      instructor?: {
        id: string;
        profile: {
          fullName: string;
        };
      };
    };
    refunds: Array<{
      id: string;
      amount: number;
      reason?: string;
      status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
      createdAt: string;
    }>;
  };
}

export interface GetUserSubscriptionsResponse {
  getUserSubscriptions: Array<{
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    planId: string;
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    daysRemaining: number;
    isActive: boolean;
    isExpired: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface GetSubscriptionResponse {
  getSubscription: {
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    planId: string;
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    daysRemaining: number;
    isActive: boolean;
    isExpired: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CreateSubscriptionResponse {
  createSubscription: {
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    planId: string;
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    daysRemaining: number;
    isActive: boolean;
    isExpired: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface CancelSubscriptionResponse {
  cancelSubscription: {
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    planId: string;
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    daysRemaining: number;
    isActive: boolean;
    isExpired: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface RequestRefundResponse {
  requestRefund: {
    id: string;
    paymentId: string;
    enrollmentId?: string;
    stripeRefundId?: string;
    amount: number;
    reason?: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    createdAt: string;
    updatedAt: string;
    payment: {
      id: string;
      amount: number;
      currency: string;
      course?: {
        id: string;
        title: string;
      };
    };
  };
}

export interface GetRefundEligibilityResponse {
  getRefundEligibility: {
    eligible: boolean;
    reason?: string;
    maxRefundAmount?: number;
    refundPolicy: {
      fullRefundDays: number;
      contentConsumptionThreshold: number;
      minimumRefundPercentage: number;
      administrativeFeePercentage: number;
    };
  };
}

export interface GetRefundResponse {
  getRefund: {
    id: string;
    paymentId: string;
    enrollmentId?: string;
    stripeRefundId?: string;
    amount: number;
    reason?: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    createdAt: string;
    updatedAt: string;
    payment?: {
      id: string;
      amount: number;
      currency: string;
      course?: {
        id: string;
        title: string;
      };
    };
    enrollment?: {
      id: string;
      course: {
        id: string;
        title: string;
      };
    };
  };
}