# Frontend Foundation Layer Design

## Overview

This document outlines the comprehensive design for a production-ready frontend foundation layer that enables seamless communication between a Next.js application and a GraphQL-based Learning Management System backend. The foundation layer provides type-safe, performant, and developer-friendly infrastructure for building sophisticated educational platform features.

The backend system is a comprehensive LMS built with:
- **API Layer**: Fastify + TypeScript + GraphQL (Apollo Server)
- **Database**: PostgreSQL + Drizzle ORM with optimized queries
- **Authentication**: JWT with access/refresh token rotation
- **Storage**: AWS S3 + CloudFront for content delivery
- **Caching**: Redis for sessions and application cache
- **Search**: Elasticsearch for full-text search capabilities
- **Jobs**: BullMQ for background processing
- **Real-time**: WebSocket subscriptions for live updates
- **Payments**: Stripe integration for course purchases

The foundation layer abstracts this complexity into clean, reusable utilities that enable rapid feature development while maintaining type safety and performance.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│                   UI Components Layer                       │
├─────────────────────────────────────────────────────────────┤
│                Foundation Layer (This Design)               │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │   Hooks     │   GraphQL   │    Auth     │   Utils     │  │
│  │   Layer     │   Client    │   System    │   Layer     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Network Layer                            │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │  GraphQL    │ WebSocket   │   HTTP      │   Upload    │  │
│  │  over HTTP  │Subscriptions│   REST      │   to S3     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Backend Services                         │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │   Fastify   │   Apollo    │    Redis    │     S3      │  │
│  │   Server    │   GraphQL   │   Cache     │   Storage   │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Module Architecture

The foundation layer is organized into focused modules with clear responsibilities:

1. **GraphQL Client Module** (`lib/graphql/`)
   - Apollo Client configuration with authentication
   - Error handling and retry logic
   - Cache management and optimization
   - Request deduplication and batching

2. **Authentication Module** (`lib/auth/`)
   - JWT token management with automatic refresh
   - Role-based access control
   - Session persistence and security
   - Authentication state management

3. **Data Hooks Module** (`hooks/`)
   - Domain-specific React hooks for all backend modules
   - Consistent API patterns across all data operations
   - Optimistic updates and error handling
   - Loading states and cache integration

4. **Subscription Module** (`lib/subscriptions/`)
   - WebSocket connection management
   - Real-time data synchronization
   - Automatic reconnection and error recovery
   - Subscription lifecycle management

5. **Upload Module** (`lib/uploads/`)
   - Presigned URL upload workflow
   - Progress tracking and error recovery
   - File validation and type checking
   - Concurrent upload management

6. **Type System** (`types/`)
   - Generated TypeScript types from GraphQL schema
   - Domain model interfaces
   - Form input types and validation schemas
   - Utility types for common patterns

## Components and Interfaces

### GraphQL Client Configuration

The GraphQL client serves as the central communication hub with comprehensive error handling and authentication integration:

```typescript
// lib/graphql/client.ts
interface GraphQLClientConfig {
  uri: string;
  wsUri: string;
  defaultOptions: DefaultOptions;
  cache: InMemoryCache;
  links: ApolloLink[];
}

interface AuthLink extends ApolloLink {
  setContext: (operation: Operation) => Promise<{ headers: Record<string, string> }>;
}

interface ErrorLink extends ApolloLink {
  onError: (errorResponse: ErrorResponse) => void;
}

interface RetryLink extends ApolloLink {
  delay: RetryDelayFunction;
  attempts: RetryAttempts;
}
```

### Authentication System

The authentication system manages JWT tokens with automatic refresh and role-based access control:

```typescript
// lib/auth/types.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

interface TokenManager {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
  refreshTokens(): Promise<TokenPair>;
  isTokenExpired(token: string): boolean;
}

interface RoleGuard {
  canAccessCourse(courseId: string): boolean;
  canEditCourse(courseId: string): boolean;
  canGradeAssignments(): boolean;
  hasRole(role: UserRole): boolean;
}
```

### Data Fetching Hooks

Each backend module has corresponding React hooks with consistent patterns:

