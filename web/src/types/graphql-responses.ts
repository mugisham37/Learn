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
  getStreamingUrl: StreamingUrl;
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