/**
 * GraphQL Response Validation
 * 
 * Provides validation utilities specifically for GraphQL responses,
 * including Apollo Client integration and error handling.
 * 
 * Requirements: 8.4 - Runtime validation for GraphQL responses
 */

import { ApolloQueryResult, FetchResult } from '@apollo/client';
import { z } from 'zod';
import {
  validateGraphQLResponse,
  safeValidateGraphQLResponse,
  devTypeWarning,
  UserSchema,
  CourseSchema,
  EnrollmentSchema,
  LessonSchema,
  MessageSchema,
  ConnectionSchema
} from './runtimeValidation';

// =============================================================================
// GraphQL Response Validation Types
// =============================================================================

/**
 * Validated query result
 */
export type ValidatedQueryResult<T> = {
  data: T;
  loading: boolean;
  error?: Error | undefined;
  networkStatus: number;
};

/**
 * Validated mutation result
 */
export type ValidatedMutationResult<T> = {
  data?: T | undefined;
  errors?: readonly unknown[] | undefined;
};

/**
 * Validation options
 */
export type ValidationOptions = {
  strict?: boolean;
  warnOnly?: boolean;
  operationName?: string;
  fallback?: unknown;
};

// =============================================================================
// Apollo Client Integration
// =============================================================================

/**
 * Validate Apollo query result
 */
export function validateQueryResult<T>(
  result: ApolloQueryResult<unknown>,
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
): ValidatedQueryResult<T> {
  const { strict = true, warnOnly = false, operationName, fallback } = options;

  if (result.error) {
    return {
      data: fallback as T,
      loading: result.loading,
      error: result.error,
      networkStatus: result.networkStatus
    };
  }

  if (!result.data) {
    if (strict && !warnOnly) {
      throw new Error(`No data received from GraphQL query${operationName ? ` ${operationName}` : ''}`);
    }
    
    devTypeWarning(`No data received from GraphQL query${operationName ? ` ${operationName}` : ''}`);
    
    return {
      data: fallback as T,
      loading: result.loading,
      error: result.error,
      networkStatus: result.networkStatus
    };
  }

  let validatedData: T;
  
  if (warnOnly || fallback !== undefined) {
    validatedData = safeValidateGraphQLResponse(result.data, schema, fallback as T, operationName);
  } else {
    validatedData = validateGraphQLResponse(result.data, schema, operationName);
  }

  return {
    data: validatedData,
    loading: result.loading,
    error: result.error || undefined,
    networkStatus: result.networkStatus
  };
}

/**
 * Validate Apollo mutation result
 */
export function validateMutationResult<T>(
  result: FetchResult<unknown>,
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
): ValidatedMutationResult<T> {
  const { strict = true, warnOnly = false, operationName, fallback } = options;

  if (result.errors && result.errors.length > 0) {
    return {
      data: fallback as T,
      errors: result.errors
    };
  }

  if (!result.data) {
    if (strict && !warnOnly) {
      throw new Error(`No data received from GraphQL mutation${operationName ? ` ${operationName}` : ''}`);
    }
    
    devTypeWarning(`No data received from GraphQL mutation${operationName ? ` ${operationName}` : ''}`);
    
    return {
      data: fallback as T,
      errors: result.errors
    };
  }

  let validatedData: T;
  
  if (warnOnly || fallback !== undefined) {
    validatedData = safeValidateGraphQLResponse(result.data, schema, fallback as T, operationName);
  } else {
    validatedData = validateGraphQLResponse(result.data, schema, operationName);
  }

  return {
    data: validatedData,
    errors: result.errors || undefined
  };
}

// =============================================================================
// Specific GraphQL Operation Validators
// =============================================================================

/**
 * Validate user query result
 */
export function validateUserQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ user: unknown }> {
  const schema = z.object({
    user: UserSchema
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetUser'
  });
}

/**
 * Validate current user query result
 */
export function validateCurrentUserQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ currentUser: unknown }> {
  const schema = z.object({
    currentUser: UserSchema.nullable()
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetCurrentUser'
  });
}

/**
 * Validate courses query result
 */
export function validateCoursesQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ courses: unknown }> {
  const schema = z.object({
    courses: ConnectionSchema(CourseSchema)
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetCourses'
  });
}

/**
 * Validate course query result
 */
export function validateCourseQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ course: unknown }> {
  const schema = z.object({
    course: CourseSchema
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetCourse'
  });
}