```typescript
// hooks/useCourses.ts
interface CourseHooks {
  useCourses: (filters?: CourseFilter) => QueryResult<Course[]>;
  useCourse: (id: string) => QueryResult<Course>;
  useCreateCourse: () => MutationResult<Course>;
  useUpdateCourse: () => MutationResult<Course>;
  usePublishCourse: () => MutationResult<Course>;
  useMyCourses: () => QueryResult<Course[]>;
}

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: ApolloError | undefined;
  refetch: () => Promise<ApolloQueryResult<T>>;
  fetchMore: (options: FetchMoreOptions) => Promise<ApolloQueryResult<T>>;
}

interface MutationResult<T> {
  mutate: (variables: MutationVariables) => Promise<T>;
  loading: boolean;
  error: ApolloError | undefined;
  reset: () => void;
}
```

### Real-time Subscriptions

The subscription system manages WebSocket connections with automatic reconnection:

```typescript
// lib/subscriptions/types.ts
interface SubscriptionManager {
  subscribe<T>(subscription: DocumentNode, variables?: any): Observable<T>;
  unsubscribe(subscriptionId: string): void;
  getConnectionStatus(): ConnectionStatus;
  reconnect(): Promise<void>;
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

interface SubscriptionHooks {
  useMessageSubscription: (userId: string) => SubscriptionResult<Message>;
  useProgressSubscription: (enrollmentId: string) => SubscriptionResult<Progress>;
  usePresenceSubscription: (courseId: string) => SubscriptionResult<Presence[]>;
}
```

### File Upload System

The upload system handles the two-step presigned URL workflow with progress tracking:

```typescript
// lib/uploads/types.ts
interface UploadManager {
  uploadFile(file: File, options: UploadOptions): Promise<UploadResult>;
  uploadVideo(file: File, lessonId: string): Promise<VideoUploadResult>;
  getUploadProgress(uploadId: string): UploadProgress;
  cancelUpload(uploadId: string): void;
}

interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
}

interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: UploadStatus;
}
```

## Data Models

### Core Domain Models

The type system mirrors the backend GraphQL schema with additional frontend-specific utilities:

```typescript
// types/entities.ts
interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

interface Course {
  id: string;
  instructor: User;
  title: string;
  description: string;
  slug: string;
  category: string;
  difficulty: Difficulty;
  price: number;
  currency: string;
  status: CourseStatus;
  modules: CourseModule[];
  enrollmentCount: number;
  averageRating?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Enrollment {
  id: string;
  student: User;
  course: Course;
  enrolledAt: Date;
  completedAt?: Date;
  progressPercentage: number;
  status: EnrollmentStatus;
  certificate?: Certificate;
  lessonProgress: LessonProgress[];
}
```

### Form Input Types

Form types match GraphQL mutation inputs exactly for type safety:

