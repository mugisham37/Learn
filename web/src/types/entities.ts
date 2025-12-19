/**
 * Domain Entity Types
 * 
 * TypeScript interfaces for all domain entities used in the application.
 * These types represent the structure of data returned from the GraphQL API.
 */

// Base types
export type ID = string;
export type DateTime = string;
export type JSON = any;
export type Upload = File;

// Enums
export type UserRole = 'STUDENT' | 'EDUCATOR' | 'ADMIN';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'SUSPENDED';
export type QuizAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
export type AssignmentSubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'GRADED' | 'RETURNED';
export type LessonType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT' | 'INTERACTIVE';
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY';

// User-related types
export interface User {
  id: ID;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  profile: UserProfile;
  notificationPreferences: NotificationPreferences;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface UserProfile {
  fullName: string;
  bio?: string;
  timezone: string;
  language: string;
  avatarUrl?: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  courseUpdates: boolean;
  messageNotifications: boolean;
  assignmentReminders: boolean;
}

// Course-related types
export interface Course {
  id: ID;
  instructor: User;
  title: string;
  description: string;
  slug: string;
  category: string;
  difficulty: Difficulty;
  price: number;
  currency: string;
  status: CourseStatus;
  thumbnailUrl?: string;
  modules: CourseModule[];
  enrollmentCount: number;
  averageRating?: number;
  reviews: CourseReview[];
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface CourseModule {
  id: ID;
  course: Course;
  title: string;
  description: string;
  orderIndex: number;
  lessons: Lesson[];
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface Lesson {
  id: ID;
  module: CourseModule;
  title: string;
  description: string;
  type: LessonType;
  content?: string;
  videoUrl?: string;
  duration?: number;
  orderIndex: number;
  quiz?: Quiz;
  assignment?: Assignment;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface CourseReview {
  id: ID;
  course: Course;
  student: User;
  rating: number;
  comment?: string;
  createdAt: DateTime;
  updatedAt: DateTime;
}

// Enrollment-related types
export interface Enrollment {
  id: ID;
  student: User;
  course: Course;
  enrolledAt: DateTime;
  completedAt?: DateTime;
  progressPercentage: number;
  status: EnrollmentStatus;
  certificate?: Certificate;
  lessonProgress: LessonProgress[];
}

export interface LessonProgress {
  id: ID;
  enrollment: Enrollment;
  lesson: Lesson;
  completedAt?: DateTime;
  timeSpent: number;
  isCompleted: boolean;
  lastAccessedAt: DateTime;
}

export interface Certificate {
  id: ID;
  enrollment: Enrollment;
  issuedAt: DateTime;
  certificateUrl: string;
}

// Assessment-related types
export interface Quiz {
  id: ID;
  lesson: Lesson;
  title: string;
  description: string;
  timeLimit?: number;
  maxAttempts: number;
  passingScore: number;
  questions: Question[];
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface Question {
  id: ID;
  quiz: Quiz;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  orderIndex: number;
}

export interface QuizAttempt {
  id: ID;
  quiz: Quiz;
  student: User;
  startedAt: DateTime;
  submittedAt?: DateTime;
  timeRemaining: number;
  status: QuizAttemptStatus;
  score?: number;
  maxScore: number;
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  id: ID;
  quizAttempt: QuizAttempt;
  question: Question;
  answer: string;
  isCorrect?: boolean;
  points?: number;
  submittedAt: DateTime;
}

export interface Assignment {
  id: ID;
  lesson: Lesson;
  title: string;
  description: string;
  instructions: string;
  dueDate?: DateTime;
  maxPoints: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  submissions: AssignmentSubmission[];
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface AssignmentSubmission {
  id: ID;
  assignment: Assignment;
  student: User;
  submittedAt: DateTime;
  status: AssignmentSubmissionStatus;
  submissionText?: string;
  files: SubmissionFile[];
  grade?: number;
  feedback?: string;
  gradedAt?: DateTime;
  gradedBy?: User;
}

export interface SubmissionFile {
  id: ID;
  submission: AssignmentSubmission;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: DateTime;
}

// Communication-related types
export interface Conversation {
  id: ID;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface Message {
  id: ID;
  conversation: Conversation;
  sender: User;
  content: string;
  attachments: MessageAttachment[];
  readBy: MessageRead[];
  sentAt: DateTime;
}

export interface MessageAttachment {
  id: ID;
  message: Message;
  fileName: string;
  fileSize: number;
  fileUrl: string;
}

export interface MessageRead {
  id: ID;
  message: Message;
  user: User;
  readAt: DateTime;
}

export interface DiscussionThread {
  id: ID;
  course: Course;
  lesson?: Lesson;
  author: User;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  replies: DiscussionReply[];
  lastReply?: DiscussionReply;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface DiscussionReply {
  id: ID;
  thread: DiscussionThread;
  author: User;
  content: string;
  parentReply?: DiscussionReply;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface Announcement {
  id: ID;
  course: Course;
  author: User;
  title: string;
  content: string;
  isImportant: boolean;
  publishedAt: DateTime;
  createdAt: DateTime;
  updatedAt: DateTime;
}

// Content management types
export interface PresignedUploadUrl {
  uploadUrl: string;
  fileKey: string;
  fields: Record<string, string>;
  expiresAt: DateTime;
}

export interface VideoProcessingStatus {
  fileKey: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputFormats: VideoFormat[];
  thumbnailUrl?: string;
  duration?: number;
  error?: string;
  updatedAt: DateTime;
}

export interface VideoFormat {
  quality: string;
  url: string;
  fileSize: number;
}

export interface StreamingUrl {
  url: string;
  expiresAt: DateTime;
  quality: string;
}

// Pagination types
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

// Specific connection types
export type CourseConnection = Connection<Course>;
export type EnrollmentConnection = Connection<Enrollment>;
export type ConversationConnection = Connection<Conversation>;
export type MessageConnection = Connection<Message>;
export type ThreadConnection = Connection<DiscussionThread>;

// Input types for mutations
export interface UpdateProfileInput {
  fullName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  avatarUrl?: string;
}

export interface UpdateNotificationPreferencesInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  courseUpdates?: boolean;
  messageNotifications?: boolean;
  assignmentReminders?: boolean;
}

export interface CreateCourseInput {
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  price?: number;
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: Difficulty;
  price?: number;
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

export interface EnrollInCourseInput {
  courseId: ID;
  paymentIntentId?: string;
}

export interface UpdateLessonProgressInput {
  enrollmentId: ID;
  lessonId: ID;
  isCompleted?: boolean;
  timeSpent?: number;
  completedAt?: DateTime;
  lastAccessedAt?: DateTime;
}

export interface FileUploadInput {
  fileName: string;
  fileSize: number;
  mimeType: string;
  courseId?: ID;
  lessonId?: ID;
}

export interface VideoUploadInput extends FileUploadInput {
  lessonId: ID;
}

export interface FileMetadataInput {
  originalName: string;
  mimeType: string;
  fileSize: number;
}

export interface StartQuizInput {
  quizId: ID;
}

export interface SubmitQuizAnswerInput {
  attemptId: ID;
  questionId: ID;
  answer: string;
}

export interface SubmitAssignmentInput {
  assignmentId: ID;
  submissionText?: string;
  files?: SubmissionFileInput[];
}

export interface SubmissionFileInput {
  fileName: string;
  fileKey: string;
  fileSize: number;
}

export interface GradeAssignmentInput {
  submissionId: ID;
  grade: number;
  feedback?: string;
}

export interface SendMessageInput {
  conversationId: ID;
  content: string;
  attachments?: MessageAttachmentInput[];
}

export interface MessageAttachmentInput {
  fileName: string;
  fileKey: string;
  fileSize: number;
}

export interface CreateThreadInput {
  courseId: ID;
  lessonId?: ID;
  title: string;
  content: string;
}

export interface ReplyToThreadInput {
  threadId: ID;
  content: string;
  parentReplyId?: ID;
}

// Filter types
export interface CourseFilter {
  category?: string;
  difficulty?: Difficulty;
  status?: CourseStatus;
  instructorId?: ID;
  search?: string;
}

export interface EnrollmentFilter {
  status?: EnrollmentStatus;
  courseId?: ID;
  studentId?: ID;
}

export interface ConversationFilter {
  unreadOnly?: boolean;
  participantId?: ID;
}

export interface ThreadFilter {
  courseId?: ID;
  lessonId?: ID;
  authorId?: ID;
  isPinned?: boolean;
  search?: string;
}

export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}