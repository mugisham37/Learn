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
export function required(message = 'This field is required'): ValidationRule<any> {
  return {
    required: true,
    message,
    custom: (value) => {
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        return message;
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
  bio: maxLength(500, 'Bio must be no more than 500 characters'),
  timezone: required('Timezone is required'),
  language: required('Language is required')
};

/**
 * Course creation validation schema
 */
export const courseCreationValidationSchema: ValidationSchema<CourseCreationFormInput> = {
  title: {
    ...required('Course title is required'),
    ...minLength(3, 'Title must be at least 3 characters'),
    ...maxLength(100, 'Title must be no more than 100 characters')
  },
  description: {
    ...required('Course description is required'),
    ...minLength(10, 'Description must be at least 10 characters'),
    ...maxLength(2000, 'Description must be no more than 2000 characters')
  },
  category: required('Course category is required'),
  difficulty: required('Difficulty level is required'),
  price: {
    ...min(0, 'Price cannot be negative'),
    ...max(10000, 'Price cannot exceed $10,000')
  },
  currency: custom((value) => {
    if (value && !['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(value)) {
      return 'Invalid currency code';
    }
    return null;
  }),
  enrollmentLimit: min(1, 'Enrollment limit must be at least 1'),
  thumbnailFile: fileType(['jpg', 'jpeg', 'png', 'webp'], 'Thumbnail must be an image file')
};

/**
 * Lesson form validation schema
 */
export const lessonValidationSchema: ValidationSchema<LessonFormInput> = {
  title: {
    ...required('Lesson title is required'),
    ...minLength(3, 'Title must be at least 3 characters'),
    ...maxLength(100, 'Title must be no more than 100 characters')
  },
  description: {
    ...required('Lesson description is required'),
    ...minLength(10, 'Description must be at least 10 characters'),
    ...maxLength(1000, 'Description must be no more than 1000 characters')
  },
  type: required('Lesson type is required'),
  content: custom((value, formData: any) => {
    if (formData?.type === 'TEXT' && (!value || value.trim().length === 0)) {
      return 'Content is required for text lessons';
    }
    return null;
  }),
  videoFile: custom((value, formData: any) => {
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
  }),
  duration: min(1, 'Duration must be at least 1 second'),
  orderIndex: {
    ...required('Order index is required'),
    ...min(0, 'Order index cannot be negative')
  }
};

/**
 * Quiz form validation schema
 */
export const quizValidationSchema: ValidationSchema<QuizFormInput> = {
  title: {
    ...required('Quiz title is required'),
    ...minLength(3, 'Title must be at least 3 characters'),
    ...maxLength(100, 'Title must be no more than 100 characters')
  },
  description: maxLength(500, 'Description must be no more than 500 characters'),
  timeLimit: min(1, 'Time limit must be at least 1 minute'),
  maxAttempts: {
    ...required('Maximum attempts is required'),
    ...min(1, 'Must allow at least 1 attempt'),
    ...max(10, 'Cannot allow more than 10 attempts')
  },
  passingScore: {
    ...required('Passing score is required'),
    ...min(0, 'Passing score cannot be negative'),
    ...max(100, 'Passing score cannot exceed 100%')
  }
};

/**
 * Assignment form validation schema
 */
export const assignmentValidationSchema: ValidationSchema<AssignmentFormInput> = {
  title: {
    ...required('Assignment title is required'),
    ...minLength(3, 'Title must be at least 3 characters'),
    ...maxLength(100, 'Title must be no more than 100 characters')
  },
  description: {
    ...required('Assignment description is required'),
    ...minLength(10, 'Description must be at least 10 characters'),
    ...maxLength(1000, 'Description must be no more than 1000 characters')
  },
  instructions: {
    ...required('Assignment instructions are required'),
    ...minLength(10, 'Instructions must be at least 10 characters'),
    ...maxLength(2000, 'Instructions must be no more than 2000 characters')
  },
  maxPoints: {
    ...required('Maximum points is required'),
    ...min(1, 'Maximum points must be at least 1'),
    ...max(1000, 'Maximum points cannot exceed 1000')
  },
  maxFileSize: min(1, 'Maximum file size must be at least 1 byte')
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
    ...required('Email is required'),
    ...email('Please enter a valid email address')
  },
  password: {
    ...required('Password is required'),
    ...passwordStrength()
  },
  confirmPassword: custom((value, formData: any) => {
    if (value !== formData?.password) {
      return 'Passwords do not match';
    }
    return null;
  }),
  fullName: {
    ...required('Full name is required'),
    ...minLength(2, 'Full name must be at least 2 characters'),
    ...maxLength(100, 'Full name must be no more than 100 characters')
  },
  role: required('Please select a role'),
  acceptTerms: custom((value) => {
    if (!value) {
      return 'You must accept the terms and conditions';
    }
    return null;
  })
};

/**
 * Password change validation schema
 */
export const passwordChangeValidationSchema: ValidationSchema<PasswordChangeFormInput> = {
  currentPassword: required('Current password is required'),
  newPassword: {
    ...required('New password is required'),
    ...passwordStrength()
  },
  confirmPassword: custom((value, formData: any) => {
    if (value !== formData?.newPassword) {
      return 'Passwords do not match';
    }
    return null;
  })
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
  formData?: any
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
    const customResult = rule.custom(value);
    if (customResult) {
      return customResult;
    }
  }

  return null;
}

/**
 * Validate an entire form against its validation schema
 */
export async function validateForm<T extends Record<string, any>>(
  values: T,
  schema: ValidationSchema<T>
): Promise<FormErrors<T>> {
  const errors: FormErrors<T> = {};

  for (const [field, rule] of Object.entries(schema)) {
    if (rule) {
      const fieldError = await validateField(values[field], rule, values);
      if (fieldError) {
        (errors as any)[field] = fieldError;
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
    (formErrors as any)[error.field] = error.message;
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