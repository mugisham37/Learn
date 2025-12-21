/**
 * Backend Error Mapping Configuration
 * 
 * Maps backend-specific error codes to frontend error types and provides
 * backend-specific error handling strategies for the LMS system.
 */

import type { ErrorType, ErrorSeverity, ErrorCategory } from './errorTypes';

/**
 * Backend GraphQL error codes mapping
 * These codes come from the production LMS backend
 */
export const BACKEND_ERROR_MAPPING: Record<string, {
  type: ErrorType;
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  userMessage?: string;
}> = {
  // Authentication Errors
  'UNAUTHENTICATED': {
    type: 'AUTHENTICATION_ERROR',
    severity: 'high',
    category: 'authentication',
    retryable: false,
    userMessage: 'Please log in to continue.',
  },
  'TOKEN_EXPIRED': {
    type: 'AUTHENTICATION_ERROR',
    severity: 'medium',
    category: 'authentication',
    retryable: true, // Can retry with token refresh
    userMessage: 'Your session has expired. Please log in again.',
  },
  'INVALID_TOKEN': {
    type: 'AUTHENTICATION_ERROR',
    severity: 'high',
    category: 'authentication',
    retryable: false,
    userMessage: 'Invalid authentication. Please log in again.',
  },
  'TOKEN_REFRESH_FAILED': {
    type: 'AUTHENTICATION_ERROR',
    severity: 'high',
    category: 'authentication',
    retryable: false,
    userMessage: 'Unable to refresh session. Please log in again.',
  },

  // Authorization Errors
  'FORBIDDEN': {
    type: 'AUTHORIZATION_ERROR',
    severity: 'medium',
    category: 'authorization',
    retryable: false,
    userMessage: 'You don\'t have permission to perform this action.',
  },
  'INSUFFICIENT_PERMISSIONS': {
    type: 'AUTHORIZATION_ERROR',
    severity: 'medium',
    category: 'authorization',
    retryable: false,
    userMessage: 'Insufficient permissions for this action.',
  },
  'COURSE_ACCESS_DENIED': {
    type: 'AUTHORIZATION_ERROR',
    severity: 'medium',
    category: 'authorization',
    retryable: false,
    userMessage: 'You need to enroll in this course to access its content.',
  },
  'INSTRUCTOR_ONLY': {
    type: 'AUTHORIZATION_ERROR',
    severity: 'medium',
    category: 'authorization',
    retryable: false,
    userMessage: 'Only course instructors can perform this action.',
  },
  'ADMIN_REQUIRED': {
    type: 'AUTHORIZATION_ERROR',
    severity: 'medium',
    category: 'authorization',
    retryable: false,
    userMessage: 'This action requires administrator privileges.',
  },

  // Validation Errors
  'BAD_USER_INPUT': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Please check your input and try again.',
  },
  'VALIDATION_ERROR': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Please correct the highlighted fields and try again.',
  },
  'INVALID_EMAIL': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Please enter a valid email address.',
  },
  'PASSWORD_TOO_WEAK': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Password must be at least 8 characters with mixed case and numbers.',
  },
  'DUPLICATE_EMAIL': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'An account with this email already exists.',
  },
  'COURSE_TITLE_REQUIRED': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Course title is required.',
  },
  'INVALID_PRICE': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Please enter a valid price amount.',
  },

  // Network and Server Errors
  'INTERNAL_SERVER_ERROR': {
    type: 'UNKNOWN_ERROR',
    severity: 'high',
    category: 'server',
    retryable: true,
    userMessage: 'Server error occurred. Please try again.',
  },
  'SERVICE_UNAVAILABLE': {
    type: 'NETWORK_ERROR',
    severity: 'high',
    category: 'server',
    retryable: true,
    userMessage: 'Service is temporarily unavailable. Please try again later.',
  },
  'DATABASE_ERROR': {
    type: 'UNKNOWN_ERROR',
    severity: 'critical',
    category: 'server',
    retryable: true,
    userMessage: 'Database error occurred. Please try again.',
  },
  'RATE_LIMITED': {
    type: 'NETWORK_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'Too many requests. Please wait a moment and try again.',
  },
  'TIMEOUT': {
    type: 'NETWORK_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'Request timed out. Please try again.',
  },

  // Upload and File Errors
  'FILE_TOO_LARGE': {
    type: 'UPLOAD_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'File is too large. Maximum size is 100MB.',
  },
  'INVALID_FILE_TYPE': {
    type: 'UPLOAD_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'File type not supported. Please choose a different file.',
  },
  'UPLOAD_FAILED': {
    type: 'UPLOAD_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'File upload failed. Please try again.',
  },
  'PROCESSING_FAILED': {
    type: 'UPLOAD_ERROR',
    severity: 'medium',
    category: 'server',
    retryable: true,
    userMessage: 'File processing failed. Please try a different file.',
  },
  'S3_UPLOAD_ERROR': {
    type: 'UPLOAD_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'Upload service error. Please try again.',
  },
  'MEDIACONVERT_ERROR': {
    type: 'UPLOAD_ERROR',
    severity: 'medium',
    category: 'server',
    retryable: true,
    userMessage: 'Video processing failed. Please try again.',
  },

  // Payment Errors
  'PAYMENT_FAILED': {
    type: 'VALIDATION_ERROR',
    severity: 'medium',
    category: 'user_input',
    retryable: true,
    userMessage: 'Payment failed. Please check your payment method.',
  },
  'INSUFFICIENT_FUNDS': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Insufficient funds. Please use a different payment method.',
  },
  'PAYMENT_METHOD_DECLINED': {
    type: 'VALIDATION_ERROR',
    severity: 'low',
    category: 'user_input',
    retryable: false,
    userMessage: 'Payment method declined. Please try a different card.',
  },
  'STRIPE_ERROR': {
    type: 'NETWORK_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'Payment service error. Please try again.',
  },

  // Subscription and Real-time Errors
  'SUBSCRIPTION_FAILED': {
    type: 'SUBSCRIPTION_ERROR',
    severity: 'low',
    category: 'network',
    retryable: true,
    userMessage: 'Real-time connection failed. Reconnecting...',
  },
  'WEBSOCKET_ERROR': {
    type: 'SUBSCRIPTION_ERROR',
    severity: 'medium',
    category: 'network',
    retryable: true,
    userMessage: 'Connection lost. Attempting to reconnect...',
  },
  'REDIS_ERROR': {
    type: 'SUBSCRIPTION_ERROR',
    severity: 'high',
    category: 'server',
    retryable: true,
    userMessage: 'Real-time service error. Please refresh the page.',
  },

  // Search and Analytics Errors
  'ELASTICSEARCH_ERROR': {
    type: 'NETWORK_ERROR',
    severity: 'medium',
    category: 'server',
    retryable: true,
    userMessage: 'Search service error. Please try again.',
  },
  'SEARCH_TIMEOUT': {
    type: 'NETWORK_ERROR',
    severity: 'low',
    category: 'network',
    retryable: true,
    userMessage: 'Search timed out. Please try a simpler query.',
  },
  'ANALYTICS_ERROR': {
    type: 'UNKNOWN_ERROR',
    severity: 'low',
    category: 'server',
    retryable: true,
    userMessage: 'Analytics service error. Data may be delayed.',
  },

  // Cache Errors
  'CACHE_MISS': {
    type: 'CACHE_ERROR',
    severity: 'low',
    category: 'client',
    retryable: true,
    userMessage: 'Loading fresh data...',
  },
  'CACHE_INVALID': {
    type: 'CACHE_ERROR',
    severity: 'low',
    category: 'client',
    retryable: false,
    userMessage: 'Data may be outdated. Please refresh to see latest changes.',
  },
  'CACHE_FULL': {
    type: 'CACHE_ERROR',
    severity: 'medium',
    category: 'client',
    retryable: false,
    userMessage: 'Local storage is full. Please clear some data.',
  },
};

