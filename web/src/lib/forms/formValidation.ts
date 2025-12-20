/**
 * Form Validation Utilities
 * 
 * Provides form validation schema generation from GraphQL types,
 * type-safe form submission utilities, and validation helpers.
 * 
 * Requirements: 2.5 - Form validation schema from GraphQL types
 */

import type {
  ValidationRule,
  ValidationSchema,
  FormErrors,
  ProfileFormInput,
  CourseCreationFormInput,
  LessonFormInput,
  QuizFormInput,
  AssignmentFormInput,
  LoginFormInput,
  RegistrationFormInput,
  PasswordChangeFormInput
} from './formTypes';

// =============================================================================
// Validation Rule Builders
// =============================================================================

/**
 * Create a required field validation rule
 */
export function required(message?: string): ValidationRule<unknown> {
  const validationMessage = message || 'This field is required';
  return {
    required: true,
    message: validationMessage,
    custom: (value) => {
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        return validationMessage;
      }
      return null;
    }
  };
}

/**
 * Create a minimum length validation rule
 */
export function minLength(min: number, message?: string): ValidationRule<string> {
  return {
    minLength: min,
    message: message || `Must be at least ${min} characters`,
    custom: (value) => {
      if (typeof value === 'string' && value.length < min) {
        return message || `Must be at least ${min} characters`;
      }
      return null;
    }
  };
}

/**
 * Create a maximum length validation rule
 */
export function maxLength(max: number, message?: string): ValidationRule<string> {
  return {
    maxLength: max,
    message: message || `Must be no more than ${max} characters`,
    custom: (value) => {
      if (typeof value === 'string' && value.length > max) {
        return message || `Must be no more than ${max} characters`;
      }
      return null;
    }
  };
}

/**
 * Create a minimum value validation rule
 */
export function min(minValue: number, message?: string): ValidationRule<number> {
  return {
    min: minValue,
    message: message || `Must be at least ${minValue}`,
    custom: (value) => {
      if (typeof value === 'number' && value < minValue) {
        return message || `Must be at least ${minValue}`;
      }
      return null;
    }
  };
}

/**
 * Create a maximum value validation rule
 */
export function max(maxValue: number, message?: string): ValidationRule<number> {
  return {
    max: maxValue,
    message: message || `Must be no more than ${maxValue}`,
    custom: (value) => {
      if (typeof value === 'number' && value > maxValue) {
        return message || `Must be no more than ${maxValue}`;
      }
      return null;
    }
  };
}

/**
 * Create an email validation rule
 */
export function email(message = 'Must be a valid email address'): ValidationRule<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    pattern: emailRegex,
    message,
    custom: (value) => {
      if (typeof value === 'string' && value && !emailRegex.test(value)) {
        return message;
      }
      return null;
    }
  };
}

/**
 * Create a URL validation rule
 */
export function url(message = 'Must be a valid URL'): ValidationRule<string> {
  return {
    message,
    custom: (value) => {
      if (typeof value === 'string' && value) {
        try {
          new URL(value);
          return null;
        } catch {
          return message;
        }
      }
      return null;
    }
  };
}

/**
 * Create a pattern validation rule
 */
export function pattern(regex: RegExp, message = 'Invalid format'): ValidationRule<string> {
  return {
    pattern: regex,
    message,
    custom: (value) => {
      if (typeof value === 'string' && value && !regex.test(value)) {
        return message;
      }
      return null;
    }
  };
}

/**
 * Create a password strength validation rule
 */
export function passwordStrength(message = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'): ValidationRule<string> {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return {
    pattern: passwordRegex,
    message,
    custom: (value) => {
      if (typeof value === 'string' && value && !passwordRegex.test(value)) {
        return message;
      }
      return null;
    }
  };
}

/**
 * Create a file type validation rule
 */
export function fileType(allowedTypes: string[], message?: string): ValidationRule<File> {
  return {
    message: message || `File must be one of: ${allowedTypes.join(', ')}`,
    custom: (value) => {
      if (value instanceof File) {
        const fileExtension = value.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          return message || `File must be one of: ${allowedTypes.join(', ')}`;
        }
      }
      return null;
    }
  };
}

/**
 * Create a file size validation rule
 */
