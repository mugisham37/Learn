/**
 * Runtime Type Validation
 * 
 * Provides runtime validation for GraphQL responses, type validation utilities using Zod,
 * type checking for critical operations, and development-time type validation warnings.
 * 
 * Requirements: 8.4 - Runtime type validation for GraphQL responses
 */

import { z } from 'zod';
import type {
  User,
  UserRole,
  Course,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonType,
  Quiz,
  Assignment,
  Message,
  Connection,
  Edge,
  PageInfo,
  VideoProcessingStatus,
  PresignedUploadUrl,
  StreamingUrl
} from '@/types/entities';

// =============================================================================
// Zod Schema Definitions
// =============================================================================

/**
 * User role schema
 */
export const UserRoleSchema = z.enum(['STUDENT', 'EDUCATOR', 'ADMIN']);

/**
 * Course status schema
 */
export const CourseStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

/**
 * Enrollment status schema
 */
export const EnrollmentStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'DROPPED', 'SUSPENDED']);

/**
 * Lesson type schema
 */
export const LessonTypeSchema = z.enum(['VIDEO', 'TEXT', 'QUIZ', 'ASSIGNMENT', 'INTERACTIVE']);

/**
 * Difficulty schema
 */
export const DifficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

/**
 * Question type schema
 */
export const QuestionTypeSchema = z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']);

/**
 * Quiz attempt status schema
 */
export const QuizAttemptStatusSchema = z.enum(['IN_PROGRESS', 'SUBMITTED', 'GRADED']);

/**
 * Assignment submission status schema
 */
export const AssignmentSubmissionStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'GRADED', 'RETURNED']);

/**
 * Base entity schema with common fields
 */
export const BaseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

/**
 * User profile schema
 */
export const UserProfileSchema = z.object({
  fullName: z.string(),
  bio: z.string().optional(),
  timezone: z.string(),
  language: z.string(),
  avatarUrl: z.string().url().optional()
});

/**
 * Notification preferences schema
 */
export const NotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  courseUpdates: z.boolean(),
  messageNotifications: z.boolean(),
  assignmentReminders: z.boolean()
});

/**
 * User schema
 */
export const UserSchema = BaseEntitySchema.extend({
  email: z.string().email(),
  role: UserRoleSchema,
  emailVerified: z.boolean(),
  profile: UserProfileSchema,
  notificationPreferences: NotificationPreferencesSchema
});

/**
 * Course module schema (forward reference)
 */
export const CourseModuleSchema: z.ZodType<any> = z.lazy(() => 
  BaseEntitySchema.extend({
    title: z.string(),
    description: z.string(),
    orderIndex: z.number().int().min(0),
    lessons: z.array(LessonSchema).optional()
  })
);

/**
 * Course review schema
 */
export const CourseReviewSchema = BaseEntitySchema.extend({
  rating: z.number().min(1).max(5),
  comment: z.string().optional()
});

/**
 * Course schema
 */
export const CourseSchema = BaseEntitySchema.extend({
  instructor: UserSchema,
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  slug: z.string(),
  category: z.string(),
  difficulty: DifficultySchema,
  price: z.number().min(0),
  currency: z.string().length(3),
  status: CourseStatusSchema,
  thumbnailUrl: z.string().url().optional(),
  modules: z.array(CourseModuleSchema).optional(),
  enrollmentCount: z.number().int().min(0),
  averageRating: z.number().min(0).max(5).optional(),
  reviews: z.array(CourseReviewSchema).optional()
});

/**
 * Question schema
 */
export const QuestionSchema = BaseEntitySchema.extend({
  type: QuestionTypeSchema,
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  points: z.number().min(0),
  orderIndex: z.number().int().min(0)
});

/**
 * Quiz schema
 */
export const QuizSchema = BaseEntitySchema.extend({
  title: z.string().min(1).max(100),
  description: z.string(),
  timeLimit: z.number().int().min(1).optional(),
  maxAttempts: z.number().int().min(1).max(10),
  passingScore: z.number().min(0).max(100),
  questions: z.array(QuestionSchema).optional()
});

/**
 * Assignment schema
 */
export const AssignmentSchema = BaseEntitySchema.extend({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  instructions: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  maxPoints: z.number().min(1),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().int().min(1).optional()
});

/**
 * Lesson schema
 */
export const LessonSchema = BaseEntitySchema.extend({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  type: LessonTypeSchema,
  content: z.string().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().int().min(1).optional(),
  orderIndex: z.number().int().min(0),
  quiz: QuizSchema.optional(),
  assignment: AssignmentSchema.optional()
});

/**
 * Lesson progress schema
 */
export const LessonProgressSchema = BaseEntitySchema.extend({
  lesson: LessonSchema,
  completedAt: z.string().datetime().optional(),
  timeSpent: z.number().int().min(0),
  isCompleted: z.boolean(),
  lastAccessedAt: z.string().datetime()
});

/**
 * Certificate schema
 */
export const CertificateSchema = BaseEntitySchema.extend({
  issuedAt: z.string().datetime(),
  certificateUrl: z.string().url()
});

/**
 * Enrollment schema
 */
