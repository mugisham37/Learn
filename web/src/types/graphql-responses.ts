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
  StreamingUrl,
  Certificate,
  LessonProgress,
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
    metadata: Record<string, any>;
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
    metadata: Record<string, any>;
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
    result: Record<string, any> | null;
    errorMessage: string | null;
    errorCode: string | null;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt: string | null;
    priority: number;
    scheduledFor: string | null;
    metadata: Record<string, any>;
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
  userTyping: {
    userId: string;
    isTyping: boolean;
    conversationId: string;
  };
}