export function fileSize(maxSizeBytes: number, message?: string): ValidationRule<File> {
  const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
  return {
    message: message || `File size must be less than ${maxSizeMB}MB`,
    custom: (value) => {
      if (value instanceof File && value.size > maxSizeBytes) {
        return message || `File size must be less than ${maxSizeMB}MB`;
      }
      return null;
    }
  };
}

/**
 * Create a custom validation rule
 */
export function custom<T>(validator: (value: T) => string | null, message?: string): ValidationRule<T> {
  return {
    message,
    custom: validator
  };
}

// =============================================================================
// Predefined Validation Schemas
// =============================================================================

/**
 * Profile form validation schema
 */
export const profileValidationSchema: ValidationSchema<ProfileFormInput> = {
  fullName: required('Full name is required'),
  bio: {
    maxLength: 500,
    message: 'Bio must be no more than 500 characters',
    custom: (value) => {
      if (typeof value === 'string' && value.length > 500) {
        return 'Bio must be no more than 500 characters';
      }
      return null;
    }
  },
  timezone: required('Timezone is required'),
  language: required('Language is required')
};

/**
 * Course creation validation schema
 */
export const courseCreationValidationSchema: ValidationSchema<CourseCreationFormInput> = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Title is required and must be between 3-100 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Course title is required';
      }
      if (value.length < 3) {
        return 'Title must be at least 3 characters';
      }
      if (value.length > 100) {
        return 'Title must be no more than 100 characters';
      }
      return null;
    }
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 2000,
    message: 'Description is required and must be between 10-2000 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Course description is required';
      }
      if (value.length < 10) {
        return 'Description must be at least 10 characters';
      }
      if (value.length > 2000) {
        return 'Description must be no more than 2000 characters';
      }
      return null;
    }
  },
  category: required('Course category is required'),
  difficulty: required('Difficulty level is required'),
  price: {
    min: 0,
    max: 10000,
    message: 'Price must be between 0 and 10,000',
    custom: (value) => {
      if (value !== undefined && typeof value === 'number') {
        if (value < 0) return 'Price cannot be negative';
        if (value > 10000) return 'Price cannot exceed $10,000';
      }
      return null;
    }
  },
  currency: {
    custom: (value) => {
      if (value && !['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(value as string)) {
        return 'Invalid currency code';
      }
      return null;
    }
  },
  enrollmentLimit: {
    min: 1,
    message: 'Enrollment limit must be at least 1',
    custom: (value) => {
      if (value !== undefined && typeof value === 'number' && value < 1) {
        return 'Enrollment limit must be at least 1';
      }
      return null;
    }
  },
  thumbnailFile: {
    custom: (value) => {
      if (value instanceof File) {
        const allowedTypes = ['jpg', 'jpeg', 'png', 'webp'];
        const fileExtension = value.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          return 'Thumbnail must be an image file';
        }
      }
      return null;
    }
  }
};

/**
 * Lesson form validation schema
 */
export const lessonValidationSchema: ValidationSchema<LessonFormInput> = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Title is required and must be between 3-100 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Lesson title is required';
      }
      if (value.length < 3) {
        return 'Title must be at least 3 characters';
      }
      if (value.length > 100) {
        return 'Title must be no more than 100 characters';
      }
      return null;
    }
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000,
    message: 'Description is required and must be between 10-1000 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Lesson description is required';
      }
      if (value.length < 10) {
        return 'Description must be at least 10 characters';
      }
      if (value.length > 1000) {
        return 'Description must be no more than 1000 characters';
      }
      return null;
    }
  },
  type: required('Lesson type is required'),
  content: {
    custom: (value, formData) => {
      if (formData?.type === 'TEXT' && (!value || (typeof value === 'string' && value.trim().length === 0))) {
        return 'Content is required for text lessons';
      }
      return null;
    }
  },
  videoFile: {
    custom: (value, formData) => {
      if (formData?.type === 'VIDEO' && !value && !formData?.videoUrl) {
        return 'Video file or URL is required for video lessons';
      }
      if (value instanceof File) {
        const allowedTypes = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm'];
        const fileExtension = value.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
          return 'Video must be in MP4, MOV, AVI, WMV, FLV, or WebM format';
        }
        // 500MB limit
        if (value.size > 500 * 1024 * 1024) {
          return 'Video file size must be less than 500MB';
        }
      }
      return null;
    }
  },
  duration: {
    min: 1,
    message: 'Duration must be at least 1 second',
    custom: (value) => {
      if (value !== undefined && typeof value === 'number' && value < 1) {
        return 'Duration must be at least 1 second';
      }
      return null;
    }
  },
  orderIndex: {
    required: true,
    min: 0,
    message: 'Order index is required and cannot be negative',
    custom: (value) => {
      if (value === undefined || value === null) {
        return 'Order index is required';
      }
      if (typeof value === 'number' && value < 0) {
        return 'Order index cannot be negative';
      }
      return null;
    }
  }
};

