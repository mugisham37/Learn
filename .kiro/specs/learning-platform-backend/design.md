# Design Document

## Overview

This design document specifies the architecture, components, and implementation details for a production-ready educational learning platform backend built with Node.js. The system implements a modular monolith architecture where each business domain is self-contained with its own infrastructure, domain, application, and presentation layers, while maintaining the ability to communicate across modules within a single deployable application.

The platform serves two primary user types: students who consume educational content and track progress, and educators who create courses and assess student performance. The system handles video streaming, real-time assessments, file management, multi-channel communication, progress tracking, payment processing, and analytics at enterprise scale.

### Technology Stack

**Core Framework**: Fastify 5.x - chosen for superior performance (9,480 req/s vs Express's 4,562 req/s), built-in JSON Schema validation, excellent TypeScript support, and plugin architecture aligned with modular design

**Programming Language**: TypeScript 5.x with strict mode - ensuring type safety, explicit return types, and comprehensive interface definitions

**Database**: PostgreSQL 15+ - providing ACID compliance, complex join performance, full-text search, JSONB support, and advanced indexing

**ORM**: Drizzle ORM - offering type-safe queries, automatic migrations, lightweight performance, and modern PostgreSQL feature support

**Caching**: Redis 7+ - handling sessions, API caching, rate limiting, real-time data, and job queues

**Background Jobs**: BullMQ - managing video transcoding, email sending, certificate generation, and analytics aggregation

**Real-time**: Socket.io 4+ with Redis adapter - enabling live messaging, presence, notifications, and collaborative features

**Search**: Elasticsearch 8+ - powering full-text search, faceted filtering, and analytics aggregations

**Storage**: AWS S3 with CloudFront CDN - storing videos, files, and assets with global distribution

**Video Processing**: AWS MediaConvert with Lambda triggers - transcoding videos to HLS adaptive bitrate streaming

**Payments**: Stripe API - processing transactions, subscriptions, and refunds with PCI compliance

**Email**: SendGrid or AWS SES - delivering transactional and marketing emails

**API Layer**: GraphQL with Apollo Server - providing flexible data querying with type safety

### Architectural Principles

**Modular Monolith Pattern**: Code organized by business domains (users, courses, content, assessments, enrollments, communication, notifications, analytics, payments, search) rather than technical layers. Each module is self-contained with clear boundaries while remaining in a single deployable application.

**Domain-Driven Design**: Each module represents a bounded context with its own ubiquitous language, entities, value objects, aggregates, and domain services.

**Layered Architecture per Module**: Each module contains four layers:
- **Infrastructure Layer**: Database repositories, external service clients, message publishers
- **Domain Layer**: Business entities, value objects, domain services, business rules
- **Application Layer**: Use cases, application services, DTOs, orchestration logic
- **Presentation Layer**: GraphQL resolvers, REST controllers, input validation, response formatting

**Event-Driven Communication**: Modules communicate asynchronously through domain events for loose coupling. Events published to event bus, subscribers react without direct dependencies.

**CQRS Pattern**: Separation of command (write) and query (read) operations where beneficial, particularly for analytics and reporting.

**Repository Pattern**: Abstracting data access behind repository interfaces, allowing domain layer to remain independent of infrastructure concerns.

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   GraphQL    │  │   REST API   │  │  WebSocket   │         │
│  │   (Apollo)   │  │  (Fastify)   │  │ (Socket.io)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Application Modules                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Users   │ │ Courses  │ │ Content  │ │Assessment│          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Enrollment│ │Communic. │ │Notificat.│ │Analytics │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐                                     │
│  │ Payments │ │  Search  │                                     │
│  └──────────┘ └──────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │PostgreSQL│ │  Redis   │ │   S3     │ │Elastics. │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │  Stripe  │ │ SendGrid │ │MediaConv.│                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### Module Architecture Pattern

Each module follows this internal structure:

```
module-name/
├── infrastructure/
│   ├── repositories/          # Data access implementations
│   ├── clients/               # External service clients
│   └── events/                # Event publishers
├── domain/
│   ├── entities/              # Business entities
│   ├── value-objects/         # Immutable value types
│   ├── services/              # Domain services
│   └── events/                # Domain event definitions
├── application/
│   ├── use-cases/             # Application use cases
│   ├── services/              # Application services
│   ├── dtos/                  # Data transfer objects
│   └── mappers/               # Entity-DTO mappers
├── presentation/
│   ├── graphql/               # GraphQL resolvers & schema
│   ├── rest/                  # REST controllers
│   ├── validation/            # Input validation schemas
│   └── middleware/            # Module-specific middleware
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── fixtures/              # Test data
└── index.ts                   # Public module API
```


## Components and Interfaces

### Users Module

**Responsibilities**: Authentication, authorization, user profile management, role-based access control

**Domain Entities**:
- `User`: Core user entity with id, email, passwordHash, role, emailVerified, createdAt, updatedAt
- `UserProfile`: Extended profile with fullName, bio, avatarUrl, timezone, language, preferences
- `Session`: Active user session with refreshToken, expiresAt, deviceInfo

**Key Interfaces**:
```typescript
interface IUserRepository {
  create(user: CreateUserDTO): Promise<User>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  update(id: string, data: UpdateUserDTO): Promise<User>
  softDelete(id: string): Promise<void>
}

interface IAuthService {
  register(data: RegisterDTO): Promise<{ user: User; verificationToken: string }>
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }>
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>
  logout(userId: string, refreshToken: string): Promise<void>
  verifyEmail(token: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
}

interface IAuthorizationService {
  checkRole(userId: string, allowedRoles: Role[]): Promise<boolean>
  checkOwnership(userId: string, resourceType: string, resourceId: string): Promise<boolean>
}
```

**GraphQL Schema**:
```graphql
type User {
  id: ID!
  email: String!
  role: Role!
  profile: UserProfile!
  createdAt: DateTime!
}

type UserProfile {
  fullName: String!
  bio: String
  avatarUrl: String
  timezone: String!
  language: String!
}

enum Role {
  STUDENT
  EDUCATOR
  ADMIN
}

type AuthPayload {
  accessToken: String!
  user: User!
}

type Mutation {
  register(input: RegisterInput!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  refreshToken: AuthPayload!
  logout: Boolean!
  verifyEmail(token: String!): Boolean!
  requestPasswordReset(email: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): Boolean!
  updateProfile(input: UpdateProfileInput!): UserProfile!
}

type Query {
  me: User!
  user(id: ID!): User
}
```

### Courses Module

**Responsibilities**: Course creation, module and lesson management, course publishing, course discovery

**Domain Entities**:
- `Course`: Main course entity with metadata, instructor, status, pricing
- `CourseModule`: Logical grouping of lessons with order and prerequisites
- `Lesson`: Individual content unit with type (video, text, quiz, assignment)

**Key Interfaces**:
```typescript
interface ICourseRepository {
  create(course: CreateCourseDTO): Promise<Course>
  findById(id: string): Promise<Course | null>
  findByInstructor(instructorId: string, pagination: PaginationDTO): Promise<PaginatedResult<Course>>
  update(id: string, data: UpdateCourseDTO): Promise<Course>
  publish(id: string): Promise<Course>
  delete(id: string): Promise<void>
}

interface ICourseService {
  createCourse(instructorId: string, data: CreateCourseDTO): Promise<Course>
  addModule(courseId: string, data: CreateModuleDTO): Promise<CourseModule>
  addLesson(moduleId: string, data: CreateLessonDTO): Promise<Lesson>
  reorderModules(courseId: string, moduleIds: string[]): Promise<void>
  publishCourse(courseId: string): Promise<Course>
  validatePublishRequirements(courseId: string): Promise<ValidationResult>
}
```

**GraphQL Schema**:
```graphql
type Course {
  id: ID!
  title: String!
  description: String!
  slug: String!
  instructor: User!
  category: String!
  difficulty: Difficulty!
  price: Money!
  status: CourseStatus!
  modules: [CourseModule!]!
  enrollmentCount: Int!
  averageRating: Float
  publishedAt: DateTime
  createdAt: DateTime!
}

type CourseModule {
  id: ID!
  title: String!
  description: String
  orderNumber: Int!
  lessons: [Lesson!]!
  durationMinutes: Int!
  prerequisite: CourseModule
}

type Lesson {
  id: ID!
  title: String!
  description: String
  type: LessonType!
  contentUrl: String
  contentText: String
  durationMinutes: Int
  orderNumber: Int!
  isPreview: Boolean!
}

enum LessonType {
  VIDEO
  TEXT
  QUIZ
  ASSIGNMENT
}

enum CourseStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  ARCHIVED
}

type Mutation {
  createCourse(input: CreateCourseInput!): Course!
  updateCourse(id: ID!, input: UpdateCourseInput!): Course!
  publishCourse(id: ID!): Course!
  deleteCourse(id: ID!): Boolean!
  addModule(courseId: ID!, input: CreateModuleInput!): CourseModule!
  addLesson(moduleId: ID!, input: CreateLessonInput!): Lesson!
  reorderModules(courseId: ID!, moduleIds: [ID!]!): Boolean!
}

type Query {
  course(id: ID!): Course
  courses(filter: CourseFilter, pagination: PaginationInput): CoursesConnection!
  myCourses(pagination: PaginationInput): CoursesConnection!
}
```


### Content Module

**Responsibilities**: File uploads, video processing, content delivery, CDN integration

**Domain Entities**:
- `VideoAsset`: Video file with processing status, resolutions, HLS manifest
- `FileAsset`: Generic file with metadata, S3 location, access control
- `ProcessingJob`: Async job tracking for video transcoding

**Key Interfaces**:
```typescript
interface IContentService {
  generateUploadUrl(userId: string, fileName: string, fileType: string): Promise<PresignedUploadUrl>
  handleVideoUpload(fileKey: string, metadata: VideoMetadata): Promise<ProcessingJob>
  handleTranscodingComplete(jobId: string, outputs: TranscodingOutput[]): Promise<VideoAsset>
  generateStreamingUrl(lessonId: string, userId: string): Promise<SignedUrl>
  uploadCourseResource(courseId: string, file: FileUpload): Promise<FileAsset>
  deleteContent(fileKey: string, userId: string): Promise<void>
}

interface IS3Client {
  generatePresignedUrl(key: string, expiresIn: number): Promise<string>
  uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void>
  deleteFile(key: string): Promise<void>
}

interface IMediaConvertClient {
  createTranscodingJob(input: TranscodingJobInput): Promise<string>
  getJobStatus(jobId: string): Promise<JobStatus>
}
```

### Assessments Module

**Responsibilities**: Quiz and assignment creation, student submissions, grading, feedback

**Domain Entities**:
- `Quiz`: Assessment with questions, time limits, passing scores
- `Question`: Individual question with type, options, correct answer
- `QuizSubmission`: Student attempt with answers, scores, grading status
- `Assignment`: File-based task with rubric, due dates, late penalties
- `AssignmentSubmission`: Student work with files, grading, feedback

**Key Interfaces**:
```typescript
interface IQuizService {
  createQuiz(lessonId: string, data: CreateQuizDTO): Promise<Quiz>
  addQuestion(quizId: string, data: CreateQuestionDTO): Promise<Question>
  startAttempt(quizId: string, studentId: string): Promise<QuizSubmission>
  submitAnswer(submissionId: string, questionId: string, answer: Answer): Promise<void>
  submitQuiz(submissionId: string): Promise<QuizSubmission>
  gradeSubmission(submissionId: string, grading: GradingData): Promise<QuizSubmission>
}

interface IAssignmentService {
  createAssignment(lessonId: string, data: CreateAssignmentDTO): Promise<Assignment>
  submitAssignment(assignmentId: string, studentId: string, submission: SubmissionData): Promise<AssignmentSubmission>
  gradeAssignment(submissionId: string, grading: GradingData): Promise<AssignmentSubmission>
  requestRevision(submissionId: string, feedback: string): Promise<AssignmentSubmission>
}

interface IGradingService {
  autoGradeObjectiveQuestions(submission: QuizSubmission): Promise<GradingResult>
  calculateScore(submission: QuizSubmission): Promise<number>
  applyLatePenalty(submission: AssignmentSubmission): Promise<number>
}
```

**GraphQL Schema**:
```graphql
type Quiz {
  id: ID!
  lesson: Lesson!
  title: String!
  type: QuizType!
  timeLimitMinutes: Int
  passingScore: Int!
  maxAttempts: Int!
  questions: [Question!]!
}

type Question {
  id: ID!
  type: QuestionType!
  questionText: String!
  options: [String!]
  points: Int!
  explanation: String
}

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
  SHORT_ANSWER
  ESSAY
  FILL_BLANK
  MATCHING
}

type QuizSubmission {
  id: ID!
  quiz: Quiz!
  student: User!
  attemptNumber: Int!
  startedAt: DateTime!
  submittedAt: DateTime
  scorePercentage: Float
  gradingStatus: GradingStatus!
  feedback: String
}

type Assignment {
  id: ID!
  lesson: Lesson!
  title: String!
  instructions: String!
  dueDate: DateTime!
  maxPoints: Int!
  allowedFileTypes: [String!]!
  rubric: JSON
}

type AssignmentSubmission {
  id: ID!
  assignment: Assignment!
  student: User!
  fileUrl: String
  submittedAt: DateTime!
  isLate: Boolean!
  pointsAwarded: Float
  feedback: String
  gradingStatus: GradingStatus!
}

enum GradingStatus {
  AUTO_GRADED
  PENDING_REVIEW
  GRADED
  REVISION_REQUESTED
}

type Mutation {
  createQuiz(lessonId: ID!, input: CreateQuizInput!): Quiz!
  startQuizAttempt(quizId: ID!): QuizSubmission!
  submitQuizAnswer(submissionId: ID!, questionId: ID!, answer: JSON!): Boolean!
  submitQuiz(submissionId: ID!): QuizSubmission!
  gradeQuizSubmission(submissionId: ID!, grading: GradingInput!): QuizSubmission!
  
  createAssignment(lessonId: ID!, input: CreateAssignmentInput!): Assignment!
  submitAssignment(assignmentId: ID!, input: SubmitAssignmentInput!): AssignmentSubmission!
  gradeAssignment(submissionId: ID!, grading: GradingInput!): AssignmentSubmission!
  requestRevision(submissionId: ID!, feedback: String!): AssignmentSubmission!
}
```


### Enrollments Module

**Responsibilities**: Student-course relationships, progress tracking, certificate generation

**Domain Entities**:
- `Enrollment`: Student-course relationship with status, progress, completion
- `LessonProgress`: Granular tracking of lesson completion, time spent, attempts
- `Certificate`: Digital credential with verification, PDF generation

**Key Interfaces**:
```typescript
interface IEnrollmentService {
  enrollStudent(studentId: string, courseId: string, paymentInfo?: PaymentInfo): Promise<Enrollment>
  updateLessonProgress(enrollmentId: string, lessonId: string, progress: ProgressUpdate): Promise<LessonProgress>
  completeCourse(enrollmentId: string): Promise<Certificate>
  withdrawEnrollment(enrollmentId: string, reason: string): Promise<void>
  getEnrollmentProgress(enrollmentId: string): Promise<ProgressSummary>
}

interface IProgressCalculator {
  calculateCourseProgress(enrollment: Enrollment): Promise<number>
  estimateTimeRemaining(enrollment: Enrollment): Promise<number>
  identifyStrugglingAreas(enrollment: Enrollment): Promise<string[]>
}

interface ICertificateGenerator {
  generateCertificate(enrollment: Enrollment): Promise<Certificate>
  createPDF(certificate: Certificate): Promise<Buffer>
  uploadToS3(pdf: Buffer, certificateId: string): Promise<string>
}
```

**GraphQL Schema**:
```graphql
type Enrollment {
  id: ID!
  student: User!
  course: Course!
  enrolledAt: DateTime!
  completedAt: DateTime
  progressPercentage: Float!
  lastAccessedAt: DateTime
  status: EnrollmentStatus!
  certificate: Certificate
}

type LessonProgress {
  id: ID!
  lesson: Lesson!
  status: ProgressStatus!
  timeSpentSeconds: Int!
  completedAt: DateTime
  quizScore: Int
  attemptsCount: Int!
}

enum ProgressStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}

type Certificate {
  id: ID!
  enrollment: Enrollment!
  certificateId: String!
  pdfUrl: String!
  issuedAt: DateTime!
  verificationUrl: String!
}

type ProgressSummary {
  enrollment: Enrollment!
  completedLessons: Int!
  totalLessons: Int!
  estimatedTimeRemaining: Int!
  nextRecommendedLesson: Lesson
  strugglingAreas: [String!]!
}

type Mutation {
  enrollInCourse(courseId: ID!): Enrollment!
  updateLessonProgress(enrollmentId: ID!, lessonId: ID!, progress: ProgressInput!): LessonProgress!
  withdrawEnrollment(enrollmentId: ID!, reason: String): Boolean!
}

type Query {
  myEnrollments(status: EnrollmentStatus): [Enrollment!]!
  enrollmentProgress(enrollmentId: ID!): ProgressSummary!
  verifyCertificate(certificateId: String!): Certificate
}
```

### Communication Module

**Responsibilities**: Direct messaging, discussion forums, announcements, real-time chat

**Domain Entities**:
- `Message`: Direct message between users with threading
- `DiscussionThread`: Course forum thread with posts
- `DiscussionPost`: Individual forum post with voting, solutions
- `Announcement`: Broadcast message to course participants

**Key Interfaces**:
```typescript
interface IMessagingService {
  sendMessage(senderId: string, recipientId: string, content: MessageContent): Promise<Message>
  getConversations(userId: string, pagination: PaginationDTO): Promise<PaginatedResult<Conversation>>
  markAsRead(messageId: string, userId: string): Promise<void>
}

interface IDiscussionService {
  createThread(courseId: string, authorId: string, data: CreateThreadDTO): Promise<DiscussionThread>
  replyToThread(threadId: string, authorId: string, content: string, parentPostId?: string): Promise<DiscussionPost>
  votePost(postId: string, userId: string, voteType: VoteType): Promise<void>
  markSolution(postId: string, educatorId: string): Promise<void>
}

interface IAnnouncementService {
  createAnnouncement(courseId: string, educatorId: string, data: AnnouncementData): Promise<Announcement>
  scheduleAnnouncement(announcement: Announcement, scheduledFor: Date): Promise<void>
}

interface IRealtimeService {
  emitToUser(userId: string, event: string, data: any): Promise<void>
  emitToRoom(roomId: string, event: string, data: any): Promise<void>
  broadcastPresence(userId: string, status: PresenceStatus): Promise<void>
}
```

**GraphQL Schema**:
```graphql
type Message {
  id: ID!
  sender: User!
  recipient: User!
  subject: String
  content: String!
  isRead: Boolean!
  readAt: DateTime
  createdAt: DateTime!
}

type DiscussionThread {
  id: ID!
  course: Course!
  author: User!
  category: String!
  title: String!
  content: String!
  isPinned: Boolean!
  isLocked: Boolean!
  posts: [DiscussionPost!]!
  viewCount: Int!
  replyCount: Int!
  lastActivityAt: DateTime!
}

type DiscussionPost {
  id: ID!
  thread: DiscussionThread!
  author: User!
  content: String!
  parentPost: DiscussionPost
  upvoteCount: Int!
  isSolution: Boolean!
  createdAt: DateTime!
}

type Announcement {
  id: ID!
  course: Course!
  educator: User!
  title: String!
  content: String!
  scheduledFor: DateTime
  publishedAt: DateTime
}

type Subscription {
  messageReceived(userId: ID!): Message!
  newDiscussionPost(threadId: ID!): DiscussionPost!
  announcementPublished(courseId: ID!): Announcement!
  userPresence(courseId: ID!): PresenceUpdate!
}

type Mutation {
  sendMessage(recipientId: ID!, input: MessageInput!): Message!
  createDiscussionThread(courseId: ID!, input: CreateThreadInput!): DiscussionThread!
  replyToThread(threadId: ID!, content: String!, parentPostId: ID): DiscussionPost!
  votePost(postId: ID!, voteType: VoteType!): Boolean!
  markSolution(postId: ID!): Boolean!
  createAnnouncement(courseId: ID!, input: AnnouncementInput!): Announcement!
}
```


### Notifications Module

**Responsibilities**: Multi-channel notification delivery (email, push, in-app), preference management

**Domain Entities**:
- `Notification`: System notification with type, content, delivery status
- `NotificationPreference`: User preferences for notification channels and types
- `EmailTemplate`: Reusable email templates with variable substitution

**Key Interfaces**:
```typescript
interface INotificationService {
  createNotification(recipientId: string, data: NotificationData): Promise<Notification>
  sendEmail(notification: Notification): Promise<void>
  sendPush(notification: Notification): Promise<void>
  markAsRead(notificationId: string, userId: string): Promise<void>
  batchNotifications(notifications: Notification[]): Promise<Notification[]>
}

interface IEmailService {
  sendTransactional(to: string, template: string, data: any): Promise<void>
  sendBulk(recipients: string[], template: string, data: any): Promise<void>
}

interface IPushService {
  sendToDevice(deviceToken: string, notification: PushNotification): Promise<void>
  sendToUser(userId: string, notification: PushNotification): Promise<void>
}
```

### Analytics Module

**Responsibilities**: Data aggregation, metrics calculation, reporting, dashboards

**Domain Entities**:
- `CourseAnalytics`: Aggregated course metrics (enrollments, completion, revenue)
- `StudentAnalytics`: Aggregated student metrics (courses, scores, time)
- `AnalyticsEvent`: Raw event data for tracking user actions

**Key Interfaces**:
```typescript
interface IAnalyticsService {
  updateCourseAnalytics(courseId: string): Promise<CourseAnalytics>
  updateStudentAnalytics(userId: string): Promise<StudentAnalytics>
  generateCourseReport(courseId: string, dateRange: DateRange): Promise<CourseReport>
  generateStudentReport(userId: string, dateRange: DateRange): Promise<StudentReport>
  getDashboardMetrics(userId: string, role: Role): Promise<DashboardMetrics>
  trackEvent(event: AnalyticsEvent): Promise<void>
}

interface IMetricsCalculator {
  calculateCompletionRate(courseId: string): Promise<number>
  calculateAverageScore(userId: string): Promise<number>
  calculateEngagementScore(userId: string): Promise<number>
  identifyTrends(metric: string, dateRange: DateRange): Promise<TrendData>
}
```

### Payments Module

**Responsibilities**: Stripe integration, transaction processing, refunds, subscription management

**Domain Entities**:
- `Payment`: Transaction record with amount, status, Stripe details
- `Subscription`: Recurring payment plan with billing cycle
- `Refund`: Refund transaction with reason, amount

**Key Interfaces**:
```typescript
interface IPaymentService {
  createCheckoutSession(courseId: string, studentId: string): Promise<CheckoutSession>
  handleWebhook(event: StripeEvent): Promise<void>
  processRefund(enrollmentId: string, reason: string): Promise<Refund>
  createSubscription(userId: string, planId: string): Promise<Subscription>
  cancelSubscription(subscriptionId: string): Promise<void>
}

interface IStripeClient {
  createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session>
  createRefund(paymentIntentId: string, amount: number): Promise<Stripe.Refund>
  createSubscription(params: SubscriptionParams): Promise<Stripe.Subscription>
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event
}
```

### Search Module

**Responsibilities**: Elasticsearch integration, full-text search, faceted filtering

**Domain Entities**:
- `SearchIndex`: Elasticsearch index configuration
- `SearchResult`: Search result with highlighting, relevance score
- `SearchFacet`: Aggregation for filtering options

**Key Interfaces**:
```typescript
interface ISearchService {
  indexCourse(course: Course): Promise<void>
  indexLesson(lesson: Lesson): Promise<void>
  searchCourses(query: string, filters: SearchFilters, pagination: PaginationDTO): Promise<SearchResults>
  searchLessons(courseId: string, query: string): Promise<SearchResults>
  autocomplete(query: string): Promise<string[]>
  getTrendingSearches(): Promise<string[]>
}

interface IElasticsearchClient {
  index(index: string, id: string, document: any): Promise<void>
  search(index: string, query: any): Promise<SearchResponse>
  deleteIndex(index: string): Promise<void>
  createIndex(index: string, mappings: any): Promise<void>
}
```

## Data Models

### Database Schema

**PostgreSQL Tables with Drizzle ORM Definitions**:

```typescript
// users.schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: pgEnum('role', ['student', 'educator', 'admin']).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  verificationToken: varchar('verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  notificationPreferences: jsonb('notification_preferences').default({}).notNull(),
  privacySettings: jsonb('privacy_settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// courses.schema.ts
export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  instructorId: uuid('instructor_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  category: varchar('category', { length: 100 }).notNull(),
  difficulty: pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  enrollmentLimit: integer('enrollment_limit'),
  enrollmentCount: integer('enrollment_count').default(0).notNull(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalReviews: integer('total_reviews').default(0).notNull(),
  status: pgEnum('status', ['draft', 'pending_review', 'published', 'archived']).default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  instructorIdx: index('courses_instructor_idx').on(table.instructorId),
  statusIdx: index('courses_status_idx').on(table.status),
  categoryIdx: index('courses_category_idx').on(table.category),
  slugIdx: uniqueIndex('courses_slug_idx').on(table.slug),
}));

export const courseModules = pgTable('course_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  orderNumber: integer('order_number').notNull(),
  durationMinutes: integer('duration_minutes').default(0).notNull(),
  prerequisiteModuleId: uuid('prerequisite_module_id').references(() => courseModules.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseOrderIdx: uniqueIndex('modules_course_order_idx').on(table.courseId, table.orderNumber),
}));

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').references(() => courseModules.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  lessonType: pgEnum('lesson_type', ['video', 'text', 'quiz', 'assignment']).notNull(),
  contentUrl: varchar('content_url', { length: 500 }),
  contentText: text('content_text'),
  durationMinutes: integer('duration_minutes'),
  orderNumber: integer('order_number').notNull(),
  isPreview: boolean('is_preview').default(false).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  moduleOrderIdx: uniqueIndex('lessons_module_order_idx').on(table.moduleId, table.orderNumber),
}));

// enrollments.schema.ts
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0').notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
  paymentId: uuid('payment_id').references(() => payments.id),
  certificateId: uuid('certificate_id').references(() => certificates.id),
  status: pgEnum('enrollment_status', ['active', 'completed', 'dropped']).default('active').notNull(),
  refundRequested: boolean('refund_requested').default(false).notNull(),
  refundProcessedAt: timestamp('refund_processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  studentCourseIdx: uniqueIndex('enrollments_student_course_idx').on(table.studentId, table.courseId),
  studentIdx: index('enrollments_student_idx').on(table.studentId),
  courseIdx: index('enrollments_course_idx').on(table.courseId),
  statusIdx: index('enrollments_status_idx').on(table.status),
}));

export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }).notNull(),
  status: pgEnum('progress_status', ['not_started', 'in_progress', 'completed']).default('not_started').notNull(),
  timeSpentSeconds: integer('time_spent_seconds').default(0).notNull(),
  completedAt: timestamp('completed_at'),
  quizScore: integer('quiz_score'),
  attemptsCount: integer('attempts_count').default(0).notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  enrollmentLessonIdx: uniqueIndex('progress_enrollment_lesson_idx').on(table.enrollmentId, table.lessonId),
  statusIdx: index('progress_status_idx').on(table.status),
}));

// assessments.schema.ts
export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  quizType: pgEnum('quiz_type', ['formative', 'summative', 'practice']).notNull(),
  timeLimitMinutes: integer('time_limit_minutes'),
  passingScorePercentage: integer('passing_score_percentage').notNull(),
  maxAttempts: integer('max_attempts').default(0).notNull(),
  randomizeQuestions: boolean('randomize_questions').default(false).notNull(),
  randomizeOptions: boolean('randomize_options').default(false).notNull(),
  showCorrectAnswers: boolean('show_correct_answers').default(true).notNull(),
  showExplanations: boolean('show_explanations').default(true).notNull(),
  availableFrom: timestamp('available_from'),
  availableUntil: timestamp('available_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  questionType: pgEnum('question_type', ['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching']).notNull(),
  questionText: text('question_text').notNull(),
  questionMediaUrl: varchar('question_media_url', { length: 500 }),
  options: jsonb('options'),
  correctAnswer: jsonb('correct_answer').notNull(),
  explanation: text('explanation'),
  points: integer('points').default(1).notNull(),
  orderNumber: integer('order_number').notNull(),
  difficulty: pgEnum('difficulty', ['easy', 'medium', 'hard']).default('medium').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  quizOrderIdx: index('questions_quiz_order_idx').on(table.quizId, table.orderNumber),
}));

export const quizSubmissions = pgTable('quiz_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  timeTakenSeconds: integer('time_taken_seconds'),
  scorePercentage: decimal('score_percentage', { precision: 5, scale: 2 }),
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  answers: jsonb('answers').notNull(),
  gradingStatus: pgEnum('grading_status', ['auto_graded', 'pending_review', 'graded']).default('auto_graded').notNull(),
  feedback: text('feedback'),
  gradedAt: timestamp('graded_at'),
  gradedBy: uuid('graded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  quizStudentIdx: index('submissions_quiz_student_idx').on(table.quizId, table.studentId),
  gradingStatusIdx: index('submissions_grading_status_idx').on(table.gradingStatus),
}));

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  dueDate: timestamp('due_date').notNull(),
  lateSubmissionAllowed: boolean('late_submission_allowed').default(false).notNull(),
  latePenaltyPercentage: integer('late_penalty_percentage').default(0).notNull(),
  maxPoints: integer('max_points').notNull(),
  requiresFileUpload: boolean('requires_file_upload').default(true).notNull(),
  allowedFileTypes: jsonb('allowed_file_types').notNull(),
  maxFileSizeMb: integer('max_file_size_mb').default(10).notNull(),
  rubric: jsonb('rubric'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }).notNull(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSizeBytes: integer('file_size_bytes'),
  submissionText: text('submission_text'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  isLate: boolean('is_late').default(false).notNull(),
  pointsAwarded: decimal('points_awarded', { precision: 10, scale: 2 }),
  feedback: text('feedback'),
  gradingStatus: pgEnum('assignment_grading_status', ['submitted', 'under_review', 'graded', 'revision_requested']).default('submitted').notNull(),
  gradedAt: timestamp('graded_at'),
  gradedBy: uuid('graded_by').references(() => users.id),
  revisionNumber: integer('revision_number').default(1).notNull(),
  parentSubmissionId: uuid('parent_submission_id').references(() => assignmentSubmissions.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  assignmentStudentIdx: index('assignment_submissions_assignment_student_idx').on(table.assignmentId, table.studentId),
  gradingStatusIdx: index('assignment_submissions_grading_status_idx').on(table.gradingStatus),
}));

// communication.schema.ts
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').notNull(),
  subject: varchar('subject', { length: 255 }),
  content: text('content').notNull(),
  attachments: jsonb('attachments'),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  parentMessageId: uuid('parent_message_id').references(() => messages.id),
  deletedBySender: timestamp('deleted_by_sender'),
  deletedByRecipient: timestamp('deleted_by_recipient'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  recipientIdx: index('messages_recipient_idx').on(table.recipientId),
  isReadIdx: index('messages_is_read_idx').on(table.isRead),
}));

export const discussionThreads = pgTable('discussion_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseIdx: index('threads_course_idx').on(table.courseId),
  categoryIdx: index('threads_category_idx').on(table.category),
  lastActivityIdx: index('threads_last_activity_idx').on(table.lastActivityAt),
}));

export const discussionPosts = pgTable('discussion_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').references(() => discussionThreads.id, { onDelete: 'cascade' }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  parentPostId: uuid('parent_post_id').references(() => discussionPosts.id),
  content: text('content').notNull(),
  upvoteCount: integer('upvote_count').default(0).notNull(),
  isSolution: boolean('is_solution').default(false).notNull(),
  editedAt: timestamp('edited_at'),
  editHistory: jsonb('edit_history'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  threadIdx: index('posts_thread_idx').on(table.threadId),
  authorIdx: index('posts_author_idx').on(table.authorId),
}));

export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }).notNull(),
  educatorId: uuid('educator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseIdx: index('announcements_course_idx').on(table.courseId),
  publishedIdx: index('announcements_published_idx').on(table.publishedAt),
}));

// notifications.schema.ts
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  notificationType: pgEnum('notification_type', [
    'new_message', 'assignment_due', 'grade_posted', 'course_update', 
    'announcement', 'discussion_reply', 'enrollment_confirmed'
  ]).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  actionUrl: varchar('action_url', { length: 500 }),
  priority: pgEnum('priority', ['normal', 'high', 'urgent']).default('normal').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  recipientIdx: index('notifications_recipient_idx').on(table.recipientId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
  typeIdx: index('notifications_type_idx').on(table.notificationType),
}));

// analytics.schema.ts
export const courseAnalytics = pgTable('course_analytics', {
  courseId: uuid('course_id').primaryKey().references(() => courses.id, { onDelete: 'cascade' }),
  totalEnrollments: integer('total_enrollments').default(0).notNull(),
  activeEnrollments: integer('active_enrollments').default(0).notNull(),
  completionCount: integer('completion_count').default(0).notNull(),
  completionRate: decimal('completion_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0').notNull(),
  averageTimeToCompletionDays: integer('average_time_to_completion_days'),
  dropoutRate: decimal('dropout_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  mostDifficultLessonId: uuid('most_difficult_lesson_id').references(() => lessons.id),
  engagementMetrics: jsonb('engagement_metrics'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export const studentAnalytics = pgTable('student_analytics', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalCoursesEnrolled: integer('total_courses_enrolled').default(0).notNull(),
  coursesCompleted: integer('courses_completed').default(0).notNull(),
  coursesInProgress: integer('courses_in_progress').default(0).notNull(),
  averageQuizScore: decimal('average_quiz_score', { precision: 5, scale: 2 }),
  totalTimeInvestedMinutes: integer('total_time_invested_minutes').default(0).notNull(),
  currentStreakDays: integer('current_streak_days').default(0).notNull(),
  longestStreakDays: integer('longest_streak_days').default(0).notNull(),
  badgesEarned: jsonb('badges_earned'),
  skillRatings: jsonb('skill_ratings'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: jsonb('event_data').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('events_user_idx').on(table.userId),
  typeIdx: index('events_type_idx').on(table.eventType),
  timestampIdx: index('events_timestamp_idx').on(table.timestamp),
}));

// payments.schema.ts
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  courseId: uuid('course_id').references(() => courses.id, { onDelete: 'cascade' }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).unique(),
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }).unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  status: pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded']).default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('payments_user_idx').on(table.userId),
  statusIdx: index('payments_status_idx').on(table.status),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique().notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  planId: varchar('plan_id', { length: 100 }).notNull(),
  status: pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'unpaid']).default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('subscriptions_user_idx').on(table.userId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }).notNull(),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }),
  stripeRefundId: varchar('stripe_refund_id', { length: 255 }).unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: text('reason'),
  status: pgEnum('refund_status', ['pending', 'succeeded', 'failed']).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// certificates.schema.ts
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  enrollmentId: uuid('enrollment_id').references(() => enrollments.id, { onDelete: 'cascade' }).notNull().unique(),
  certificateId: varchar('certificate_id', { length: 100 }).unique().notNull(),
  pdfUrl: varchar('pdf_url', { length: 500 }).notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  verificationUrl: varchar('verification_url', { length: 500 }).notNull(),
  metadata: jsonb('metadata'),
}, (table) => ({
  certificateIdIdx: uniqueIndex('certificates_certificate_id_idx').on(table.certificateId),
}));
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Authentication and Authorization Properties

**Property 1: Email validation consistency**
*For any* string input, the email validation function should accept all strings matching standard email regex patterns and reject all strings that don't match
**Validates: Requirements 1.1**

**Property 2: Email uniqueness enforcement**
*For any* registration attempt, if an email already exists in the database, the registration should be rejected with a duplicate email error
**Validates: Requirements 1.2**

**Property 3: Password strength validation**
*For any* password string, the validation should accept passwords with minimum eight characters containing at least one uppercase, one lowercase, and one number, and reject all others
**Validates: Requirements 1.3**

**Property 4: Password hashing round-trip**
*For any* valid password, after hashing with bcrypt, the verification function should return true when comparing the original password against the hash
**Validates: Requirements 1.4**

**Property 5: Password hash uniqueness**
*For any* password, hashing it multiple times should produce different hashes due to salt, but all hashes should verify successfully against the original password
**Validates: Requirements 1.4**

**Property 6: Verification token uniqueness**
*For any* set of user registrations, all generated verification tokens should be unique across all users
**Validates: Requirements 1.5**

**Property 7: JWT token structure validity**
*For any* successful login, the generated access token and refresh token should be valid JWTs containing user ID, email, and role in the payload with correct expiration times (15 minutes for access, 30 days for refresh)
**Validates: Requirements 1.6**

**Property 8: Refresh token persistence**
*For any* successful login, the refresh token should be stored in Redis with the user ID as key and automatic expiration matching the token lifetime
**Validates: Requirements 1.7**

**Property 9: Role-based endpoint access**
*For any* educator-only endpoint and any request with student role, the request should be rejected with forbidden error
**Validates: Requirements 2.2, 2.3**

**Property 10: Resource ownership verification**
*For any* resource modification attempt, if the requesting user does not own the resource and lacks explicit permission, the request should be rejected
**Validates: Requirements 2.4**

**Property 11: JWT role extraction**
*For any* valid JWT token, extracting the role from the payload should return the role value that was encoded during token generation
**Validates: Requirements 2.5**

### Course Management Properties

**Property 12: Course slug generation uniqueness**
*For any* course title, the generated URL slug should be unique across all courses, and creating multiple courses with the same title should produce different slugs
**Validates: Requirements 3.1**

**Property 13: Module order number uniqueness**
*For any* course, all modules within that course should have unique order numbers, and adding a new module should assign an order number not already used
**Validates: Requirements 3.2**

**Property 14: Lesson type validation**
*For any* lesson creation with a specific type (video, text, quiz, assignment), the validation should enforce type-specific required fields and reject lessons missing those fields
**Validates: Requirements 3.3**

**Property 15: Reordering preserves uniqueness**
*For any* course with modules, after reordering modules, all order numbers should remain unique and sequential without gaps
**Validates: Requirements 3.4**

**Property 16: Publication validation completeness**
*For any* course, attempting to publish should succeed only if the course has at least three modules with content and all videos are processed
**Validates: Requirements 3.5**

**Property 17: Cache invalidation on update**
*For any* course update, the cached course data in Redis should be invalidated, and subsequent reads should fetch fresh data from the database
**Validates: Requirements 3.6**

**Property 18: Cascade deletion integrity**
*For any* course deletion, all associated modules, lessons, quizzes, and assignments should also be deleted, leaving no orphaned records
**Validates: Requirements 3.7**

### Content and Video Processing Properties

**Property 19: Presigned URL validity**
*For any* video upload request, the generated presigned S3 URL should be valid for exactly one hour and allow file uploads during that period
**Validates: Requirements 4.1**

**Property 20: Video processing status update**
*For any* video transcoding completion event, the corresponding lesson record should be updated with processed video URLs and status changed to active
**Validates: Requirements 4.4**

**Property 21: Streaming URL expiration**
*For any* video streaming request, the generated CloudFront signed URL should have an expiration time equal to the lesson duration
**Validates: Requirements 4.5**

### Enrollment and Progress Properties

**Property 22: Duplicate enrollment prevention**
*For any* student and course combination, attempting to enroll when already enrolled should be rejected with a duplicate enrollment error
**Validates: Requirements 5.1**

**Property 23: Progress record initialization**
*For any* new enrollment, lesson progress records should be created for all lessons in the course with not_started status
**Validates: Requirements 5.3**

**Property 24: Progress percentage calculation**
*For any* enrollment, the progress percentage should equal (completed lessons / total lessons) * 100, updated whenever a lesson is completed
**Validates: Requirements 5.4**

**Property 25: Module completion detection**
*For any* module, when all lessons within that module are marked completed, the module should be marked as completed
**Validates: Requirements 5.5**

**Property 26: Certificate generation on completion**
*For any* enrollment, when all required lessons are completed, a unique certificate should be generated containing student name, course title, completion date, and verification QR code
**Validates: Requirements 5.6**

**Property 27: Certificate delivery workflow**
*For any* generated certificate, the PDF should be uploaded to S3, the enrollment record should be updated with the certificate ID, and an email should be sent to the student
**Validates: Requirements 5.7**

**Property 28: Prerequisite enforcement**
*For any* lesson with prerequisites, access should be granted only if all prerequisite lessons are marked as completed
**Validates: Requirements 5.8**

### Assessment Properties

**Property 29: Question type support**
*For any* quiz, questions of all supported types (multiple_choice, true_false, short_answer, essay, fill_blank, matching) should be creatable and storable
**Validates: Requirements 6.1**

**Property 30: Quiz configuration validation**
*For any* quiz creation, all configuration options (time limit, passing score, max attempts, randomization) should be settable and persisted correctly
**Validates: Requirements 6.2**

**Property 31: Quiz attempt creation**
*For any* quiz start request, a submission record should be created with started status and current timestamp
**Validates: Requirements 6.3**

**Property 32: Auto-grading accuracy**
*For any* quiz submission with objective questions, the calculated score should match the sum of points for correct answers divided by total points
**Validates: Requirements 6.4, 6.5**

**Property 33: Subjective question handling**
*For any* quiz submission containing essay or short answer questions, the grading status should be set to pending_review
**Validates: Requirements 6.6**

**Property 34: Manual grading workflow**
*For any* pending quiz submission, when an educator assigns points and feedback, the grading status should change to graded and the student should receive a notification
**Validates: Requirements 6.7**

**Property 35: File upload validation**
*For any* assignment submission, files should be validated against allowed types and maximum size, rejecting files that don't meet criteria
**Validates: Requirements 7.2**

**Property 36: Late submission detection**
*For any* assignment submission, if the submission timestamp is after the due date, the is_late flag should be set to true and late penalties should be applied if configured
**Validates: Requirements 7.3**

**Property 37: Revision workflow linking**
*For any* assignment resubmission, the new submission record should be linked to the original submission via parent_submission_id
**Validates: Requirements 7.6**

### Search and Discovery Properties

**Property 38: Search result relevance**
*For any* search query, results should include all courses where the query matches title, description, or instructor name, ranked by relevance
**Validates: Requirements 8.1, 8.2**

**Property 39: Filter application correctness**
*For any* search with filters applied, all returned results should match all specified filter criteria (category, difficulty, price range, rating)
**Validates: Requirements 8.3**

**Property 40: Facet count accuracy**
*For any* search results, facet counts should accurately reflect the number of results available for each filter option
**Validates: Requirements 8.4**

**Property 41: Sort order correctness**
*For any* search results with sorting applied, results should be ordered according to the specified sort criterion (popularity, rating, newest, trending)
**Validates: Requirements 8.5**

**Property 42: Search index synchronization**
*For any* course update, the Elasticsearch index should be updated to reflect the changes within a reasonable time window
**Validates: Requirements 8.7**

### Communication Properties

**Property 43: Message delivery completeness**
*For any* message sent, a message record should be created in the database, and if the recipient is online, a real-time WebSocket event should be emitted
**Validates: Requirements 9.1**

**Property 44: Discussion enrollment validation**
*For any* discussion thread creation attempt, the user should be enrolled in the course, otherwise the request should be rejected
**Validates: Requirements 9.2**

**Property 45: Reply threading structure**
*For any* discussion reply with a parent post, the parent_post_id should correctly reference the parent, creating a tree structure
**Validates: Requirements 9.3**

**Property 46: Vote duplicate prevention**
*For any* user and post combination, only one vote should be allowed, and subsequent vote attempts should be rejected or toggle the existing vote
**Validates: Requirements 9.4**

**Property 47: Solution marking effects**
*For any* post marked as solution by an educator, the is_solution flag should be set to true and the post author should receive a notification
**Validates: Requirements 9.5**

### Notification Properties

**Property 48: Notification creation and delivery**
*For any* notification event, a notification record should be created, and delivery should be triggered via appropriate channels based on user preferences
**Validates: Requirements 10.1**

**Property 49: Email template selection**
*For any* email notification, the correct template should be selected based on notification type, and dynamic data should be populated correctly
**Validates: Requirements 10.2**

**Property 50: Notification read status update**
*For any* notification marked as read, the is_read flag should be set to true, read_at timestamp should be set, and unread count should be decremented
**Validates: Requirements 10.4**

**Property 51: Notification batching**
*For any* set of similar notifications occurring within a short time window, they should be batched into a single digest notification
**Validates: Requirements 10.5**

### Payment Properties

**Property 52: Webhook signature validation**
*For any* incoming Stripe webhook, the signature should be validated, and events with invalid signatures should be rejected
**Validates: Requirements 11.2**

**Property 53: Payment completion enrollment**
*For any* successful payment completion event, an enrollment record should be created or updated, and the student should receive confirmation
**Validates: Requirements 11.3**

**Property 54: Refund amount calculation**
*For any* refund request, the refund amount should be calculated based on the refund policy and content consumed, not exceeding the original payment amount
**Validates: Requirements 11.5**

**Property 55: Refund side effects**
*For any* processed refund, the enrollment status should be updated, the student should be notified, and revenue analytics should be adjusted
**Validates: Requirements 11.6**

### Analytics Properties

**Property 56: Course analytics accuracy**
*For any* course, calculated analytics (total enrollments, completion rate, average rating) should match the actual data in the database
**Validates: Requirements 12.1**

**Property 57: Student analytics accuracy**
*For any* student, calculated analytics (courses completed, average quiz score, total time) should match the aggregated data from their enrollments and submissions
**Validates: Requirements 12.2**

**Property 58: Report data completeness**
*For any* course report request, the generated report should include all specified data points (enrollment trends, completion rates, performance by module)
**Validates: Requirements 12.3**

**Property 59: Dashboard data presence**
*For any* student dashboard request, all required data (courses in progress, upcoming deadlines, recent grades, achievements) should be present in the response
**Validates: Requirements 12.4**

**Property 60: Analytics caching**
*For any* expensive analytics query, the result should be cached in Redis, and subsequent identical queries should return cached data until TTL expires
**Validates: Requirements 12.6**

**Property 61: Event logging completeness**
*For any* user action, an event should be logged to the analytics_events table with timestamp, user ID, event type, and contextual metadata
**Validates: Requirements 12.7**

### Security Properties

**Property 62: Input validation enforcement**
*For any* API endpoint, invalid input data should be rejected with validation errors before any business logic executes
**Validates: Requirements 13.1**

**Property 63: HTML sanitization**
*For any* user-generated HTML content, dangerous tags and attributes should be removed, preventing XSS attacks
**Validates: Requirements 13.3**

**Property 64: File upload validation**
*For any* file upload, the file type should be validated against a whitelist and file size should be checked against maximum limits
**Validates: Requirements 13.4**

**Property 65: Rate limit enforcement**
*For any* IP address or authenticated user, after exceeding the rate limit, subsequent requests should be rejected with status 429
**Validates: Requirements 13.5**

**Property 66: Rate limit response headers**
*For any* rate-limited response, headers should include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset
**Validates: Requirements 13.6**

**Property 67: Sensitive data redaction**
*For any* log entry containing sensitive fields (password, token, payment info), those fields should be automatically redacted
**Validates: Requirements 13.7**

### GraphQL API Properties

**Property 68: GraphQL query resolution**
*For any* valid GraphQL query, the resolver should return data matching the requested fields and types
**Validates: Requirements 21.2**

**Property 69: GraphQL mutation authorization**
*For any* GraphQL mutation, authorization checks should be performed, and unauthorized requests should be rejected
**Validates: Requirements 21.3**

**Property 70: GraphQL error formatting**
*For any* error occurring in a resolver, the error response should include error code, message, and field-level validation details in a consistent format
**Validates: Requirements 21.6**

**Property 71: GraphQL authentication**
*For any* authenticated GraphQL request, the JWT should be extracted from the Authorization header, validated, and user context should be attached to the resolver
**Validates: Requirements 21.7**

## Error Handling

### Error Classification

The system implements a hierarchical error handling strategy with custom error classes for different scenarios:

**ValidationError**: Represents invalid input data with detailed field-level validation failures. HTTP status 400. Contains fields array with specific validation messages.

**AuthenticationError**: Signals invalid credentials, expired tokens, or missing authentication. HTTP status 401. Includes reason for authentication failure.

**AuthorizationError**: Indicates insufficient permissions for the requested action. HTTP status 403. Contains required_role and user_role for debugging.

**NotFoundError**: Represents requested resources that don't exist. HTTP status 404. Includes resource_type and resource_id.

**ConflictError**: Signals duplicate data or state conflicts like duplicate enrollment. HTTP status 409. Contains conflict_field identifying the conflicting data.

**ExternalServiceError**: Wraps failures from third-party APIs (Stripe, AWS, SendGrid). HTTP status 502 or 503. Includes service_name and original_error.

**DatabaseError**: Represents database operation failures. HTTP status 500. Contains sanitized error information without exposing schema details.

### Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "fields": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "requestId": "req_abc123xyz",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Production responses never include stack traces or internal implementation details. Development responses include full debugging information including stack traces and query details.

### Error Handling Flow

1. **Input Validation Layer**: Fastify JSON Schema validation catches malformed requests before reaching business logic
2. **Service Layer**: Business logic throws domain-specific errors with context
3. **Controller Layer**: Catches service errors, determines HTTP status codes, formats responses
4. **Global Error Handler**: Catches unhandled errors, logs with full context, returns sanitized responses

### Logging Strategy

All errors are logged with comprehensive context:
- Request ID for correlation
- User ID if authenticated
- Endpoint and HTTP method
- Request body (sanitized)
- Stack trace
- Timestamp

Critical errors (database failures, payment processing errors) trigger immediate alerts to on-call engineers.

## Testing Strategy

### Unit Testing

**Framework**: Jest 29+ with TypeScript support

**Coverage Requirements**:
- Minimum 80% overall code coverage
- 100% coverage for critical paths (authentication, payment processing, enrollment)
- All service functions must have unit tests

**Testing Approach**:
- Test each service function in isolation
- Mock all external dependencies (database, Redis, S3, Stripe, SendGrid)
- Test happy paths, edge cases, and error conditions
- Use descriptive test names explaining what is being tested

**Example Test Structure**:
```typescript
describe('AuthService', () => {
  describe('register', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const mockUserRepo = createMockUserRepository();
      const authService = new AuthService(mockUserRepo);
      
      // Act
      const result = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123',
        fullName: 'Test User',
        role: 'student'
      });
      
      // Assert
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.passwordHash).not.toBe('SecurePass123');
      expect(mockUserRepo.create).toHaveBeenCalledTimes(1);
    });
    
    it('should reject duplicate email', async () => {
      // Test duplicate email rejection
    });
    
    it('should reject weak password', async () => {
      // Test password strength validation
    });
  });
});
```

### Property-Based Testing

**Framework**: fast-check for TypeScript

**Configuration**: Each property test should run minimum 100 iterations to ensure thorough coverage of the input space

**Test Annotation**: Each property-based test must include a comment explicitly referencing the correctness property from the design document using this format:
```typescript
/**
 * Feature: learning-platform-backend, Property 1: Email validation consistency
 * Validates: Requirements 1.1
 */
