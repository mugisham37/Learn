/**
 * Endpoint-Specific Validation Schemas
 *
 * Validation schemas for common API endpoints across different modules.
 * These schemas demonstrate how to use the validation middleware.
 *
 * Requirements: 13.1
 */

import { z } from 'zod';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  paginationSchema,
  searchSchema,
  roleSchema,
  difficultySchema,
  lessonTypeSchema,
  questionTypeSchema,
  gradingStatusSchema,
  enrollmentStatusSchema,
  progressStatusSchema,
  paymentStatusSchema,
  notificationTypeSchema,
  prioritySchema,
  idParamSchema,
  slugParamSchema,
  metadataSchema,
  timezoneSchema,
  languageSchema,
  currencySchema,
  priceSchema,
  phoneSchema,
  socialMediaSchema,
  addressSchema,
  durationSchema,
  ratingSchema,
  tagsSchema,
} from './common.js';

// ============================================================================
// Authentication & User Management Schemas
// ============================================================================

/**
 * User registration schema
 */
export const registerUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(1, 'Full name is required').max(255, 'Full name too long'),
  role: roleSchema,
  timezone: timezoneSchema.default('UTC'),
  language: languageSchema.default('en'),
});

/**
 * User login schema
 */
export const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Update user profile schema
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255, 'Full name too long').optional(),
  bio: z.string().max(1000, 'Bio too long').optional(),
  timezone: timezoneSchema.optional(),
  language: languageSchema.optional(),
  phone: phoneSchema,
  socialMedia: socialMediaSchema.optional(),
  notificationPreferences: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

// ============================================================================
// Course Management Schemas
// ============================================================================

/**
 * Create course schema
 */
export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
  category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
  difficulty: difficultySchema,
  price: priceSchema.optional(),
  tags: tagsSchema.optional(),
  isPublic: z.boolean().default(true),
  enrollmentLimit: z.number().int().positive().optional(),
});

/**
 * Update course schema
 */
export const updateCourseSchema = createCourseSchema.partial();

/**
 * Create course module schema
 */
export const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  orderNumber: z.number().int().positive('Order number must be positive'),
  prerequisiteModuleId: uuidSchema.optional(),
});

/**
 * Create lesson schema
 */
export const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  type: lessonTypeSchema,
  contentUrl: z.string().url().optional(),
  contentText: z.string().max(50000, 'Content too long').optional(),
  duration: durationSchema.optional(),
  orderNumber: z.number().int().positive('Order number must be positive'),
  isPreview: z.boolean().default(false),
  metadata: metadataSchema,
});

/**
 * Reorder modules schema
 */
export const reorderModulesSchema = z.object({
  moduleIds: z.array(uuidSchema).min(1, 'At least one module ID is required'),
});

/**
 * Course search schema
 */
export const courseSearchSchema = searchSchema.extend({
  instructorId: uuidSchema.optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Assessment Schemas
// ============================================================================

/**
 * Create quiz schema
 */
export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  passingScore: z.number().int().min(0).max(100, 'Passing score must be 0-100'),
  maxAttempts: z.number().int().positive().default(3),
  randomizeQuestions: z.boolean().default(false),
  randomizeOptions: z.boolean().default(false),
});

/**
 * Create question schema
 */
export const createQuestionSchema = z.object({
  type: questionTypeSchema,
  questionText: z.string().min(1, 'Question text is required').max(2000, 'Question text too long'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  explanation: z.string().max(1000, 'Explanation too long').optional(),
  points: z.number().int().positive().default(1),
  orderNumber: z.number().int().positive(),
});

/**
 * Submit quiz answer schema
 */
export const submitAnswerSchema = z.object({
  questionId: uuidSchema,
  answer: z.union([z.string(), z.array(z.string()), z.number()]),
});

/**
 * Grade quiz submission schema
 */
export const gradeSubmissionSchema = z.object({
  pointsAwarded: z.number().min(0),
  feedback: z.string().max(2000, 'Feedback too long').optional(),
});

/**
 * Create assignment schema
 */
export const createAssignmentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
  instructions: z.string().min(1, 'Instructions are required').max(10000, 'Instructions too long'),
  dueDate: z.string().datetime('Invalid due date format'),
  maxPoints: z.number().int().positive().default(100),
  allowedFileTypes: z.array(z.string()).min(1, 'At least one file type must be allowed'),
  maxFileSize: z.number().int().positive(),
  lateSubmissionAllowed: z.boolean().default(true),
  latePenaltyPercentage: z.number().min(0).max(100).default(10),
  rubric: metadataSchema,
});

/**
 * Submit assignment schema
 */
export const submitAssignmentSchema = z.object({
  submissionText: z.string().max(10000, 'Submission text too long').optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().max(255, 'File name too long').optional(),
});

// ============================================================================
// Enrollment & Progress Schemas
// ============================================================================

/**
 * Enroll in course schema
 */
export const enrollCourseSchema = z.object({
  courseId: uuidSchema,
  paymentMethodId: z.string().optional(), // Stripe payment method ID
});

