/**
 * Validation Utilities
 *
 * Provides validation functions for email, password strength, file types,
 * URLs, and JSON Schema validation helpers.
 *
 * Requirements: 1.1, 1.3, 13.1
 */

import { z, ZodSchema } from 'zod';

/**
 * Email validation result
 */
export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * URL validation result
 */
export interface URLValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

/**
 * Standard email regex pattern
 * Validates format: local-part@domain.tld
 * Requires at least one dot in domain part
 *
 * Requirements: 1.1
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates email format using standard regex patterns
 *
 * @param email - Email address to validate
 * @returns Validation result with valid flag and optional error message
 *
 * Requirements: 1.1
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email is required and must be a string',
    };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return {
      valid: false,
      error: 'Email cannot be empty',
    };
  }

  if (trimmedEmail.length > 254) {
    return {
      valid: false,
      error: 'Email exceeds maximum length of 254 characters',
    };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validates password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 *
 * @param password - Password to validate
 * @returns Validation result with valid flag, errors array, and strength rating
 *
 * Requirements: 1.3
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required and must be a string'],
      strength: 'weak',
    };
  }

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Calculate strength
  if (errors.length === 0) {
    // Check for additional strength indicators
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    const isLongEnough = password.length >= 12;

    if (hasSpecialChar && isLongEnough) {
      strength = 'strong';
    } else if (hasSpecialChar || isLongEnough) {
      strength = 'medium';
    } else {
      strength = 'medium';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Allowed file types for different contexts
 */
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
  code: [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
  ],
} as const;

/**
 * Maximum file sizes in bytes for different contexts
 */
export const MAX_FILE_SIZES = {
  avatar: 5 * 1024 * 1024, // 5 MB
  document: 10 * 1024 * 1024, // 10 MB
  video: 500 * 1024 * 1024, // 500 MB
  assignment: 25 * 1024 * 1024, // 25 MB
} as const;

/**
 * Validates file type against allowed types
 *
 * @param mimeType - MIME type of the file
 * @param allowedTypes - Array of allowed MIME types
 * @returns Validation result with valid flag and errors array
 *
 * Requirements: 13.1
 */
export function validateFileType(
  mimeType: string,
  allowedTypes: readonly string[]
): FileValidationResult {
  const errors: string[] = [];

  if (!mimeType || typeof mimeType !== 'string') {
    errors.push('File type is required and must be a string');
    return { valid: false, errors };
  }

  const normalizedMimeType = mimeType.toLowerCase().trim();

  if (!allowedTypes.includes(normalizedMimeType)) {
    errors.push(
      `File type '${mimeType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates file size against maximum allowed size
 *
 * @param fileSizeBytes - Size of the file in bytes
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Validation result with valid flag and errors array
 *
 * Requirements: 13.1
 */
export function validateFileSize(
  fileSizeBytes: number,
  maxSizeBytes: number
): FileValidationResult {
  const errors: string[] = [];

  if (typeof fileSizeBytes !== 'number' || isNaN(fileSizeBytes) || fileSizeBytes < 0) {
    errors.push('File size must be a non-negative number');
    return { valid: false, errors };
  }

  if (typeof maxSizeBytes !== 'number' || maxSizeBytes <= 0) {
    errors.push('Maximum file size must be a positive number');
    return { valid: false, errors };
  }

  if (fileSizeBytes > maxSizeBytes) {
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    errors.push(`File size (${fileSizeMB} MB) exceeds maximum allowed size (${maxSizeMB} MB)`);
  }

  if (fileSizeBytes === 0) {
    errors.push('File cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates both file type and size
 *
 * @param mimeType - MIME type of the file
 * @param fileSizeBytes - Size of the file in bytes
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Validation result with valid flag and errors array
 *
 * Requirements: 13.1
 */
export function validateFile(
  mimeType: string,
  fileSizeBytes: number,
  allowedTypes: readonly string[],
  maxSizeBytes: number
): FileValidationResult {
  const typeValidation = validateFileType(mimeType, allowedTypes);
  const sizeValidation = validateFileSize(fileSizeBytes, maxSizeBytes);

  return {
    valid: typeValidation.valid && sizeValidation.valid,
    errors: [...typeValidation.errors, ...sizeValidation.errors],
  };
}

/**
 * Validates and sanitizes URL
 *
 * @param url - URL to validate
 * @param allowedProtocols - Array of allowed protocols (default: ['http:', 'https:'])
 * @returns Validation result with valid flag, sanitized URL, and optional error
 *
 * Requirements: 13.1
 */
export function validateURL(
  url: string,
  allowedProtocols: string[] = ['http:', 'https:']
): URLValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'URL is required and must be a string',
    };
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return {
      valid: false,
      error: 'URL cannot be empty',
    };
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    // Check protocol
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return {
        valid: false,
        error: `Protocol '${parsedUrl.protocol}' is not allowed. Allowed protocols: ${allowedProtocols.join(', ')}`,
      };
    }

    // Validate that URL has a valid hostname
    if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }

    // Sanitize URL by reconstructing it
    const sanitized = parsedUrl.toString();

    return {
      valid: true,
      sanitized,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Sanitizes URL by removing potentially dangerous components
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL or null if invalid
 *
 * Requirements: 13.1
 */
export function sanitizeURL(url: string): string | null {
  const validation = validateURL(url);
  return validation.valid ? validation.sanitized! : null;
}

/**
 * JSON Schema validation helper using Zod
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with success flag, data, and optional errors
 *
 * Requirements: 13.1
 */
export function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      });
      return {
        success: false,
        errors,
      };
    }
    return {
      success: false,
      errors: ['Validation failed with unknown error'],
    };
  }
}

/**
 * Creates a Zod schema validator function
 *
 * @param schema - Zod schema to validate against
 * @returns Validator function that throws on validation failure
 *
 * Requirements: 13.1
 */
export function createSchemaValidator<T>(schema: ZodSchema<T>) {
  return (data: unknown): T => {
    return schema.parse(data);
  };
}

/**
 * Creates a safe Zod schema validator function
 *
 * @param schema - Zod schema to validate against
 * @returns Validator function that returns validation result
 *
 * Requirements: 13.1
 */
export function createSafeSchemaValidator<T>(schema: ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
    return validateWithSchema(schema, data);
  };
}

/**
 * Common Zod schemas for reuse
 */
export const commonSchemas = {
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  url: z.string().url(),
  uuid: z.string().uuid(),
  positiveInt: z.number().int().positive(),
  nonNegativeInt: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
};