```typescript
// types/forms.ts
interface CreateCourseInput {
  title: string;
  description: string;
  category: string;
  difficulty: Difficulty;
  price?: number;
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

interface UpdateProfileInput {
  fullName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

interface SubmitAssignmentInput {
  assignmentId: string;
  file?: SubmissionFileInput;
  submissionText?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

<function_calls>
<invoke name="prework">
<parameter name="featureName">frontend-foundation
### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

**Authentication Properties**: Properties 1.1, 1.2, 3.1, 3.2, 3.4, and 3.5 all relate to authentication behavior and can be combined into comprehensive authentication properties that cover token injection, refresh, storage, and error handling.

**Error Handling Properties**: Properties 1.3, 4.3, 8.1, 8.2, 8.3, 8.4, and 8.5 all relate to error handling and can be consolidated into properties that verify consistent error formatting and handling across all system components.

**Cache Management Properties**: Properties 1.4, 4.2, 7.1, 7.2, 7.3, 7.4, and 7.5 all relate to cache behavior and can be combined into properties that verify cache consistency, updates, and optimistic behavior.

**Hook Consistency Properties**: Properties 4.1, 4.4, and 4.5 all relate to hook behavior patterns and can be consolidated into properties that verify consistent hook interfaces and cleanup behavior.

**Upload Properties**: Properties 6.1, 6.2, 6.3, 6.4, and 6.5 all relate to file upload behavior and can be combined into comprehensive upload properties.

**Subscription Properties**: Properties 5.1, 5.2, 5.3, 5.4, and 5.5 all relate to real-time subscription behavior and can be consolidated.

**Formatting Properties**: Properties 9.1, 9.2, 9.3, and 9.5 all relate to data formatting and can be combined into formatting consistency properties.

**Security Properties**: Properties 13.1, 13.2, 13.3, 13.4, and 13.5 all relate to security measures and can be consolidated.

### Core Correctness Properties

Property 1: Authentication Token Management
*For any* authenticated user session, when GraphQL requests are made, the system should automatically inject valid JWT tokens and refresh them before expiration without disrupting the user experience
**Validates: Requirements 1.1, 1.2, 3.1, 3.2, 3.4, 3.5**

Property 2: Error Handling Consistency  
*For any* error that occurs in the system, the error should be formatted consistently with user-friendly messages and appropriate retry mechanisms based on error type
**Validates: Requirements 1.3, 4.3, 8.1, 8.2, 8.3, 8.4, 8.5**

Property 3: Cache Consistency and Optimization
*For any* GraphQL operation that modifies data, the cache should be updated consistently with normalized relationships, optimistic updates should be applied immediately, and rollbacks should occur on failure
**Validates: Requirements 1.4, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5**

Property 4: Hook Interface Consistency
*For any* data fetching hook, the return value should have a consistent shape with data, loading, error, and refetch properties, and should clean up properly on component unmount
**Validates: Requirements 4.1, 4.4, 4.5**

Property 5: Network Resilience
*For any* network request that fails, the system should implement exponential backoff retry logic with maximum attempt limits and request deduplication
**Validates: Requirements 1.5, 12.1**

Property 6: Real-time Subscription Management
*For any* WebSocket subscription, the connection should automatically reconnect on failure, update the cache from subscription data, and clean up properly when no longer needed
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

Property 7: File Upload Workflow Integrity
*For any* file upload operation, the system should follow the two-step presigned URL process, track progress accurately, handle failures with retry mechanisms, and validate files before upload
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

Property 8: Type Safety and Validation Consistency
*For any* form input or GraphQL operation, the TypeScript types should match exactly between frontend and backend, and validation should be consistent across both layers
**Validates: Requirements 2.4, 2.5, 9.4**

Property 9: Permission and Role-Based Access Control
*For any* user with a specific role, permission checks should be consistent across all components and should correctly determine access to resources based on role and ownership
**Validates: Requirements 3.3**

Property 10: Data Formatting Consistency
*For any* data that needs formatting (dates, currency, duration, progress), the output should be consistent, localized appropriately, and maintain round-trip accuracy where applicable
**Validates: Requirements 9.1, 9.2, 9.3, 9.5**

Property 11: State Management Synchronization
*For any* complex UI state (course editing, search filters, chat messages, user preferences), the state should sync properly with the GraphQL cache and persist across sessions when appropriate
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

Property 12: Security Implementation Consistency
*For any* security-sensitive operation (token storage, content formatting, file uploads, CSRF handling), the system should implement appropriate security measures to prevent common vulnerabilities
**Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

Property 13: Testing Utility Reliability
*For any* testing utility or mock provider, it should generate valid data that matches GraphQL types and provide consistent behavior for testing components and hooks
**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

Property 14: Performance Optimization Effectiveness
*For any* expensive operation (cache updates, list rendering, subscription management), the system should implement appropriate optimization techniques (memoization, deduplication, lazy loading) to maintain performance
**Validates: Requirements 12.2, 12.4**

Property 15: Authentication Utility Round-trip Consistency
*For any* JWT token generated by the authentication utilities, parsing and validating the token should return the original payload data
**Validates: Requirements 15.1**

Property 16: Cache Operation Consistency
*For any* sequence of cache operations (read, write, update, invalidate), the cache should maintain consistency and return the expected data regardless of operation order
**Validates: Requirements 15.2**

Property 17: Formatting Round-trip Accuracy
*For any* date or currency value, formatting and then parsing should return a value equivalent to the original input
**Validates: Requirements 15.3**

Property 18: Validation Consistency Across Inputs
*For any* input validation rule, applying the same rule to equivalent inputs should produce consistent validation results
**Validates: Requirements 15.4**

Property 19: GraphQL Query Optimization Consistency
*For any* GraphQL query structure, optimization utilities should produce consistent results and maintain query correctness
**Validates: Requirements 15.5**

## Error Handling

### Error Classification and Handling Strategy

The foundation layer implements a comprehensive error handling system that categorizes errors and provides appropriate responses:

#### GraphQL Errors
- **Authentication Errors**: Automatic token refresh or redirect to login
- **Authorization Errors**: Clear messaging about insufficient permissions
- **Validation Errors**: Field-specific error extraction and display
- **Not Found Errors**: Graceful handling with alternative actions
- **Rate Limit Errors**: Automatic retry with exponential backoff

#### Network Errors
- **Connection Errors**: Retry with exponential backoff
- **Timeout Errors**: User notification with retry option
- **Offline Errors**: Queue operations for when connection returns

#### Upload Errors
- **File Validation Errors**: Immediate feedback before upload attempt
- **Upload Failures**: Pause/resume capability with error recovery
- **Processing Errors**: Status monitoring with retry options

### Error Recovery Mechanisms

```typescript
// lib/errors/errorHandlers.ts
interface ErrorRecoveryStrategy {
  canRecover(error: Error): boolean;
  recover(error: Error, context: ErrorContext): Promise<RecoveryResult>;
  getRetryDelay(attemptNumber: number): number;
  getMaxAttempts(): number;
}

