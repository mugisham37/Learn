/**
 * Common Validation Schemas
 * 
 * Reusable Zod schemas for common validation patterns across the application.
 * These schemas ensure consistency and reduce duplication.
 * 
 * Requirements: 13.1
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email exceeds maximum length of 254 characters')
  .transform((email) => email.toLowerCase().trim());

/**
 * Password validation schema
 * Requirements: minimum 8 characters, uppercase, lowercase, number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL exceeds maximum length');

/**
 * Positive integer schema
 */
export const positiveIntSchema = z
  .number()
  .int('Must be an integer')
  .positive('Must be a positive number');

/**
 * Non-negative integer schema
 */
export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must be at most 100');

/**
 * Pagination parameters schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'Page must be at least 1'))
    .default(1),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100'))
    .default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Search parameters schema
 */
export const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200, 'Search query too long'),
  category: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  minRating: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .pipe(z.number().min(0).max(5).optional()),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .pipe(z.number().min(0).optional()),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
});

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
  mimetype: z.string().min(1, 'MIME type is required'),
  size: z.number().int().positive('File size must be positive'),
});

/**
 * Role validation schema
 */
export const roleSchema = z.enum(['student', 'educator', 'admin']);

/**
 * Course difficulty schema
 */
export const difficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

/**
 * Lesson type schema
 */
export const lessonTypeSchema = z.enum(['video', 'text', 'quiz', 'assignment']);

/**
 * Question type schema
 */
export const questionTypeSchema = z.enum([
  'multiple_choice',
  'true_false',
  'short_answer',
  'essay',
  'fill_blank',
  'matching',
]);

/**
 * Grading status schema
 */
export const gradingStatusSchema = z.enum([
  'auto_graded',
  'pending_review',
  'graded',
  'revision_requested',
]);

/**
 * Enrollment status schema
 */
export const enrollmentStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'withdrawn',
  'expired',
]);

/**
 * Progress status schema
 */
export const progressStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);

/**
 * Payment status schema
 */
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'canceled',
  'refunded',
]);

/**
 * Notification type schema
 */
export const notificationTypeSchema = z.enum([
  'course_enrollment',
  'assignment_graded',
  'quiz_graded',
  'certificate_issued',
  'payment_received',
  'course_published',
  'discussion_reply',
  'announcement',
  'system_maintenance',
]);

/**
 * Priority schema
 */
export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Common request headers schema
 */
export const commonHeadersSchema = z.object({
  'content-type': z.string().optional(),
  'user-agent': z.string().optional(),
  'x-request-id': z.string().optional(),
  authorization: z.string().optional(),
});

/**
 * ID parameter schema (for route parameters)
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Slug parameter schema
 */
export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug too long'),
});

/**
 * Bulk operation schema
 */
export const bulkOperationSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID is required').max(100, 'Too many IDs'),
  action: z.string().min(1, 'Action is required'),
});

/**
 * Metadata schema for flexible JSON data
 */
export const metadataSchema = z.record(z.string(), z.any()).optional();

/**
 * Timezone schema
 */
export const timezoneSchema = z.string().min(1, 'Timezone is required').max(50, 'Timezone too long');

/**
 * Language code schema (ISO 639-1)
 */
export const languageSchema = z
  .string()
  .length(2, 'Language code must be 2 characters')
  .regex(/^[a-z]{2}$/, 'Invalid language code format');

/**
 * Currency code schema (ISO 4217)
 */
export const currencySchema = z
  .string()
  .length(3, 'Currency code must be 3 characters')
  .regex(/^[A-Z]{3}$/, 'Invalid currency code format');

/**
 * Price schema with currency
 */
export const priceSchema = z.object({
  amount: z.number().min(0, 'Amount must be non-negative'),
  currency: currencySchema.default('USD'),
});

/**
 * Coordinates schema for location data
 */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Phone number schema (basic validation)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

/**
 * Color hex code schema
 */
export const colorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format')
  .optional();

/**
 * Social media URL schemas
 */
export const socialMediaSchema = z.object({
  twitter: urlSchema.optional(),
  linkedin: urlSchema.optional(),
  github: urlSchema.optional(),
  website: urlSchema.optional(),
});

/**
 * Address schema
 */
export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(200, 'Street too long'),
  city: z.string().min(1, 'City is required').max(100, 'City too long'),
  state: z.string().min(1, 'State is required').max(100, 'State too long'),
  postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code too long'),
  country: z.string().min(1, 'Country is required').max(100, 'Country too long'),
});

/**
 * Duration schema (in seconds)
 */
export const durationSchema = z.number().int().min(0, 'Duration must be non-negative');

/**
 * Rating schema (1-5 stars)
 */
export const ratingSchema = z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5');

/**
 * Tag schema
 */
export const tagSchema = z
  .string()
  .min(1, 'Tag cannot be empty')
  .max(50, 'Tag too long')
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Tag can only contain letters, numbers, hyphens, and underscores');

/**
 * Tags array schema
 */
export const tagsSchema = z.array(tagSchema).max(10, 'Too many tags');