/**
 * Quiz form validation schema
 */
export const quizValidationSchema: ValidationSchema<QuizFormInput> = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Title is required and must be between 3-100 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Quiz title is required';
      }
      if (value.length < 3) {
        return 'Title must be at least 3 characters';
      }
      if (value.length > 100) {
        return 'Title must be no more than 100 characters';
      }
      return null;
    }
  },
  description: {
    maxLength: 500,
    message: 'Description must be no more than 500 characters',
    custom: (value) => {
      if (typeof value === 'string' && value.length > 500) {
        return 'Description must be no more than 500 characters';
      }
      return null;
    }
  },
  timeLimit: {
    min: 1,
    message: 'Time limit must be at least 1 minute',
    custom: (value) => {
      if (value !== undefined && typeof value === 'number' && value < 1) {
        return 'Time limit must be at least 1 minute';
      }
      return null;
    }
  },
  maxAttempts: {
    required: true,
    min: 1,
    max: 10,
    message: 'Maximum attempts is required and must be between 1-10',
    custom: (value) => {
      if (value === undefined || value === null) {
        return 'Maximum attempts is required';
      }
      if (typeof value === 'number') {
        if (value < 1) return 'Must allow at least 1 attempt';
        if (value > 10) return 'Cannot allow more than 10 attempts';
      }
      return null;
    }
  },
  passingScore: {
    required: true,
    min: 0,
    max: 100,
    message: 'Passing score is required and must be between 0-100%',
    custom: (value) => {
      if (value === undefined || value === null) {
        return 'Passing score is required';
      }
      if (typeof value === 'number') {
        if (value < 0) return 'Passing score cannot be negative';
        if (value > 100) return 'Passing score cannot exceed 100%';
      }
      return null;
    }
  }
};

/**
 * Assignment form validation schema
 */
export const assignmentValidationSchema: ValidationSchema<AssignmentFormInput> = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Title is required and must be between 3-100 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Assignment title is required';
      }
      if (value.length < 3) {
        return 'Title must be at least 3 characters';
      }
      if (value.length > 100) {
        return 'Title must be no more than 100 characters';
      }
      return null;
    }
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000,
    message: 'Description is required and must be between 10-1000 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Assignment description is required';
      }
      if (value.length < 10) {
        return 'Description must be at least 10 characters';
      }
      if (value.length > 1000) {
        return 'Description must be no more than 1000 characters';
      }
      return null;
    }
  },
  instructions: {
    required: true,
    minLength: 10,
    maxLength: 2000,
    message: 'Instructions are required and must be between 10-2000 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Assignment instructions are required';
      }
      if (value.length < 10) {
        return 'Instructions must be at least 10 characters';
      }
      if (value.length > 2000) {
        return 'Instructions must be no more than 2000 characters';
      }
      return null;
    }
  },
  maxPoints: {
    required: true,
    min: 1,
    max: 1000,
    message: 'Maximum points is required and must be between 1-1000',
    custom: (value) => {
      if (value === undefined || value === null) {
        return 'Maximum points is required';
      }
      if (typeof value === 'number') {
        if (value < 1) return 'Maximum points must be at least 1';
        if (value > 1000) return 'Maximum points cannot exceed 1000';
      }
      return null;
    }
  },
  maxFileSize: {
    min: 1,
    message: 'Maximum file size must be at least 1 byte',
    custom: (value) => {
      if (value !== undefined && typeof value === 'number' && value < 1) {
        return 'Maximum file size must be at least 1 byte';
      }
      return null;
    }
  }
};

/**
 * Login form validation schema
 */
export const loginValidationSchema: ValidationSchema<LoginFormInput> = {
  email: {
    ...required('Email is required'),
    ...email('Please enter a valid email address')
  },
  password: required('Password is required')
};

/**
 * Registration form validation schema
 */
