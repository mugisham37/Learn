/**
 * Domain Entity Types
 *
 * TypeScript interfaces for all domain entities used in the application.
 * These types represent the structure of data returned from the GraphQL API.
 */

// Base types
export type ID = string;
export type DateTime = string;
export type JSON = Record<string, unknown>;
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
  bio: string;
  timezone: string;
  language: string;
  avatarUrl: string;
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
  content: string;
  videoUrl: string;
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

// Additional Communication types
export interface PresenceUpdate {
  userId: ID;
  user: User;
  status: PresenceStatus;
  courseId?: ID;
  lastSeen: DateTime;
}

export interface TypingIndicator {
  userId: ID;
  user: User;
  conversationId?: string;
  threadId?: ID;
  isTyping: boolean;
}

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'AWAY';
export type VoteType = 'UPVOTE' | 'REMOVE_VOTE';

export interface AnnouncementInput {
  title: string;
  content: string;
  scheduledFor?: DateTime;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  scheduledFor?: DateTime;
}

export interface AnnouncementFilter {
  publishedOnly?: boolean;
  scheduledOnly?: boolean;
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
  thumbnailUrl: string;
  duration: number;
  error: string;
  updatedAt: DateTime;
}

export interface VideoFormat {
  quality: string;
  url: string;
  fileSize: number;
}

export interface StreamingUrl {
  streamingUrl: string;
  expiresAt: DateTime;
  resolution: string;
  format: string;
}

// Pagination types
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
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

