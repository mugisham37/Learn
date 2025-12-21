/**
 * Type Definitions
 *
 * Generated GraphQL types and custom frontend types.
 * This file exports all types used throughout the foundation layer.
 */

// Re-export generated GraphQL types
export * from './schema';

// Re-export GraphQL response types
export * from './graphql-responses';

// Re-export domain entity types (with explicit re-exports to avoid conflicts)
export type {
  ID,
  DateTime,
  JSON,
  Upload,
  Difficulty,
  QuestionType,
  QuizAttemptStatus,
  AssignmentSubmissionStatus,
  LessonType,
  UserProfile,
  NotificationPreferences,
  CourseModule,
  Lesson,
  CourseReview,
  Enrollment,
  LessonProgress,
  Certificate,
  Quiz,
  Question,
  QuizAttempt,
  QuizAnswer,
  Assignment,
  AssignmentSubmission,
  SubmissionFile,
  Conversation,
  Message,
  MessageAttachment,
  MessageRead,
  DiscussionThread,
  DiscussionReply,
  Announcement,
  PresenceUpdate,
  TypingIndicator,
  PresenceStatus,
  VoteType,
  AnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilter,
  PresignedUploadUrl,
  VideoProcessingStatus,
  VideoFormat,
  StreamingUrl,
  PageInfo,
  Connection,
  Edge,
  CourseConnection,
  EnrollmentConnection,
  ConversationConnection,
  MessageConnection,
  ThreadConnection,
  UpdateProfileInput,
  UpdateNotificationPreferencesInput,
  CreateCourseInput,
  UpdateCourseInput,
  EnrollInCourseInput,
  UpdateLessonProgressInput,
  FileUploadInput,
  VideoUploadInput,
  FileMetadataInput,
  StartQuizInput,
  SubmitQuizAnswerInput,
  SubmitAssignmentInput,
  SubmissionFileInput,
  GradeAssignmentInput,
  SendMessageInput,
  MessageAttachmentInput,
  CreateThreadInput,
  ReplyToThreadInput,
  WithdrawEnrollmentInput,
  CourseFilter,
  EnrollmentFilter,
  ConversationFilter,
  ThreadFilter,
  PaginationInput,
} from './entities';

// Import User and Course from entities with different names to avoid conflicts
import type { User as EntityUser, Course as EntityCourse } from './entities';

// Re-export with original names for backward compatibility
export type { EntityUser as User, EntityCourse as Course };

// Re-export form types when available
// export * from './forms';

// Custom frontend types
export interface FoundationConfig {
  // Environment
  nodeEnv: 'development' | 'staging' | 'production';
  appEnv: 'development' | 'staging' | 'production';

  // GraphQL Configuration
  graphqlEndpoint: string;
  wsEndpoint: string;

  // Development Configuration
  enableDevTools: boolean;
  enableGraphQLPlayground: boolean;

  // Feature Flags
  features: {
    analytics: boolean;
    notifications: boolean;
    realTime: boolean;
    fileUploads: boolean;
  };

  // Performance Monitoring
  performanceMonitoring: {
    enabled: boolean;
    sampleRate: number;
  };

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ErrorContext {
  operation: string;
  variables?: Record<string, unknown>;
  user?: EntityUser;
  requestId: string;
}

// Authentication types
export interface AuthState {
  user: EntityUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Hook result types
export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
  fetchMore?: (options: Record<string, unknown>) => Promise<unknown>;
}

export interface MutationResult<T> {
  mutate: (variables?: Record<string, unknown>) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

export interface SubscriptionResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

// Upload types
export interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: UploadStatus;
}

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
}

export interface UploadError {
  code: string;
  message: string;
  uploadId: string;
}

// Cache types
export interface CacheUpdateOptions {
  optimistic?: boolean;
  refetchQueries?: string[];
  awaitRefetchQueries?: boolean;
}

// Connection status for subscriptions
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

// Error classification
export type ErrorType =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UPLOAD_ERROR'
  | 'UNKNOWN_ERROR';

export interface ClassifiedError {
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  field?: string;
  retryable: boolean;
}

// Performance monitoring
export interface PerformanceMetrics {
  requestDuration: number;
  cacheHitRate: number;
  errorRate: number;
  activeSubscriptions: number;
}

// Foundation Layer Initialization Types
export interface InitializationResult {
  success: boolean;
  errors: string[];
  services: {
    graphql: boolean;
    auth: boolean;
    subscriptions: boolean;
    uploads: boolean;
  };
}

// Service Status Types
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  error?: string;
}

// Security Audit Types
export interface SecurityAuditResult {
  tokenStorageSecure: boolean;
  xssProtectionEnabled: boolean;
  csrfProtectionEnabled: boolean;
  fileUploadSecure: boolean;
  issues: string[];
}