export const registrationValidationSchema: ValidationSchema<RegistrationFormInput> = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Email is required';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    }
  },
  password: {
    required: true,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Password is required';
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(value)) {
        return 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
      }
      return null;
    }
  },
  confirmPassword: {
    custom: (value, formData) => {
      if (value !== formData?.password) {
        return 'Passwords do not match';
      }
      return null;
    }
  },
  fullName: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Full name is required and must be between 2-100 characters',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'Full name is required';
      }
      if (value.length < 2) {
        return 'Full name must be at least 2 characters';
      }
      if (value.length > 100) {
        return 'Full name must be no more than 100 characters';
      }
      return null;
    }
  },
  role: required('Please select a role'),
  acceptTerms: {
    custom: (value) => {
      if (!value) {
        return 'You must accept the terms and conditions';
      }
      return null;
    }
  }
};

/**
 * Password change validation schema
 */
export const passwordChangeValidationSchema: ValidationSchema<PasswordChangeFormInput> = {
  currentPassword: required('Current password is required'),
  newPassword: {
    required: true,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character',
    custom: (value) => {
      if (!value || typeof value !== 'string') {
        return 'New password is required';
      }
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(value)) {
        return 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
      }
      return null;
    }
  },
  confirmPassword: {
    custom: (value, formData) => {
      if (value !== formData?.newPassword) {
        return 'Passwords do not match';
      }
      return null;
    }
  }
};

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate a single field against its validation rule
 */
export async function validateField<T>(
  value: T,
  rule: ValidationRule<T>,
  formData?: Record<string, unknown>
): Promise<string | null> {
  // Check required
  if (rule.required && (value == null || value === '' || (Array.isArray(value) && value.length === 0))) {
    return rule.message || 'This field is required';
  }

  // Skip other validations if value is empty and not required
  if (!rule.required && (value == null || value === '')) {
    return null;
  }

  // Check string length
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return rule.message || `Must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return rule.message || `Must be no more than ${rule.maxLength} characters`;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.message || 'Invalid format';
    }
  }

  // Check numeric range
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return rule.message || `Must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return rule.message || `Must be no more than ${rule.max}`;
    }
  }

  // Check custom validation
  if (rule.custom) {
    const customResult = rule.custom(value, formData);
    if (customResult) {
      return customResult;
    }
  }

  return null;
}

/**
 * Validate an entire form against its validation schema
 */
export async function validateForm<T extends Record<string, unknown>>(
  values: T,
  schema: ValidationSchema<T>
): Promise<FormErrors<T>> {
  const errors: FormErrors<T> = {};

  for (const [field, rule] of Object.entries(schema)) {
    if (rule) {
      const fieldError = await validateField(values[field], rule, values);
      if (fieldError) {
        (errors as Record<string, string>)[field] = fieldError;
      }
    }
  }

  return errors;
}

/**
 * Check if a form has any validation errors
 */
export function hasFormErrors<T>(errors: FormErrors<T>): boolean {
  return Object.values(errors).some(error => error != null && error !== '');
}

/**
 * Get the first validation error from a form
 */
export function getFirstFormError<T>(errors: FormErrors<T>): string | null {
  for (const error of Object.values(errors)) {
    if (error && typeof error === 'string') {
      return error;
    }
  }
  return null;
}

/**
 * Clear specific fields from form errors
 */
export function clearFormErrors<T>(
  errors: FormErrors<T>,
  fields: (keyof T)[]
): FormErrors<T> {
  const clearedErrors = { ...errors };
  for (const field of fields) {
    delete clearedErrors[field];
  }
  return clearedErrors;
}

/**
 * Merge form errors
 */
export function mergeFormErrors<T>(
  errors1: FormErrors<T>,
  errors2: FormErrors<T>
): FormErrors<T> {
  return { ...errors1, ...errors2 };
}

/**
 * Convert server validation errors to form errors
 */
export function serverErrorsToFormErrors<T>(
  serverErrors: Array<{ field: string; message: string }>
): FormErrors<T> {
  const formErrors: FormErrors<T> = {};
  
  for (const error of serverErrors) {
    (formErrors as Record<string, string>)[error.field] = error.message;
  }
  
  return formErrors;
}

/**
 * Debounce validation for real-time validation
 */
export function debounceValidation<T>(
  validator: (value: T) => Promise<string | null>,
  delay = 300
): (value: T) => Promise<string | null> {
  let timeoutId: NodeJS.Timeout;
  
  return (value: T): Promise<string | null> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const result = await validator(value);
        resolve(result);
      }, delay);
    });
  };
}