export interface WithdrawEnrollmentInput {
  enrollmentId: ID;
  reason?: string;
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

// Analytics-related types
export type PerformanceLevel = 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
export type EngagementLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type LearningConsistency = 'CONSISTENT' | 'IRREGULAR' | 'INACTIVE';
export type BadgeCategory = 'COMPLETION' | 'PERFORMANCE' | 'ENGAGEMENT' | 'STREAK' | 'SKILL';
export type ImprovementTrend = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface CourseAnalytics {
  courseId: ID;
  course: Course;
  totalEnrollments: number;
  activeEnrollments: number;
  completionCount: number;
  completionRate: number;
  averageRating?: number;
  totalRevenue: number;
  averageTimeToCompletionDays?: number;
  dropoutRate: number;
  mostDifficultLesson?: Lesson;
  engagementMetrics: EngagementMetrics;
  lastUpdated: DateTime;
}

export interface EngagementMetrics {
  averageSessionDuration: number;
  totalVideoWatchTime: number;
  discussionParticipationRate: number;
  assignmentSubmissionRate: number;
  quizAttemptRate: number;
  averageQuizScore: number;
  lessonCompletionVelocity: number;
  studentRetentionRate: number;
}

export interface StudentAnalytics {
  userId: ID;
  user: User;
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  averageQuizScore?: number;
  totalTimeInvestedMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  badgesEarned: string[];
  skillRatings: JSON;
  lastUpdated: DateTime;
  completionRate: number;
  averageTimePerCourse: number;
  performanceSummary: StudentPerformanceSummary;
  learningStreak: LearningStreak;
}

export interface StudentPerformanceSummary {
  completionRate: number;
  performanceLevel: PerformanceLevel;
  engagementLevel: EngagementLevel;
  learningConsistency: LearningConsistency;
  totalBadges: number;
  averageSkillRating: number;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: DateTime;
  streakStartDate?: DateTime;
}

export interface DashboardMetrics {
  role: UserRole;
  userId: ID;
  generatedAt: DateTime;
  overview?: PlatformOverview;
  studentMetrics?: StudentDashboardMetrics;
  educatorMetrics?: EducatorDashboardMetrics;
  adminMetrics?: AdminDashboardMetrics;
}

export interface PlatformOverview {
  totalUsers?: number;
  totalCourses?: number;
  totalEnrollments?: number;
  totalRevenue?: number;
}

export interface StudentDashboardMetrics {
  enrolledCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  currentStreak: number;
  totalTimeInvested: number;
  averageQuizScore?: number;
  badgesEarned: number;
  upcomingDeadlines: UpcomingDeadline[];
  recentGrades: RecentGrade[];
  recommendedCourses: RecommendedCourse[];
}

export interface EducatorDashboardMetrics {
  totalCourses: number;
  publishedCourses: number;
  totalStudents: number;
  averageRating: number;
  totalRevenue: number;
  pendingGrading: number;
  coursePerformance: CoursePerformanceMetric[];
  recentActivity: RecentActivity[];
}

export interface AdminDashboardMetrics {
  platformHealth: PlatformHealth;
  growthMetrics: GrowthMetrics;
  systemMetrics: SystemMetrics;
  topPerformers: TopPerformers;
}

export interface PlatformHealth {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completionRate: number;
  averageRating: number;
  totalRevenue: number;
}

export interface GrowthMetrics {
  userGrowthRate: number;
  courseGrowthRate: number;
  revenueGrowthRate: number;
  enrollmentGrowthRate: number;
}

export interface SystemMetrics {
  errorRate: number;
  averageResponseTime: number;
  uptime: number;
  storageUsage: number;
}

export interface TopPerformers {
  topCourses: TopCourse[];
  topInstructors: TopInstructor[];
  topStudents: TopStudent[];
}

export interface UpcomingDeadline {
  courseId: ID;
  courseName: string;
  assignmentName: string;
  dueDate: DateTime;
}

export interface RecentGrade {
  courseId: ID;
  courseName: string;
  assessmentName: string;
  score: number;
  gradedAt: DateTime;
}

export interface RecommendedCourse {
  courseId: ID;
  courseName: string;
  reason: string;
}

export interface CoursePerformanceMetric {
  courseId: ID;
  courseName: string;
  enrollments: number;
  completionRate: number;
  averageRating: number;
  revenue: number;
}

export interface RecentActivity {
  type: string;
  courseId: ID;
  courseName: string;
  studentName: string;
  timestamp: DateTime;
}

export interface TopCourse {
  courseId: ID;
  courseName: string;
  instructorName: string;
  enrollments: number;
  rating: number;
}

export interface TopInstructor {
  instructorId: ID;
  instructorName: string;
  totalCourses: number;
  totalStudents: number;
  averageRating: number;
}

export interface TopStudent {
  studentId: ID;
  studentName: string;
  coursesCompleted: number;
  averageScore: number;
  currentStreak: number;
}

export interface CourseReport {
  courseId: ID;
  courseName: string;
  instructorName: string;
  reportPeriod: DateRange;
  enrollmentTrends: EnrollmentTrends;
  performanceMetrics: CoursePerformanceMetrics;
  engagementMetrics: CourseEngagementMetrics;
  revenueMetrics: RevenueMetrics;
  difficultContent: DifficultContent;
}

export interface StudentReport {
  studentId: ID;
  studentName: string;
  reportPeriod: DateRange;
  learningProgress: LearningProgress;
  performanceMetrics: StudentPerformanceMetrics;
  engagementMetrics: StudentEngagementMetrics;
  skillDevelopment: SkillDevelopment;
  recommendations: StudentRecommendations;
}

export interface DateRange {
  startDate: DateTime;
  endDate: DateTime;
}

export interface EnrollmentTrends {
  totalEnrollments: number;
  newEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  droppedEnrollments: number;
  enrollmentsByMonth: MonthlyEnrollment[];
}

export interface MonthlyEnrollment {
  month: string;
  count: number;
}

export interface CoursePerformanceMetrics {
  completionRate: number;
  averageTimeToCompletion: number;
  dropoutRate: number;
  averageQuizScore: number;
  assignmentSubmissionRate: number;
}

export interface CourseEngagementMetrics {
  averageSessionDuration: number;
  totalVideoWatchTime: number;
  discussionParticipationRate: number;
  lessonCompletionVelocity: number;
  studentRetentionRate: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  revenuePerEnrollment: number;
  refundRate: number;
}

export interface DifficultContent {
  mostDifficultLessons: DifficultLesson[];
  strugglingStudents: StrugglingStudent[];
}

export interface DifficultLesson {
  lessonId: ID;
  lessonName: string;
  averageAttempts: number;
  completionRate: number;
}

export interface StrugglingStudent {
  studentId: ID;
  studentName: string;
  progressPercentage: number;
  strugglingAreas: string[];
}

export interface LearningProgress {
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  completionRate: number;
  totalTimeInvested: number;
  averageTimePerCourse: number;
}

export interface StudentPerformanceMetrics {
  averageQuizScore: number;
  totalQuizzesTaken: number;
  assignmentsSubmitted: number;
  averageAssignmentScore: number;
  improvementTrend: ImprovementTrend;
}

export interface StudentEngagementMetrics {
  currentStreak: number;
  longestStreak: number;
  averageSessionDuration: number;
  discussionParticipation: number;
  lastActivityDate: DateTime;
}

export interface SkillDevelopment {
  skillRatings: JSON;
  skillProgress: SkillProgress[];
  badgesEarned: Badge[];
}

export interface SkillProgress {
  skillName: string;
  currentRating: number;
  improvement: number;
  coursesContributing: string[];
}

export interface Badge {
  badgeId: string;
  badgeName: string;
  earnedAt: DateTime;
  category: BadgeCategory;
}

export interface StudentRecommendations {
  nextCourses: string[];
  skillsToImprove: string[];
  studyScheduleSuggestions: string[];
}

// Analytics Input Types
export interface DateRangeInput {
  startDate: DateTime;
  endDate: DateTime;
}

export interface CourseReportInput {
  courseId: ID;
  dateRange: DateRangeInput;
}

export interface StudentReportInput {
  studentId: ID;
  dateRange: DateRangeInput;
}

export interface PlatformMetricsInput {
  dateRange: DateRangeInput;
}
