/**
 * GraphQL Response Types
 *
 * TypeScript interfaces for GraphQL query and mutation responses.
 * These types represent the exact structure returned by GraphQL operations.
 */

import type {
  Quiz,
  QuizAttempt,
  Assignment,
  AssignmentSubmission,
  Course,
  CourseConnection,
  Enrollment,
  EnrollmentConnection,
  User,
  ConversationConnection,
  Conversation,
  Message,
  ThreadConnection,
  DiscussionThread,
  DiscussionReply,
  Certificate,
  LessonProgress,
  Announcement,
  PresenceUpdate,
  TypingIndicator,
} from './entities';

// Assessment responses
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

// Course responses
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

// Enrollment responses
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

// User responses
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

// Authentication responses
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

// Communication responses
export interface GetConversationsResponse {
  conversations: ConversationConnection;
}

export interface GetConversationMessagesResponse {
  conversation: Conversation & {
    messages: import('./entities').MessageConnection;
  };
}

export interface GetDiscussionThreadsResponse {
  discussionThreads: ThreadConnection;
}

export interface GetThreadRepliesResponse {
  discussionThread: DiscussionThread & {
    replies: import('./entities').Connection<DiscussionReply>;
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

export interface MarkMessagesReadResponse {
  markMessagesRead: Conversation;
}

// Additional Communication responses
export interface GetAnnouncementsResponse {
  announcements: import('./entities').Connection<Announcement>;
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

// Subscription responses
export interface MessageAddedSubscription {
  messageAdded: Message;
}

export interface UserTypingSubscription {
  userTyping: TypingIndicator;
}

// Content responses
export interface GetStreamingUrlResponse {
  generateStreamingUrl: {
    streamingUrl: string;
    expiresAt: string;
    resolution: string;
    format: string;
  };
}

export interface GenerateUploadUrlResponse {
  generateUploadUrl: {
    uploadUrl: string;
    fileKey: string;
    expiresIn: number;
    maxFileSize: number;
  };
}

export interface CompleteFileUploadResponse {
  completeFileUpload: {
    id: string;
    fileKey: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    url: string;
    createdAt: string;
  };
}

export interface GetVideoAssetResponse {
  videoAsset: {
    id: string;
    lesson: { id: string } | null;
    uploadedBy: { id: string };
    originalFileName: string;
    originalFileSize: number;
    mimeType: string;
    s3Bucket: string;
    s3Key: string;
    s3Region: string;
    processingStatus: string;
    processingJobId: string | null;
    processingStartedAt: string | null;
    processingCompletedAt: string | null;
    processingErrorMessage: string | null;
    durationSeconds: number | null;
    originalResolution: string | null;
    originalBitrate: number | null;
    originalFrameRate: number | null;
    hlsManifestUrl: string | null;
    thumbnailUrl: string | null;
    previewUrl: string | null;
    availableResolutions: Array<{
      resolution: string;
      url: string;
      bitrate: number;
      width: number;
      height: number;
    }>;
    cloudfrontDistribution: string | null;
    streamingUrls: {
      hls?: string;
      dash?: string;
      mp4?: Record<string, string>;
    };
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    formattedDuration: string | null;
    formattedFileSize: string;
    isProcessing: boolean;
    isProcessed: boolean;
    isProcessingFailed: boolean;
    isReadyForStreaming: boolean;
    processingProgress: number;
    bestResolution: {
      resolution: string;
      url: string;
      bitrate: number;
      width: number;
      height: number;
    } | null;
    hasThumbnail: boolean;
    hasPreview: boolean;
    supportsAdaptiveStreaming: boolean;
  };
}

export interface GetFileAssetResponse {
  fileAsset: {
    id: string;
    course: { id: string } | null;
    lesson: { id: string } | null;
    uploadedBy: { id: string };
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
    cloudfrontUrl: string | null;
    processingStatus: string;
    processingErrorMessage: string | null;
    variants: {
      thumbnail?: string;
      compressed?: string;
      preview?: string;
    };
    description: string | null;
    tags: string[];
    metadata: Record<string, unknown>;
    expiresAt: string | null;
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
    cdnUrl: string | null;
    thumbnailUrl: string | undefined;
    previewUrl: string | undefined;
    compressedUrl: string | undefined;
    hasThumbnail: boolean;
    hasPreview: boolean;
    imageDimensions: {
      width: number;
      height: number;
    } | null;
    pageCount: number | null;
    isSafeForPreview: boolean;
    timeUntilExpiration: number | null;
    isExpiringSoon: boolean;
    iconClass: string;
  };
}

export interface GetVideoAssetsResponse {
  videoAssets: {
    edges: Array<{
      node: {
        id: string;
        originalFileName: string;
        originalFileSize: number;
        processingStatus: string;
        durationSeconds: number | null;
        thumbnailUrl: string | null;
        isReadyForStreaming: boolean;
        formattedDuration: string | null;
        formattedFileSize: string;
        createdAt: string;
      };
      cursor: string;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  };
}

export interface GetFileAssetsResponse {
  fileAssets: {
    edges: Array<{
      node: {
        id: string;
        fileName: string;
        fileSize: number;
        assetType: string;
        processingStatus: string;
        isPublic: boolean;
        accessLevel: string;
        thumbnailUrl: string | null;
        formattedFileSize: string;
        fileExtension: string;
        iconClass: string;
        createdAt: string;
      };
      cursor: string;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  };
}

export interface GetVideoProcessingStatusResponse {
  videoProcessingStatus: {
    id: string;
    videoAsset: { id: string };
    jobType: string;
    externalJobId: string | null;
    externalServiceName: string | null;
    status: string;
    progress: number;
    startedAt: string | null;
    completedAt: string | null;
    result: Record<string, unknown> | null;
    errorMessage: string | null;
    errorCode: string | null;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt: string | null;
    priority: number;
    scheduledFor: string | null;
    metadata: Record<string, unknown>;
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
    duration: number | null;
    formattedDuration: string | null;
    timeUntilRetry: number | null;
    timeUntilScheduled: number | null;
    estimatedCompletionTime: string | null;
    hasExceededTimeout: boolean;
    priorityDescription: string;
    isHighPriority: boolean;
    jobTypeDescription: string;
  };
}

// Subscription responses
export interface MessageAddedSubscription {
  messageAdded: Message;
}

export interface UserTypingSubscription {
  userTyping: TypingIndicator;
}

export interface AnnouncementPublishedSubscription {
  announcementPublished: Announcement;
}

export interface UserPresenceSubscription {
  userPresence: PresenceUpdate;
}

export interface ThreadTypingSubscription {
  typingIndicator: TypingIndicator;
}

// Analytics responses
export interface GetCourseAnalyticsResponse {
  courseAnalytics: import('./entities').CourseAnalytics;
}

export interface GetStudentAnalyticsResponse {
  studentAnalytics: import('./entities').StudentAnalytics;
}

export interface GetDashboardMetricsResponse {
  dashboardMetrics: import('./entities').DashboardMetrics;
}

export interface GenerateCourseReportResponse {
  generateCourseReport: import('./entities').CourseReport;
}

export interface GenerateStudentReportResponse {
  generateStudentReport: import('./entities').StudentReport;
}

export interface GetPlatformMetricsResponse {
  platformMetrics: import('./entities').PlatformHealth;
}

export interface GetTrendingCoursesResponse {
  trendingCourses: import('./entities').CourseAnalytics[];
}

export interface GetTopPerformingStudentsResponse {
  topPerformingStudents: import('./entities').StudentAnalytics[];
}

// Assessment Analytics responses
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
    submittedAt: string | null;
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

// Payment responses
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
        status: string;
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
      status: string;
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
    payment?: {
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