export const EnrollmentSchema = BaseEntitySchema.extend({
  student: UserSchema,
  course: CourseSchema,
  enrolledAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  progressPercentage: z.number().min(0).max(100),
  status: EnrollmentStatusSchema,
  certificate: CertificateSchema.optional(),
  lessonProgress: z.array(LessonProgressSchema).optional()
});

/**
 * Message attachment schema
 */
export const MessageAttachmentSchema = BaseEntitySchema.extend({
  fileName: z.string(),
  fileSize: z.number().int().min(0),
  fileUrl: z.string().url()
});

/**
 * Message read schema
 */
export const MessageReadSchema = BaseEntitySchema.extend({
  user: UserSchema,
  readAt: z.string().datetime()
});

/**
 * Message schema
 */
export const MessageSchema = BaseEntitySchema.extend({
  sender: UserSchema,
  content: z.string().min(1),
  attachments: z.array(MessageAttachmentSchema).optional(),
  readBy: z.array(MessageReadSchema).optional(),
  sentAt: z.string().datetime()
});

/**
 * Conversation schema
 */
export const ConversationSchema = BaseEntitySchema.extend({
  participants: z.array(UserSchema),
  lastMessage: MessageSchema.optional(),
  unreadCount: z.number().int().min(0)
});

/**
 * Page info schema for GraphQL connections
 */
export const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().optional(),
  endCursor: z.string().optional()
});

/**
 * Edge schema for GraphQL connections
 */
export const EdgeSchema = <T>(nodeSchema: z.ZodType<T>) => z.object({
  node: nodeSchema,
  cursor: z.string()
});

/**
 * Connection schema for GraphQL connections
 */
export const ConnectionSchema = <T>(nodeSchema: z.ZodType<T>) => z.object({
  edges: z.array(EdgeSchema(nodeSchema)),
  pageInfo: PageInfoSchema,
  totalCount: z.number().int().min(0)
});

/**
 * Video processing status schema
 */
export const VideoProcessingStatusSchema = z.object({
  fileKey: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  outputFormats: z.array(z.object({
    quality: z.string(),
    url: z.string().url(),
    fileSize: z.number().int().min(0)
  })),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().int().min(0).optional(),
  error: z.string().optional(),
  updatedAt: z.string().datetime()
});

/**
 * Presigned upload URL schema
 */
export const PresignedUploadUrlSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  fields: z.record(z.string()),
  expiresAt: z.string().datetime()
});

/**
 * Streaming URL schema
 */
export const StreamingUrlSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  quality: z.string()
});

// =============================================================================
// Runtime Validation Functions
// =============================================================================

/**
 * Validate GraphQL response data
 */
export function validateGraphQLResponse<T>(
  data: unknown,
  schema: z.ZodType<T>,
  operationName?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `GraphQL response validation failed${operationName ? ` for ${operationName}` : ''}`;
      console.error(errorMessage, {
        errors: error.errors,
        data
      });
      
      // In development, throw detailed error
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`${errorMessage}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      
      // In production, throw generic error
      throw new Error('Invalid response data received from server');
    }
    
    throw error;
  }
}

/**
 * Safely validate GraphQL response with fallback
 */
export function safeValidateGraphQLResponse<T>(
  data: unknown,
  schema: z.ZodType<T>,
  fallback: T,
  operationName?: string
): T {
  try {
    return validateGraphQLResponse(data, schema, operationName);
  } catch (error) {
    console.warn(`GraphQL response validation failed${operationName ? ` for ${operationName}` : ''}, using fallback`, error);
    return fallback;
  }
}

/**
 * Validate user data
 */
export function validateUser(data: unknown): User {
  return validateGraphQLResponse(data, UserSchema, 'User');
}

/**
 * Validate course data
 */
export function validateCourse(data: unknown): Course {
  return validateGraphQLResponse(data, CourseSchema, 'Course');
}

/**
 * Validate enrollment data
 */
export function validateEnrollment(data: unknown): Enrollment {
  return validateGraphQLResponse(data, EnrollmentSchema, 'Enrollment');
}

/**
 * Validate lesson data
 */
export function validateLesson(data: unknown): Lesson {
  return validateGraphQLResponse(data, LessonSchema, 'Lesson');
}

/**
 * Validate message data
 */
export function validateMessage(data: unknown): Message {
  return validateGraphQLResponse(data, MessageSchema, 'Message');
}

/**
 * Validate connection data
 */
export function validateConnection<T>(
  data: unknown,
  nodeSchema: z.ZodType<T>,
  operationName?: string
): Connection<T> {
  return validateGraphQLResponse(data, ConnectionSchema(nodeSchema), operationName);
}

/**
 * Validate video processing status
 */
export function validateVideoProcessingStatus(data: unknown): VideoProcessingStatus {
  return validateGraphQLResponse(data, VideoProcessingStatusSchema, 'VideoProcessingStatus');
}

/**
 * Validate presigned upload URL
 */
export function validatePresignedUploadUrl(data: unknown): PresignedUploadUrl {
  return validateGraphQLResponse(data, PresignedUploadUrlSchema, 'PresignedUploadUrl');
}

/**
 * Validate streaming URL
 */
export function validateStreamingUrl(data: unknown): StreamingUrl {
  return validateGraphQLResponse(data, StreamingUrlSchema, 'StreamingUrl');
}

// =============================================================================
// Type Checking for Critical Operations
// =============================================================================

/**
 * Validate critical authentication data
 */
export function validateAuthenticationData(data: unknown): {
  user: User;
  accessToken: string;
  refreshToken: string;
} {
  const schema = z.object({
    user: UserSchema,
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1)
  });
  
  return validateGraphQLResponse(data, schema, 'Authentication');
}

/**
 * Validate critical enrollment data
 */
export function validateEnrollmentCreation(data: unknown): {
  enrollment: Enrollment;
  paymentRequired: boolean;
  paymentUrl?: string;
} {
  const schema = z.object({
    enrollment: EnrollmentSchema,
    paymentRequired: z.boolean(),
    paymentUrl: z.string().url().optional()
  });
  
  return validateGraphQLResponse(data, schema, 'EnrollmentCreation');
}

/**
 * Validate critical file upload data
 */
export function validateFileUploadResponse(data: unknown): {
  presignedUrl: PresignedUploadUrl;
  fileKey: string;
} {
  const schema = z.object({
    presignedUrl: PresignedUploadUrlSchema,
    fileKey: z.string()
  });
  
  return validateGraphQLResponse(data, schema, 'FileUpload');
}

/**
 * Validate critical quiz submission data
 */
export function validateQuizSubmission(data: unknown): {
  score: number;
  maxScore: number;
  passed: boolean;
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    points: number;
  }>;
} {
  const schema = z.object({
    score: z.number().min(0),
    maxScore: z.number().min(0),
    passed: z.boolean(),
    answers: z.array(z.object({
      questionId: z.string(),
      isCorrect: z.boolean(),
      points: z.number().min(0)
    }))
  });
  
  return validateGraphQLResponse(data, schema, 'QuizSubmission');
}

// =============================================================================
// Development-Time Type Validation Warnings
// =============================================================================

/**
 * Development-only type validation warning
 */
export function devTypeWarning(message: string, data?: any): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[Type Validation Warning] ${message}`, data);
  }
}