/**
 * Backend-specific retry configurations
 */
export const BACKEND_RETRY_CONFIG = {
  // Authentication errors - retry with token refresh
  AUTHENTICATION_ERROR: {
    maxAttempts: 1, // Only retry once with token refresh
    baseDelay: 0, // Immediate retry after token refresh
    backoffMultiplier: 1,
  },
  
  // Network errors - aggressive retry for backend services
  NETWORK_ERROR: {
    maxAttempts: 5, // More retries for network issues
    baseDelay: 1000,
    backoffMultiplier: 1.5, // Gentler backoff for backend
  },
  
  // Upload errors - retry with longer delays
  UPLOAD_ERROR: {
    maxAttempts: 3,
    baseDelay: 3000, // Longer initial delay
    backoffMultiplier: 2,
  },
  
  // Subscription errors - frequent retries for real-time
  SUBSCRIPTION_ERROR: {
    maxAttempts: 10, // Many retries for real-time connections
    baseDelay: 1000,
    backoffMultiplier: 1.2, // Gentle backoff
  },
  
  // Server errors - moderate retry
  UNKNOWN_ERROR: {
    maxAttempts: 3,
    baseDelay: 2000,
    backoffMultiplier: 2,
  },
};

/**
 * Field-specific error mappings for form validation
 */