```

**Testing Approach**:
- Generate random valid and invalid inputs
- Test universal properties that should hold across all inputs
- Focus on invariants, round-trip properties, and metamorphic properties
- Use smart generators that constrain to realistic input spaces

**Example Property Test**:
```typescript
import * as fc from 'fast-check';

/**
 * Feature: learning-platform-backend, Property 1: Email validation consistency
 * Validates: Requirements 1.1
 */
describe('Email Validation Property', () => {
  it('should accept all valid email formats', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        (email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('should reject all invalid email formats', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('@')),
        (invalidEmail) => {
          const result = validateEmail(invalidEmail);
          expect(result.isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: learning-platform-backend, Property 4: Password hashing round-trip
 * Validates: Requirements 1.4
 */
describe('Password Hashing Property', () => {
  it('should verify any password against its hash', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 100 }),
        async (password) => {
          const hash = await hashPassword(password);
          const isValid = await verifyPassword(password, hash);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Framework**: Jest with Supertest for HTTP testing

**Database**: Real PostgreSQL test database, reset before each test suite

**Testing Approach**:
- Test complete workflows from API endpoint to database
- Use real database with transactions rolled back after each test
- Test authentication and authorization flows
- Verify database state after operations
- Test error scenarios and rollback behavior

**Example Integration Test**:
```typescript
describe('Course Enrollment Integration', () => {
  let app: FastifyInstance;
  let testDb: Database;
  let studentToken: string;
  
  beforeAll(async () => {
    app = await createTestApp();
    testDb = await setupTestDatabase();
    studentToken = await createTestUser('student');
  });
  
  afterEach(async () => {
    await testDb.truncateAll();
  });
  
  it('should enroll student in course and initialize progress', async () => {
    // Create course with lessons
    const course = await testDb.createCourse({
      title: 'Test Course',
      modules: [
        {
          title: 'Module 1',
          lessons: [
            { title: 'Lesson 1', type: 'video' },
            { title: 'Lesson 2', type: 'text' }
          ]
        }
      ]
    });
    
    // Enroll student
    const response = await request(app.server)
      .post(`/api/enrollments`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course.id })
      .expect(201);
    
    // Verify enrollment created
    expect(response.body.enrollment.courseId).toBe(course.id);
    expect(response.body.enrollment.status).toBe('active');
    
    // Verify progress records initialized
    const progress = await testDb.getLessonProgress(response.body.enrollment.id);
    expect(progress).toHaveLength(2);
    expect(progress.every(p => p.status === 'not_started')).toBe(true);
  });
});
```

### End-to-End Testing

**Framework**: Playwright for browser automation

**Environment**: Staging environment matching production configuration

**Testing Approach**:
- Simulate complete user journeys from UI to backend
- Test critical paths before each deployment
- Verify frontend and backend integration
- Test real-time features with WebSocket

**Example E2E Test**:
```typescript
test('Student can enroll, complete course, and receive certificate', async ({ page }) => {
  // Login as student
  await page.goto('/login');
  await page.fill('[name="email"]', 'student@example.com');
  await page.fill('[name="password"]', 'SecurePass123');
  await page.click('button[type="submit"]');
  
  // Browse and enroll in course
  await page.goto('/courses');
  await page.click('text=Introduction to Programming');
  await page.click('button:has-text("Enroll Now")');
  
  // Complete all lessons
  await page.click('text=Start Learning');
  for (let i = 0; i < 10; i++) {
    await page.click('button:has-text("Mark as Complete")');
    await page.click('button:has-text("Next Lesson")');
  }
  
  // Verify certificate received
  await page.waitForSelector('text=Congratulations! You completed the course');
  await page.click('button:has-text("Download Certificate")');
  
  // Verify certificate PDF downloaded
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toContain('certificate');
});
```

### Load Testing

**Framework**: k6 for load testing

**Testing Approach**:
- Simulate realistic user behavior with think time
- Gradually increase load to identify breaking points
- Test autoscaling triggers
- Establish performance baselines

**Example Load Test**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

export default function () {
  // Login
  let loginRes = http.post('https://api.example.com/auth/login', {
    email: 'student@example.com',
    password: 'SecurePass123',
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  let token = loginRes.json('accessToken');
  
  // Browse courses
  let coursesRes = http.get('https://api.example.com/courses', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  check(coursesRes, {
    'courses loaded': (r) => r.status === 200,
  });
  
  sleep(1);  // Think time
}
```

### Test Data Management

**Factories**: Use factory functions to generate test entities with realistic data

```typescript
export const userFactory = (overrides?: Partial<User>): User => ({
  id: uuid(),
  email: `test-${uuid()}@example.com`,
  passwordHash: '$2b$12$...',
  role: 'student',
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const courseFactory = (overrides?: Partial<Course>): Course => ({
  id: uuid(),
  instructorId: uuid(),
  title: `Test Course ${uuid().slice(0, 8)}`,
  description: 'A comprehensive test course',
  slug: `test-course-${uuid().slice(0, 8)}`,
  category: 'programming',
  difficulty: 'beginner',
  price: 49.99,
  status: 'published',
  ...overrides,
});
```

**Database Seeds**: Pre-populate test database with known data for integration tests

```typescript
export async function seedTestDatabase(db: Database) {
  // Create test users
  const educator = await db.users.create(userFactory({ role: 'educator' }));
  const student = await db.users.create(userFactory({ role: 'student' }));
  
  // Create test courses
  const course = await db.courses.create(courseFactory({
    instructorId: educator.id,
  }));
  
  // Create modules and lessons
  const module = await db.courseModules.create({
    courseId: course.id,
    title: 'Introduction',
    orderNumber: 1,
  });
  
  await db.lessons.create({
    moduleId: module.id,
    title: 'Getting Started',
    lessonType: 'video',
    orderNumber: 1,
  });
  
  return { educator, student, course, module };
}
```

**Test Isolation**: Ensure tests don't interfere with each other

```typescript
describe('Enrollment Tests', () => {
  let db: Database;
  
  beforeEach(async () => {
    // Start transaction
    await db.beginTransaction();
  });
  
  afterEach(async () => {
    // Rollback transaction
    await db.rollbackTransaction();
  });
  
  it('should create enrollment', async () => {
    // Test runs in transaction, changes rolled back after
  });
});
```

This comprehensive testing strategy ensures high code quality, catches bugs early, and provides confidence in deployments. The combination of unit tests, property-based tests, integration tests, E2E tests, and load tests provides thorough coverage of functionality, correctness, and performance.