/**
 * Validate and warn about potentially unsafe data
 */
export function validateWithWarning<T>(
  data: unknown,
  schema: z.ZodType<T>,
  operationName: string,
  warnOnly = false
): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = `Type validation failed for ${operationName}`;
      const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      
      if (warnOnly) {
        devTypeWarning(`${message}: ${details}`, data);
        return null;
      } else {
        throw new Error(`${message}: ${details}`);
      }
    }
    
    throw error;
  }
}

/**
 * Check for missing required fields in development
 */
export function checkRequiredFields<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[],
  objectName = 'object'
): void {
  if (process.env.NODE_ENV === 'development') {
    const missingFields = requiredFields.filter(field => obj[field] == null);
    if (missingFields.length > 0) {
      devTypeWarning(
        `${objectName} is missing required fields: ${missingFields.join(', ')}`,
        obj
      );
    }
  }
}

/**
 * Check for deprecated fields in development
 */
export function checkDeprecatedFields<T extends Record<string, any>>(
  obj: T,
  deprecatedFields: (keyof T)[],
  objectName = 'object'
): void {
  if (process.env.NODE_ENV === 'development') {
    const presentDeprecatedFields = deprecatedFields.filter(field => obj[field] != null);
    if (presentDeprecatedFields.length > 0) {
      devTypeWarning(
        `${objectName} contains deprecated fields: ${presentDeprecatedFields.join(', ')}`,
        obj
      );
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a partial schema from a full schema
 */
export function createPartialSchema<T>(schema: z.ZodType<T>): z.ZodType<Partial<T>> {
  if (schema instanceof z.ZodObject) {
    return schema.partial();
  }
  
  // For non-object schemas, return optional version
  return schema.optional() as any;
}

/**
 * Create an array schema from an item schema
 */
export function createArraySchema<T>(itemSchema: z.ZodType<T>): z.ZodType<T[]> {
  return z.array(itemSchema);
}

/**
 * Create a nullable schema
 */
export function createNullableSchema<T>(schema: z.ZodType<T>): z.ZodType<T | null> {
  return schema.nullable();
}

/**
 * Create an optional schema
 */
export function createOptionalSchema<T>(schema: z.ZodType<T>): z.ZodType<T | undefined> {
  return schema.optional();
}

/**
 * Combine multiple schemas with union
 */
export function createUnionSchema<T extends readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
  schemas: T
): z.ZodUnion<T> {
  return z.union(schemas);
}

/**
 * Create a discriminated union schema
 */
export function createDiscriminatedUnionSchema<
  Discriminator extends string,
  Options extends Record<string, z.ZodTypeAny>
>(
  discriminator: Discriminator,
  options: Options
): z.ZodDiscriminatedUnion<Discriminator, z.Primitive[]> {
  const optionsList = Object.entries(options).map(([key, schema]) => 
    schema.extend({ [discriminator]: z.literal(key) })
  );
  
  return z.discriminatedUnion(discriminator, optionsList as any);
}