interface ErrorContext {
  operation: string;
  variables?: any;
  user?: User;
  requestId: string;
}
```

## Testing Strategy

### Dual Testing Approach

The foundation layer employs both unit testing and property-based testing to ensure comprehensive correctness validation:

#### Unit Testing Strategy
- **Component Integration Tests**: Verify hooks work correctly with React components
- **Error Scenario Tests**: Test specific error conditions and recovery mechanisms
- **Authentication Flow Tests**: Test login, logout, and token refresh scenarios
- **Cache Update Tests**: Verify cache updates work correctly for specific mutations
- **Upload Flow Tests**: Test file upload workflow with various file types

#### Property-Based Testing Strategy

The foundation layer uses **fast-check** as the property-based testing library to verify universal properties across many input variations:

**Configuration Requirements**:
- Each property-based test must run a minimum of 100 iterations
- Tests must be tagged with comments referencing the design document property
- Each correctness property must be implemented by a single property-based test

**Property Test Examples**:

```typescript
// __tests__/auth.property.test.ts
/**
 * Feature: frontend-foundation, Property 15: Authentication Utility Round-trip Consistency
 */
test('JWT token round-trip consistency', () => {
  fc.assert(fc.property(
    fc.record({
      userId: fc.uuid(),
      email: fc.emailAddress(),
      role: fc.constantFrom('student', 'educator', 'admin')
    }),
    (payload) => {
      const token = generateAccessToken(payload.userId, payload.email, payload.role);
      const decoded = verifyToken(token);
      
      expect(decoded.payload.userId).toBe(payload.userId);
      expect(decoded.payload.email).toBe(payload.email);
      expect(decoded.payload.role).toBe(payload.role);
    }
  ), { numRuns: 100 });
});

/**
 * Feature: frontend-foundation, Property 17: Formatting Round-trip Accuracy
 */