/**
 * Update lesson progress schema
 */
export const updateProgressSchema = z.object({
  status: progressStatusSchema,
  timeSpentSeconds: z.number().int().min(0),
  quizScore: z.number().int().min(0).max(100).optional(),
});

/**
 * Withdraw enrollment schema
 */
export const withdrawEnrollmentSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

// ============================================================================
// Communication Schemas
// ============================================================================

/**
 * Send message schema
 */
export const sendMessageSchema = z.object({
  recipientId: uuidSchema,
  subject: z.string().max(255, 'Subject too long').optional(),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  attachments: z.array(z.string().url()).max(5, 'Too many attachments').optional(),
});

/**
 * Create discussion thread schema
 */
export const createThreadSchema = z.object({
  courseId: uuidSchema,
  category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
});

/**
 * Reply to thread schema
 */
export const replyThreadSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  parentPostId: uuidSchema.optional(),
});

/**
 * Create announcement schema
 */
export const createAnnouncementSchema = z.object({
  courseId: uuidSchema,
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  scheduledFor: z.string().datetime().optional(),
});

// ============================================================================
// Notification Schemas
// ============================================================================

/**
 * Update notification preferences schema
 */
export const updateNotificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  inApp: z.boolean().default(true),
  digest: z.boolean().default(false),
  types: z.record(notificationTypeSchema, z.boolean()).optional(),
});

/**
 * Mark notification read schema
 */
export const markNotificationReadSchema = z.object({
  notificationIds: z.array(uuidSchema).min(1, 'At least one notification ID is required'),
});

// ============================================================================
// Payment Schemas
// ============================================================================

/**
 * Create checkout session schema
 */
export const createCheckoutSchema = z.object({
  courseId: uuidSchema,
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  couponCode: z.string().max(50, 'Coupon code too long').optional(),
});

/**
 * Request refund schema
 */
export const requestRefundSchema = z.object({
  enrollmentId: uuidSchema,
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});

/**
 * Create subscription schema
 */
export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

// ============================================================================
// Analytics Schemas
// ============================================================================

/**
 * Analytics date range schema
 */
export const analyticsDateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

/**
 * Track event schema
 */
export const trackEventSchema = z.object({
  eventType: z.string().min(1, 'Event type is required').max(100, 'Event type too long'),
  eventData: metadataSchema,
  timestamp: z.string().datetime().optional(),
});

// ============================================================================
// File Upload Schemas
// ============================================================================

/**
 * Generate upload URL schema
 */
export const generateUploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  uploadType: z.enum(['avatar', 'course_resource', 'assignment_submission', 'video']),
});

/**
 * File upload completion schema
 */
export const uploadCompleteSchema = z.object({
  fileKey: z.string().min(1, 'File key is required'),
  originalName: z.string().min(1, 'Original name is required'),
  size: z.number().int().positive(),
  mimeType: z.string().min(1, 'MIME type is required'),
});

// ============================================================================
// Common Parameter Schemas
// ============================================================================

/**
 * Common query parameter schemas
 */
export const commonQuerySchemas = {
  pagination: paginationSchema,
  search: searchSchema,
  courseSearch: courseSearchSchema,
  dateRange: analyticsDateRangeSchema,
};

/**
 * Common parameter schemas
 */
export const commonParamSchemas = {
  id: idParamSchema,
  slug: slugParamSchema,
  courseId: z.object({ courseId: uuidSchema }),
  userId: z.object({ userId: uuidSchema }),
  enrollmentId: z.object({ enrollmentId: uuidSchema }),
  lessonId: z.object({ lessonId: uuidSchema }),
  quizId: z.object({ quizId: uuidSchema }),
  assignmentId: z.object({ assignmentId: uuidSchema }),
  submissionId: z.object({ submissionId: uuidSchema }),
  threadId: z.object({ threadId: uuidSchema }),
  postId: z.object({ postId: uuidSchema }),
  notificationId: z.object({ notificationId: uuidSchema }),
};

/**
 * Common body schemas
 */
export const commonBodySchemas = {
  register: registerUserSchema,
  login: loginUserSchema,
  updateProfile: updateProfileSchema,
  changePassword: changePasswordSchema,
  resetPassword: resetPasswordSchema,
  createCourse: createCourseSchema,
  updateCourse: updateCourseSchema,
  createModule: createModuleSchema,
  createLesson: createLessonSchema,
  createQuiz: createQuizSchema,
  createQuestion: createQuestionSchema,
  createAssignment: createAssignmentSchema,
  enrollCourse: enrollCourseSchema,
  updateProgress: updateProgressSchema,
  sendMessage: sendMessageSchema,
  createThread: createThreadSchema,
  replyThread: replyThreadSchema,
  createAnnouncement: createAnnouncementSchema,
  updateNotificationPreferences: updateNotificationPreferencesSchema,
  createCheckout: createCheckoutSchema,
  requestRefund: requestRefundSchema,
  trackEvent: trackEventSchema,
  generateUploadUrl: generateUploadUrlSchema,
};
