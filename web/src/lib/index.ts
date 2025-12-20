/**
 * Foundation Layer Main Exports
 * 
 * Main entry point for the frontend foundation layer.
 * Exports all modules and utilities for easy consumption.
 * 
 * Note: Using explicit re-exports to avoid naming conflicts
 */

// Foundation Layer Initialization and Providers
export * from './foundation';
export * from './providers';

// GraphQL Client - explicit exports to avoid conflicts
export {
  apolloClient,
  createApolloClient,
  GraphQLProvider,
  useGraphQLClient,
  // Avoid re-exporting conflicting names: tokenManager, SubscriptionOptions, cacheHelpers, MutationResult, QueryResult, SubscriptionResult
} from './graphql';

// Authentication System - explicit exports to avoid conflicts  
export {
  AuthProvider,
  useAuth,
  useAuthState,
  AuthGuard,
  ProtectedRoute,
  // Avoid re-exporting conflicting names: tokenManager, UserRole, SecureTokenStorage
} from './auth';

// Real-time Subscriptions - explicit exports to avoid conflicts
export {
  SubscriptionProvider,
  useSubscription,
  useSubscriptionState,
  // Avoid re-exporting conflicting names: SubscriptionOptions, CacheInvalidationConfig
} from './subscriptions';

// File Upload System - explicit exports to avoid conflicts
export {
  UploadProvider,
  useFileUpload,
  useVideoUpload,
  useUploadQueue,
  useUploadProgress,
  FileValidator,
  UploadProgressCalculator,
  UploadErrorHandler,
  UploadUtils,
  UploadQueue,
  // Avoid re-exporting conflicting names: ValidationOptions, FileValidationResult, FileValidator
} from './uploads';

// Cache Management - explicit exports to avoid conflicts
export {
  CacheProvider,
  useCacheManager,
  // Avoid re-exporting conflicting names: cacheHelpers, CacheInvalidationConfig
} from './cache';

// Error Handling and Recovery System
export * from './errors';

// Utility Functions and Formatters - explicit exports to avoid conflicts
export {
  // Formatters
  formatDate,
  formatRelativeDate,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatFileSize,
  
  // Validators
  validateField,
  validateForm,
  createValidator,
  
  // Performance
  debounce,
  throttle,
  memoize,
  
  // Common utilities
  generateId,
  generateUUID,
  deepClone,
  deepEqual,
  capitalize,
  truncate,
  
  // Avoid re-exporting conflicting names: Course, Enrollment, Lesson, ValidationRule, validateField, validateForm, PerformanceMetrics
} from './utils';

// Type System and Guards - explicit exports to avoid conflicts
export {
  // Type guards
  isUser,
  isCourse,
  isEnrollment,
  isLesson,
  
  // Utility types (non-conflicting ones)
  DeepPartial,
  DeepRequired,
  NonNullable,
  PartialBy,
  RequiredBy,
  
  // Avoid re-exporting conflicting names: UserRole, MutationResult, QueryResult, SubscriptionResult, Course, Enrollment, Lesson, Message
} from './types';

// Form Integration - explicit exports to avoid conflicts
export {
  FormProvider,
  useForm,
  useFormField,
  FormField,
  FormButton,
  // Avoid re-exporting conflicting names: ValidationRule, validateField, validateForm, getUserFriendlyErrorMessage
} from './forms';

// Runtime Validation - explicit exports to avoid conflicts
export {
  validateGraphQLResponse,
  createRuntimeValidator,
  // Avoid re-exporting conflicting names: getUserFriendlyErrorMessage, validateConnection, ValidationOptions
} from './validation';

// State Management Patterns - explicit exports to avoid conflicts
export {
  StateProvider,
  useAppState,
  useStateManager,
  // Avoid re-exporting conflicting names: Message
} from './state';

// Security Implementation - explicit exports to avoid conflicts
export {
  SecurityProvider,
  useSecurityContext,
  // Avoid re-exporting conflicting names: SecureTokenStorage, FileValidationResult, FileValidator
} from './security';

// Performance Optimization - explicit exports to avoid conflicts
export {
  PerformanceProvider,
  usePerformanceMonitor,
  // Avoid re-exporting conflicting names: PerformanceMetrics
} from './performance';

// Configuration
export * from './config';