test('Date formatting round-trip accuracy', () => {
  fc.assert(fc.property(
    fc.date(),
    fc.constantFrom('UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'),
    (date, timezone) => {
      const formatted = formatDate(date, timezone);
      const parsed = parseFormattedDate(formatted, timezone);
      
      // Should be within 1 second due to formatting precision
      expect(Math.abs(parsed.getTime() - date.getTime())).toBeLessThan(1000);
    }
  ), { numRuns: 100 });
});
```

#### Testing Infrastructure Requirements

**Mock Providers**: Comprehensive mock implementations for all foundation services
**Test Data Factories**: Generators for realistic test data matching GraphQL types  
**Hook Testing Utilities**: Specialized utilities for testing custom React hooks
**Integration Test Helpers**: Utilities for testing component integration with foundation layer

### Performance Testing

**Load Testing**: Verify performance under high concurrent usage
**Memory Leak Testing**: Ensure proper cleanup of subscriptions and event listeners
**Cache Performance Testing**: Verify cache efficiency with large datasets
**Bundle Size Monitoring**: Track foundation layer impact on application bundle size

## Implementation Architecture

### Module Organization

```
src/
├── lib/
│   ├── graphql/          # Apollo Client configuration
│   │   ├── client.ts     # Main Apollo Client setup
│   │   ├── links.ts      # Authentication, error, retry links
│   │   ├── cache.ts      # Cache configuration and policies
│   │   └── fragments.ts  # Reusable GraphQL fragments
│   ├── auth/             # Authentication infrastructure
│   │   ├── authProvider.tsx    # React Context provider
│   │   ├── authHelpers.ts      # Token management utilities
│   │   ├── authHooks.ts        # Authentication hooks
│   │   ├── tokenStorage.ts     # Secure token storage
│   │   └── authGuards.ts       # Permission checking utilities
│   ├── uploads/          # File upload utilities
│   │   ├── uploadHelpers.ts    # Presigned URL workflow
│   │   ├── uploadHooks.ts      # Upload React hooks
│   │   ├── uploadTypes.ts      # Upload-related types
│   │   └── uploadQueue.ts      # Upload queue management
│   ├── subscriptions/    # Real-time subscriptions
│   │   ├── subscriptionProvider.tsx  # WebSocket management
│   │   ├── subscriptionHooks.ts      # Subscription hooks
│   │   └── subscriptionHelpers.ts    # Connection utilities
│   ├── cache/            # Cache management utilities
│   │   ├── cacheHelpers.ts      # Cache read/write utilities
│   │   ├── cacheUpdaters.ts     # Mutation cache updates
│   │   └── cacheInvalidation.ts # Cache invalidation strategies
│   ├── errors/           # Error handling system
│   │   ├── errorTypes.ts        # Error type definitions
│   │   ├── errorHandlers.ts     # Error handling logic
│   │   ├── errorHooks.ts        # Error handling hooks
│   │   └── errorMessages.ts     # User-friendly messages
│   ├── utils/            # General utilities
│   │   ├── formatters.ts        # Data formatting utilities
│   │   ├── validators.ts        # Input validation
│   │   ├── constants.ts         # Application constants
│   │   └── helpers.ts           # Common helper functions
│   └── state/            # State management patterns
│       ├── courseState.ts       # Course editor state
│       ├── enrollmentState.ts   # Enrollment progress state
│       ├── searchState.ts       # Search filters state
│       └── chatState.ts         # Chat/messaging state
├── hooks/                # Domain-specific React hooks
│   ├── useUsers.ts       # User management hooks
│   ├── useCourses.ts     # Course operations hooks
│   ├── useEnrollments.ts # Enrollment tracking hooks
│   ├── useContent.ts     # Content management hooks
│   ├── useAssessments.ts # Quiz/assignment hooks
│   ├── useCommunication.ts # Messaging/discussion hooks
│   ├── useNotifications.ts # Notification hooks
│   ├── usePayments.ts    # Payment processing hooks
│   ├── useSearch.ts      # Search functionality hooks
│   ├── useAnalytics.ts   # Analytics data hooks
│   └── useAdmin.ts       # Admin operations hooks
├── types/                # TypeScript type definitions
│   ├── schema.ts         # Generated GraphQL types
│   ├── api.ts            # API-related types
│   ├── entities.ts       # Domain model types
│   ├── enums.ts          # Enumeration types
│   └── forms.ts          # Form input types
└── providers/            # React Context providers
    ├── AuthProvider.tsx  # Authentication context
    ├── GraphQLProvider.tsx # GraphQL client context
    └── SubscriptionProvider.tsx # Subscription context
```

### Integration Points with Backend

The foundation layer maps directly to the backend's 11 core modules:

1. **Users Module**: Authentication, profile management, role-based access
2. **Courses Module**: Course CRUD operations, module/lesson management
3. **Content Module**: File uploads, video processing, streaming URLs
4. **Assessments Module**: Quiz/assignment creation, submission, grading
5. **Enrollments Module**: Course enrollment, progress tracking, certificates
6. **Communication Module**: Messaging, discussions, announcements
7. **Notifications Module**: Real-time notifications, preferences
8. **Payments Module**: Stripe integration, course purchases
9. **Search Module**: Elasticsearch integration, faceted search
10. **Analytics Module**: Progress analytics, course statistics
11. **Admin Module**: Platform administration, user management

### Security Considerations

**Token Security**: Secure storage using httpOnly cookies in production
**XSS Prevention**: Content sanitization in all formatting utilities
**CSRF Protection**: Integration with backend CSRF token system
**File Upload Security**: Client-side validation with server-side verification
**Rate Limiting**: Client-side helpers for handling rate limit responses

### Performance Optimizations

**Request Deduplication**: Prevent duplicate GraphQL requests
**Intelligent Caching**: Normalized cache with efficient updates
**Code Splitting**: Lazy loading for subscription and upload modules
**Memoization**: Expensive computation caching in formatting utilities
**Bundle Optimization**: Tree-shaking friendly module exports

This foundation layer design provides a robust, type-safe, and performant infrastructure that enables rapid development of sophisticated learning platform features while maintaining excellent developer experience and application performance.