/**
 * Validate enrollments query result
 */
export function validateEnrollmentsQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ enrollments: unknown }> {
  const schema = z.object({
    enrollments: ConnectionSchema(EnrollmentSchema)
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetEnrollments'
  });
}

/**
 * Validate lessons query result
 */
export function validateLessonsQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ lessons: unknown }> {
  const schema = z.object({
    lessons: z.array(LessonSchema)
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetLessons'
  });
}

/**
 * Validate messages query result
 */
export function validateMessagesQuery(
  result: ApolloQueryResult<unknown>,
  options: ValidationOptions = {}
): ValidatedQueryResult<{ messages: unknown }> {
  const schema = z.object({
    messages: ConnectionSchema(MessageSchema)
  });
  
  return validateQueryResult(result, schema, {
    ...options,
    operationName: options.operationName || 'GetMessages'
  });
}

// =============================================================================
// Mutation Result Validators
// =============================================================================

/**
 * Validate login mutation result
 */
export function validateLoginMutation(
  result: FetchResult<unknown>,
  options: ValidationOptions = {}
): ValidatedMutationResult<{ login: unknown }> {
  const schema = z.object({
    login: z.object({
      user: UserSchema,
      accessToken: z.string(),
      refreshToken: z.string()
    })
  });
  
  return validateMutationResult(result, schema, {
    ...options,
    operationName: options.operationName || 'Login'
  });
}

/**
 * Validate create course mutation result
 */
export function validateCreateCourseMutation(
  result: FetchResult<unknown>,
  options: ValidationOptions = {}
): ValidatedMutationResult<{ createCourse: unknown }> {
  const schema = z.object({
    createCourse: CourseSchema
  });
  
  return validateMutationResult(result, schema, {
    ...options,
    operationName: options.operationName || 'CreateCourse'
  });
}

/**
 * Validate update course mutation result
 */
export function validateUpdateCourseMutation(
  result: FetchResult<unknown>,
  options: ValidationOptions = {}
): ValidatedMutationResult<{ updateCourse: unknown }> {
  const schema = z.object({
    updateCourse: CourseSchema
  });
  
  return validateMutationResult(result, schema, {
    ...options,
    operationName: options.operationName || 'UpdateCourse'
  });
}

/**
 * Validate enroll in course mutation result
 */
export function validateEnrollInCourseMutation(
  result: FetchResult<unknown>,
  options: ValidationOptions = {}
): ValidatedMutationResult<{ enrollInCourse: unknown }> {
  const schema = z.object({
    enrollInCourse: EnrollmentSchema
  });
  
  return validateMutationResult(result, schema, {
    ...options,
    operationName: options.operationName || 'EnrollInCourse'
  });
}

/**
 * Validate send message mutation result
 */
export function validateSendMessageMutation(
  result: FetchResult<unknown>,
  options: ValidationOptions = {}
): ValidatedMutationResult<{ sendMessage: unknown }> {
  const schema = z.object({
    sendMessage: MessageSchema
  });
  
  return validateMutationResult(result, schema, {
    ...options,
    operationName: options.operationName || 'SendMessage'
  });
}

// =============================================================================
// Subscription Result Validators
// =============================================================================

/**
 * Validate subscription result
 */
export function validateSubscriptionResult<T>(
  data: unknown,
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
): T | null {
  const { warnOnly = true, operationName, fallback = null } = options;

  if (!data) {
    devTypeWarning(`No data received from GraphQL subscription${operationName ? ` ${operationName}` : ''}`);
    return fallback as T | null;
  }

  if (warnOnly) {
    return safeValidateGraphQLResponse(data, schema, fallback as T, operationName);
  } else {
    return validateGraphQLResponse(data, schema, operationName);
  }
}

/**
 * Validate message updates subscription
 */
export function validateMessageUpdatesSubscription(
  data: unknown,
  options: ValidationOptions = {}
): unknown | null {
  const schema = z.object({
    messageUpdates: MessageSchema
  });
  
  const result = validateSubscriptionResult(data, schema, {
    ...options,
    operationName: options.operationName || 'MessageUpdates'
  });
  
  return result ? (result as { messageUpdates: unknown }).messageUpdates : null;
}

/**
 * Validate progress updates subscription
 */