export const BACKEND_FIELD_ERRORS: Record<string, Record<string, string>> = {
  // User registration/profile fields
  email: {
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'DUPLICATE_EMAIL': 'An account with this email already exists.',
    'EMAIL_REQUIRED': 'Email address is required.',
  },
  password: {
    'PASSWORD_TOO_WEAK': 'Password must be at least 8 characters with mixed case and numbers.',
    'PASSWORD_REQUIRED': 'Password is required.',
    'PASSWORD_MISMATCH': 'Passwords do not match.',
  },
  fullName: {
    'NAME_REQUIRED': 'Full name is required.',
    'NAME_TOO_LONG': 'Name must be less than 100 characters.',
  },
  
  // Course fields
  title: {
    'COURSE_TITLE_REQUIRED': 'Course title is required.',
    'TITLE_TOO_LONG': 'Title must be less than 200 characters.',
    'DUPLICATE_TITLE': 'A course with this title already exists.',
  },
  description: {
    'DESCRIPTION_REQUIRED': 'Course description is required.',
    'DESCRIPTION_TOO_LONG': 'Description must be less than 5000 characters.',
  },
  price: {
    'INVALID_PRICE': 'Please enter a valid price amount.',
    'PRICE_TOO_HIGH': 'Price cannot exceed $10,000.',
    'PRICE_NEGATIVE': 'Price cannot be negative.',
  },
  
  // File upload fields
  file: {
    'FILE_REQUIRED': 'Please select a file.',
    'FILE_TOO_LARGE': 'File is too large. Maximum size is 100MB.',
    'INVALID_FILE_TYPE': 'File type not supported.',
  },
  
  // Payment fields
  cardNumber: {
    'INVALID_CARD': 'Please enter a valid card number.',
    'CARD_DECLINED': 'Card was declined. Please try a different card.',
  },
  expiryDate: {
    'INVALID_EXPIRY': 'Please enter a valid expiry date.',
    'CARD_EXPIRED': 'Card has expired. Please use a different card.',
  },
  cvv: {
    'INVALID_CVV': 'Please enter a valid CVV.',
  },
};

/**
 * Context-specific error messages for different user actions
 */
export const BACKEND_CONTEXTUAL_MESSAGES: Record<string, Record<string, string>> = {
  // Login context
  login: {
    'UNAUTHENTICATED': 'Invalid email or password. Please try again.',
    'RATE_LIMITED': 'Too many login attempts. Please wait 15 minutes and try again.',
    'ACCOUNT_LOCKED': 'Account temporarily locked due to multiple failed attempts.',
  },
  
  // Registration context
  registration: {
    'DUPLICATE_EMAIL': 'An account with this email already exists. Try logging in instead.',
    'VALIDATION_ERROR': 'Please complete all required fields correctly.',
    'EMAIL_VERIFICATION_REQUIRED': 'Please check your email and verify your account.',
  },
  
  // Course creation context
  course_creation: {
    'VALIDATION_ERROR': 'Please complete all required course information.',
    'UPLOAD_FAILED': 'Course thumbnail upload failed. You can add it later.',
    'INSTRUCTOR_REQUIRED': 'Only instructors can create courses.',
  },
  
  // Payment context
  payment: {
    'PAYMENT_FAILED': 'Payment could not be processed. Please check your payment details.',
    'INSUFFICIENT_FUNDS': 'Payment failed due to insufficient funds.',
    'PAYMENT_METHOD_DECLINED': 'Payment method was declined. Please try a different card.',
  },
  
  // File upload context
  file_upload: {
    'FILE_TOO_LARGE': 'File is too large for upload. Please compress or choose a smaller file.',
    'INVALID_FILE_TYPE': 'File type not supported. Please choose a different file format.',
    'UPLOAD_FAILED': 'Upload failed. Please check your connection and try again.',
  },
};

/**
 * Gets backend-specific error configuration
 */
export function getBackendErrorConfig(errorCode: string) {
  return BACKEND_ERROR_MAPPING[errorCode] || {
    type: 'UNKNOWN_ERROR' as ErrorType,
    severity: 'medium' as ErrorSeverity,
    category: 'system' as ErrorCategory,
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Gets field-specific error message for backend error
 */
export function getBackendFieldError(field: string, errorCode: string): string | undefined {
  return BACKEND_FIELD_ERRORS[field]?.[errorCode];
}

/**
 * Gets contextual error message for backend error
 */
export function getBackendContextualMessage(context: string, errorCode: string): string | undefined {
  return BACKEND_CONTEXTUAL_MESSAGES[context]?.[errorCode];
}

/**
 * Checks if error code is from backend
 */
export function isBackendError(errorCode: string): boolean {
  return errorCode in BACKEND_ERROR_MAPPING;
}

/**
 * Gets retry configuration for backend error type
 */
export function getBackendRetryConfig(errorType: ErrorType) {
  return BACKEND_RETRY_CONFIG[errorType] || {
    maxAttempts: 2,
    baseDelay: 2000,
    backoffMultiplier: 2,
  };
}