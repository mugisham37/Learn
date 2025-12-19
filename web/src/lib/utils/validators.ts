/**
 * Validation Utilities
 * 
 * Client-side validation utilities that match backend constraints exactly.
 * Provides form validation helpers, input sanitization, and schema generation.
 * 
 * Requirements: 9.4
 */

import { memoize } from './performance';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationRule<T = any> {
  name: string;
  validate: (value: T, context?: ValidationContext) => boolean | string;
  message?: string;
}

export interface ValidationContext {
  field: string;
  allValues?: Record<string, any>;
  user?: any;
}

export interface FormValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  context?: ValidationContext;
}

// =============================================================================
// Constants
// =============================================================================

// Backend constraint constants (should match server-side validation)
export const VALIDATION_CONSTRAINTS = {
  EMAIL: {
    MAX_LENGTH: 255,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
    SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  },
  USER: {
    FULL_NAME: {
      MIN_LENGTH: 2,
      MAX_LENGTH: 100,
    },
    BIO: {
      MAX_LENGTH: 1000,
    },
  },
  COURSE: {
    TITLE: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 200,
    },
    DESCRIPTION: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 5000,
    },
    SLUG: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 100,
      PATTERN: /^[a-z0-9-]+$/,
    },
    PRICE: {
      MIN: 0,
      MAX: 999999.99,
    },
  },
  FILE: {
    IMAGE: {
      MAX_SIZE: 10 * 1024 * 1024, // 10MB
      ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    VIDEO: {
      MAX_SIZE: 2 * 1024 * 1024 * 1024, // 2GB
      ALLOWED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
    },
    DOCUMENT: {
      MAX_SIZE: 50 * 1024 * 1024, // 50MB
      ALLOWED_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
  },
} as const;

// =============================================================================
// Basic Validation Rules
// =============================================================================

/**
 * Required field validation
 */
export const required = <T>(message = 'This field is required'): ValidationRule<T> => ({
  name: 'required',
  validate: (value: T) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },
  message,
});

/**
 * String length validation
 */
export const stringLength = (
  min?: number,
  max?: number,
  message?: string
): ValidationRule<string> => ({
  name: 'stringLength',
  validate: (value: string) => {
    if (typeof value !== 'string') return false;
    const length = value.trim().length;
    if (min !== undefined && length < min) return false;
    if (max !== undefined && length > max) return false;
    return true;
  },
  message: message || `Must be between ${min || 0} and ${max || 'unlimited'} characters`,
});

/**
 * Email validation
 */
export const email = (message = 'Please enter a valid email address'): ValidationRule<string> => ({
  name: 'email',
  validate: (value: string) => {
    if (typeof value !== 'string') return false;
    return VALIDATION_CONSTRAINTS.EMAIL.PATTERN.test(value.trim());
  },
  message,
});

/**
 * Password validation
 */