export function validateProgressUpdatesSubscription(
  data: unknown,
  options: ValidationOptions = {}
): { enrollmentId: string; progressPercentage: number } | null {
  const schema = z.object({
    progressUpdates: z.object({
      enrollmentId: z.string(),
      progressPercentage: z.number().min(0).max(100)
    })
  });
  
  const result = validateSubscriptionResult(data, schema, {
    ...options,
    operationName: options.operationName || 'ProgressUpdates'
  });
  
  return result ? (result as { progressUpdates: { enrollmentId: string; progressPercentage: number } }).progressUpdates : null;
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

/**
 * Extract validation errors from Apollo error
 */
export function extractValidationErrors(error: Error & { graphQLErrors?: Array<{ extensions?: { code?: string; fieldErrors?: Record<string, string> } }> }): Record<string, string> {
  const validationErrors: Record<string, string> = {};
  
  if (error.graphQLErrors) {
    for (const graphQLError of error.graphQLErrors) {
      if (graphQLError.extensions?.code === 'VALIDATION_ERROR') {
        const fieldErrors = graphQLError.extensions?.fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object') {
          Object.assign(validationErrors, fieldErrors);
        }
      }
    }
  }
  
  return validationErrors;
}

/**
 * Check if Apollo error is a validation error
 */
export function isValidationError(error: Error & { graphQLErrors?: Array<{ extensions?: { code?: string } }> }): boolean {
  return error.graphQLErrors?.some(
    err => err.extensions?.code === 'VALIDATION_ERROR'
  ) || false;
}

/**
 * Check if Apollo error is an authentication error
 */
export function isAuthenticationError(error: Error & { graphQLErrors?: Array<{ extensions?: { code?: string } }> }): boolean {
  return error.graphQLErrors?.some(
    err => err.extensions?.code === 'UNAUTHENTICATED'
  ) || false;
}

/**
 * Check if Apollo error is an authorization error
 */
export function isAuthorizationError(error: Error & { graphQLErrors?: Array<{ extensions?: { code?: string } }> }): boolean {
  return error.graphQLErrors?.some(
    err => err.extensions?.code === 'FORBIDDEN'
  ) || false;
}

/**
 * Get user-friendly error message from Apollo error
 */
export function getUserFriendlyErrorMessage(error: Error & { 
  networkError?: Error; 
  graphQLErrors?: Array<{ 
    message: string; 
    extensions?: { 
      code?: string; 
      fieldErrors?: Record<string, string> 
    } 
  }> 
}): string {
  if (isValidationError(error)) {
    return 'Please check your input and try again.';
  }
  
  if (isAuthenticationError(error)) {
    return 'Please log in to continue.';
  }
  
  if (isAuthorizationError(error)) {
    return 'You do not have permission to perform this action.';
  }
  
  if (error.networkError) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    return error.graphQLErrors[0]?.message || 'GraphQL error occurred';
  }
  
  return 'An unexpected error occurred. Please try again.';
}

// =============================================================================
// Development Utilities
// =============================================================================

/**
 * Log GraphQL operation for debugging
 */
export function logGraphQLOperation(
  operationName: string,
  variables?: unknown,
  result?: unknown,
  error?: unknown
): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[GraphQL] ${operationName}`);
    
    if (variables) {
      console.log('Variables:', variables);
    }
    
    if (result) {
      console.log('Result:', result);
    }
    
    if (error) {
      console.error('Error:', error);
    }
    
    console.groupEnd();
  }
}

/**
 * Validate GraphQL operation name
 */
export function validateOperationName(operationName: string): void {
  if (process.env.NODE_ENV === 'development') {
    if (!operationName || typeof operationName !== 'string') {
      devTypeWarning('GraphQL operation name should be a non-empty string');
    }
    
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(operationName)) {
      devTypeWarning(`GraphQL operation name "${operationName}" should start with uppercase and contain only alphanumeric characters`);
    }
  }
}

/**
 * Check for unused variables in GraphQL operation
 */
export function checkUnusedVariables(
  variables: Record<string, unknown>,
  usedVariables: string[]
): void {
  if (process.env.NODE_ENV === 'development') {
    const unusedVariables = Object.keys(variables).filter(
      key => !usedVariables.includes(key)
    );
    
    if (unusedVariables.length > 0) {
      devTypeWarning(`Unused GraphQL variables: ${unusedVariables.join(', ')}`);
    }
  }
}