export const password = (message?: string): ValidationRule<string> => ({
  name: 'password',
  validate: (value: string) => {
    if (typeof value !== 'string') return false;
    
    const { MIN_LENGTH, MAX_LENGTH, REQUIRE_UPPERCASE, REQUIRE_LOWERCASE, REQUIRE_NUMBER, REQUIRE_SPECIAL, SPECIAL_CHARS } = VALIDATION_CONSTRAINTS.PASSWORD;
    
    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) return false;
    if (REQUIRE_UPPERCASE && !/[A-Z]/.test(value)) return false;
    if (REQUIRE_LOWERCASE && !/[a-z]/.test(value)) return false;
    if (REQUIRE_NUMBER && !/\d/.test(value)) return false;
    if (REQUIRE_SPECIAL && !new RegExp(`[${SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(value)) return false;
    
    return true;
  },
  message: message || `Password must be ${VALIDATION_CONSTRAINTS.PASSWORD.MIN_LENGTH}-${VALIDATION_CONSTRAINTS.PASSWORD.MAX_LENGTH} characters with uppercase, lowercase, number, and special character`,
});

/**
 * Number range validation
 */
export const numberRange = (
  min?: number,
  max?: number,
  message?: string
): ValidationRule<number> => ({
  name: 'numberRange',
  validate: (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
  },
  message: message || `Must be between ${min || '-∞'} and ${max || '∞'}`,
});

/**
 * Pattern validation
 */
export const pattern = (
  regex: RegExp,
  message = 'Invalid format'
): ValidationRule<string> => ({
  name: 'pattern',
  validate: (value: string) => {
    if (typeof value !== 'string') return false;
    return regex.test(value);
  },
  message,
});

/**
 * URL validation
 */
export const url = (message = 'Please enter a valid URL'): ValidationRule<string> => ({
  name: 'url',
  validate: (value: string) => {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  message,
});

// =============================================================================
// Domain-Specific Validators
// =============================================================================

/**
 * Course title validation
 */
export const courseTitle = (): ValidationRule<string> => ({
  name: 'courseTitle',
  validate: (value: string) => {
    const { MIN_LENGTH, MAX_LENGTH } = VALIDATION_CONSTRAINTS.COURSE.TITLE;
    return stringLength(MIN_LENGTH, MAX_LENGTH).validate(value);
  },
  message: `Course title must be ${VALIDATION_CONSTRAINTS.COURSE.TITLE.MIN_LENGTH}-${VALIDATION_CONSTRAINTS.COURSE.TITLE.MAX_LENGTH} characters`,
});

/**
 * Course slug validation
 */
export const courseSlug = (): ValidationRule<string> => ({
  name: 'courseSlug',
  validate: (value: string) => {
    const { MIN_LENGTH, MAX_LENGTH, PATTERN } = VALIDATION_CONSTRAINTS.COURSE.SLUG;
    if (!stringLength(MIN_LENGTH, MAX_LENGTH).validate(value)) return false;
    return PATTERN.test(value);
  },
  message: `Slug must be ${VALIDATION_CONSTRAINTS.COURSE.SLUG.MIN_LENGTH}-${VALIDATION_CONSTRAINTS.COURSE.SLUG.MAX_LENGTH} characters, lowercase letters, numbers, and hyphens only`,
});

/**
 * Course price validation
 */
export const coursePrice = (): ValidationRule<number> => ({
  name: 'coursePrice',
  validate: (value: number) => {
    const { MIN, MAX } = VALIDATION_CONSTRAINTS.COURSE.PRICE;
    return numberRange(MIN, MAX).validate(value);
  },
  message: `Price must be between $${VALIDATION_CONSTRAINTS.COURSE.PRICE.MIN} and $${VALIDATION_CONSTRAINTS.COURSE.PRICE.MAX}`,
});

/**
 * File validation
 */
export const file = (
  type: 'image' | 'video' | 'document',
  message?: string
): ValidationRule<File> => ({
  name: 'file',
  validate: (value: File) => {
    if (!(value instanceof File)) return false;
    
    const constraints = VALIDATION_CONSTRAINTS.FILE[type.toUpperCase() as keyof typeof VALIDATION_CONSTRAINTS.FILE];
    
    // Check file size
    if (value.size > constraints.MAX_SIZE) return false;
    
    // Check file type
    if (!constraints.ALLOWED_TYPES.includes(value.type)) return false;
    
    return true;
  },
  message: message || `Invalid ${type} file`,
});

// =============================================================================
// Form Validation
// =============================================================================

/**
 * Validates a single field with multiple rules
 */
export const validateField = <T>(
  value: T,
  rules: ValidationRule<T>[],
  context?: ValidationContext
): ValidationResult => {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const result = rule.validate(value, context);
    
    if (result === false || typeof result === 'string') {
      errors.push({
        field: context?.field || 'unknown',
        message: typeof result === 'string' ? result : rule.message || 'Validation failed',
        code: rule.name,
        value,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates an entire form object
 */
export const validateForm = <T extends Record<string, any>>(
  values: T,
  schema: Record<keyof T, ValidationRule<any>[]>,
  options: FormValidationOptions = {}
): ValidationResult => {
  const { abortEarly = false, context } = options;
  const errors: ValidationError[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = values[field];
    const fieldContext = { ...context, field, allValues: values };
    
    const fieldResult = validateField(value, rules, fieldContext);
    
    if (!fieldResult.isValid) {
      errors.push(...fieldResult.errors);
      
      if (abortEarly) {
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// =============================================================================
// Input Sanitization
// =============================================================================

/**
 * Sanitizes HTML content to prevent XSS
 */
export const sanitizeHtml = memoize((html: string): string => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
});

/**
 * Sanitizes user input for safe storage
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 10000); // Limit length
};

/**
 * Escapes special characters for safe display
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// =============================================================================
// Schema Generation
// =============================================================================

/**
 * Common validation schemas for forms
 */
export const ValidationSchemas = {
  // User registration
  userRegistration: {
    email: [required(), email()],
    password: [required(), password()],
    fullName: [required(), stringLength(VALIDATION_CONSTRAINTS.USER.FULL_NAME.MIN_LENGTH, VALIDATION_CONSTRAINTS.USER.FULL_NAME.MAX_LENGTH)],
  },

  // User login
  userLogin: {
    email: [required(), email()],
    password: [required()],
  },

  // Profile update
  profileUpdate: {
    fullName: [stringLength(VALIDATION_CONSTRAINTS.USER.FULL_NAME.MIN_LENGTH, VALIDATION_CONSTRAINTS.USER.FULL_NAME.MAX_LENGTH)],
    bio: [stringLength(0, VALIDATION_CONSTRAINTS.USER.BIO.MAX_LENGTH)],
  },

  // Course creation
  courseCreation: {
    title: [required(), courseTitle()],
    description: [required(), stringLength(VALIDATION_CONSTRAINTS.COURSE.DESCRIPTION.MIN_LENGTH, VALIDATION_CONSTRAINTS.COURSE.DESCRIPTION.MAX_LENGTH)],
    slug: [required(), courseSlug()],
    price: [numberRange(VALIDATION_CONSTRAINTS.COURSE.PRICE.MIN, VALIDATION_CONSTRAINTS.COURSE.PRICE.MAX)],
    category: [required()],
  },

  // File upload
  imageUpload: {
    file: [required(), file('image')],
  },

  videoUpload: {
    file: [required(), file('video')],
  },

  documentUpload: {
    file: [required(), file('document')],
  },
};

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Creates a validation function for a specific schema
 */
export const createValidator = <T extends Record<string, any>>(
  schema: Record<keyof T, ValidationRule<any>[]>
) => {
  return (values: T, options?: FormValidationOptions): ValidationResult => {
    return validateForm(values, schema, options);
  };
};

/**
 * Creates a field validator
 */
export const createFieldValidator = <T>(rules: ValidationRule<T>[]) => {
  return (value: T, context?: ValidationContext): ValidationResult => {
    return validateField(value, rules, context);
  };
};

/**
 * Checks if a validation result has errors for a specific field
 */
export const hasFieldError = (result: ValidationResult, field: string): boolean => {
  return result.errors.some(error => error.field === field);
};

/**
 * Gets errors for a specific field
 */
export const getFieldErrors = (result: ValidationResult, field: string): ValidationError[] => {
  return result.errors.filter(error => error.field === field);
};

/**
 * Gets the first error message for a field
 */
export const getFieldErrorMessage = (result: ValidationResult, field: string): string | null => {
  const errors = getFieldErrors(result, field);
  return errors.length > 0 ? errors[0].message : null;
};

// =============================================================================
// Exports
// =============================================================================

export const ValidationRules = {
  required,
  stringLength,
  email,
  password,
  numberRange,
  pattern,
  url,
  courseTitle,
  courseSlug,
  coursePrice,
  file,
};

export const ValidationHelpers = {
  validateField,
  validateForm,
  createValidator,
  createFieldValidator,
  hasFieldError,
  getFieldErrors,
  getFieldErrorMessage,
};

export const SanitizationUtils = {
  sanitizeHtml,
  sanitizeInput,
  escapeHtml,
};

export const Validators = {
  ...ValidationRules,
  ...ValidationHelpers,
  ...SanitizationUtils,
  ValidationSchemas,
  VALIDATION_CONSTRAINTS,
};