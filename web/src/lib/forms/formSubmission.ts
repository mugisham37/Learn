/**
 * Type-Safe Form Submission Utilities
 * 
 * Provides type-safe form submission utilities with error handling,
 * GraphQL mutation integration, and optimistic updates.
 * 
 * Requirements: 2.5 - Type-safe form submission utilities
 */

import type { ApolloError, MutationResult } from '@apollo/client';
import type {
  FormErrors,
  FormSubmissionState,
  ProfileFormInput,
  CourseCreationFormInput,
  CourseUpdateFormInput,
  LessonFormInput,
  QuizFormInput,
  AssignmentFormInput,
  LoginFormInput,
  RegistrationFormInput,
  MessageFormInput,
  ThreadFormInput,
  ThreadReplyFormInput
} from './formTypes';

import { validateForm, serverErrorsToFormErrors } from './formValidation';
import type { ValidationSchema } from './formTypes';

// =============================================================================
// Form Submission Types
// =============================================================================

/**
 * Form submission options
 */
export type FormSubmissionOptions<T> = {
  validationSchema?: ValidationSchema<T>;
  onSuccess?: (data: any) => void;
  onError?: (error: FormSubmissionError) => void;
  optimisticUpdate?: boolean;
  showSuccessMessage?: boolean;
  showErrorMessage?: boolean;
  redirectOnSuccess?: string;
};

/**
 * Form submission error
 */
export type FormSubmissionError = {
  type: 'validation' | 'network' | 'server' | 'unknown';
  message: string;
  fieldErrors?: Record<string, string>;
  originalError?: Error;
};

/**
 * Form submission result
 */
export type FormSubmissionResult<T> = {
  success: boolean;
  data?: T;
  errors?: FormErrors<any>;
  error?: FormSubmissionError;
};

/**
 * Mutation function type
 */
export type MutationFunction<TData, TVariables> = (options?: {
  variables?: TVariables;
  optimisticResponse?: TData;
  update?: (cache: any, result: { data?: TData }) => void;
}) => Promise<{ data?: TData }>;

// =============================================================================
// Form Submission Utilities
// =============================================================================

/**
 * Create a type-safe form submission handler
 */
export function createFormSubmissionHandler<TFormData, TMutationData, TMutationVariables>(
  mutationFn: MutationFunction<TMutationData, TMutationVariables>,
  transformFormData: (formData: TFormData) => TMutationVariables,
  options: FormSubmissionOptions<TFormData> = {}
) {
  return async (
    formData: TFormData,
    submissionState: FormSubmissionState
  ): Promise<FormSubmissionResult<TMutationData>> => {
    try {
      // Validate form data if schema provided
      if (options.validationSchema) {
        const validationErrors = await validateForm(formData, options.validationSchema);
        if (Object.keys(validationErrors).length > 0) {
          const error: FormSubmissionError = {
            type: 'validation',
            message: 'Please fix the validation errors',
            fieldErrors: validationErrors as Record<string, string>
          };
          
          if (options.onError) {
            options.onError(error);
          }
          
          return {
            success: false,
            errors: validationErrors,
            error
          };
        }
      }

      // Transform form data to mutation variables
      const variables = transformFormData(formData);

      // Execute mutation
      const result = await mutationFn({
        variables,
        optimisticResponse: options.optimisticUpdate ? createOptimisticResponse(formData) : undefined
      });

      // Handle success
      if (result.data) {
        if (options.onSuccess) {
          options.onSuccess(result.data);
        }
        
        return {
          success: true,
          data: result.data
        };
      }

      // Handle unexpected empty result
      const error: FormSubmissionError = {
        type: 'unknown',
        message: 'Unexpected empty response from server'
      };
      
      if (options.onError) {
        options.onError(error);
      }
      
      return {
        success: false,
        error
      };

    } catch (err) {
      // Handle different types of errors
      const error = handleSubmissionError(err);
      
      if (options.onError) {
        options.onError(error);
      }
      
      return {
        success: false,
        error,
        errors: error.fieldErrors
      };
    }
  };
}

/**
 * Handle form submission errors
 */
function handleSubmissionError(err: any): FormSubmissionError {
  // GraphQL/Apollo errors
  if (err.networkError) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection and try again.',
      originalError: err
    };
  }

  if (err.graphQLErrors && err.graphQLErrors.length > 0) {
    const graphQLError = err.graphQLErrors[0];
    
    // Check for validation errors
    if (graphQLError.extensions?.code === 'VALIDATION_ERROR') {
      const fieldErrors = graphQLError.extensions?.fieldErrors || {};
      return {
        type: 'validation',
        message: 'Please fix the validation errors',
        fieldErrors,
        originalError: err
      };
    }
    
    // Other GraphQL errors
    return {
      type: 'server',
      message: graphQLError.message || 'Server error occurred',
      originalError: err
    };
  }

  // Generic errors
  if (err instanceof Error) {
    return {
      type: 'unknown',
      message: err.message || 'An unexpected error occurred',
      originalError: err
    };
  }

  // Fallback
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    originalError: err
  };
}

/**
 * Create optimistic response for mutations
 */
function createOptimisticResponse<T>(formData: T): any {
  // This is a generic implementation - specific forms may need custom logic
  return {
    __typename: 'Mutation',
    ...formData,
    id: `temp-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// =============================================================================
// Specific Form Submission Handlers
// =============================================================================

/**
 * Profile form submission handler
 */
export function createProfileSubmissionHandler(
  updateProfileMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<ProfileFormInput> = {}
) {
  return createFormSubmissionHandler(
    updateProfileMutation,
    (formData: ProfileFormInput) => ({
      input: {
        fullName: formData.fullName,
        bio: formData.bio,
        timezone: formData.timezone,
        language: formData.language,
        avatarUrl: formData.avatarUrl
      }
    }),
    options
  );
}

/**
 * Course creation form submission handler
 */
export function createCourseCreationSubmissionHandler(
  createCourseMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<CourseCreationFormInput> = {}
) {
  return createFormSubmissionHandler(
    createCourseMutation,
    (formData: CourseCreationFormInput) => ({
      input: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        difficulty: formData.difficulty,
        price: formData.price,
        currency: formData.currency,
        enrollmentLimit: formData.enrollmentLimit,
        thumbnailUrl: formData.thumbnailUrl
      }
    }),
    options
  );
}

/**
 * Course update form submission handler
 */
export function createCourseUpdateSubmissionHandler(
  updateCourseMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<CourseUpdateFormInput> = {}
) {
  return createFormSubmissionHandler(
    updateCourseMutation,
    (formData: CourseUpdateFormInput) => ({
      id: formData.id,
      input: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        difficulty: formData.difficulty,
        price: formData.price,
        currency: formData.currency,
        enrollmentLimit: formData.enrollmentLimit,
        thumbnailUrl: formData.thumbnailUrl
      }
    }),
    options
  );
}

/**
 * Lesson form submission handler
 */
export function createLessonSubmissionHandler(
  createOrUpdateLessonMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<LessonFormInput> = {}
) {
  return createFormSubmissionHandler(
    createOrUpdateLessonMutation,
    (formData: LessonFormInput) => ({
      input: {
        id: formData.id,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        content: formData.content,
        videoUrl: formData.videoUrl,
        duration: formData.duration,
        orderIndex: formData.orderIndex
      }
    }),
    options
  );
}

/**
 * Quiz form submission handler
 */
export function createQuizSubmissionHandler(
  createOrUpdateQuizMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<QuizFormInput> = {}
) {
  return createFormSubmissionHandler(
    createOrUpdateQuizMutation,
    (formData: QuizFormInput) => ({
      input: {
        id: formData.id,
        title: formData.title,
        description: formData.description,
        timeLimit: formData.timeLimit,
        maxAttempts: formData.maxAttempts,
        passingScore: formData.passingScore,
        questions: formData.questions?.map(q => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points,
          orderIndex: q.orderIndex
        }))
      }
    }),
    options
  );
}

/**
 * Assignment form submission handler
 */
export function createAssignmentSubmissionHandler(
  createOrUpdateAssignmentMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<AssignmentFormInput> = {}
) {
  return createFormSubmissionHandler(
    createOrUpdateAssignmentMutation,
    (formData: AssignmentFormInput) => ({
      input: {
        id: formData.id,
        title: formData.title,
        description: formData.description,
        instructions: formData.instructions,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        maxPoints: formData.maxPoints,
        allowedFileTypes: formData.allowedFileTypes,
        maxFileSize: formData.maxFileSize
      }
    }),
    options
  );
}

/**
 * Login form submission handler
 */
export function createLoginSubmissionHandler(
  loginMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<LoginFormInput> = {}
) {
  return createFormSubmissionHandler(
    loginMutation,
    (formData: LoginFormInput) => ({
      email: formData.email,
      password: formData.password
    }),
    options
  );
}

/**
 * Registration form submission handler
 */
export function createRegistrationSubmissionHandler(
  registerMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<RegistrationFormInput> = {}
) {
  return createFormSubmissionHandler(
    registerMutation,
    (formData: RegistrationFormInput) => ({
      input: {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role
      }
    }),
    options
  );
}

/**
 * Message form submission handler
 */
export function createMessageSubmissionHandler(
  sendMessageMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<MessageFormInput> = {}
) {
  return createFormSubmissionHandler(
    sendMessageMutation,
    (formData: MessageFormInput) => ({
      input: {
        conversationId: formData.conversationId,
        content: formData.content,
        attachments: formData.attachments
      }
    }),
    options
  );
}

/**
 * Thread creation form submission handler
 */
export function createThreadSubmissionHandler(
  createThreadMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<ThreadFormInput> = {}
) {
  return createFormSubmissionHandler(
    createThreadMutation,
    (formData: ThreadFormInput) => ({
      input: {
        courseId: formData.courseId,
        lessonId: formData.lessonId,
        title: formData.title,
        content: formData.content
      }
    }),
    options
  );
}

/**
 * Thread reply form submission handler
 */
export function createThreadReplySubmissionHandler(
  replyToThreadMutation: MutationFunction<any, any>,
  options: FormSubmissionOptions<ThreadReplyFormInput> = {}
) {
  return createFormSubmissionHandler(
    replyToThreadMutation,
    (formData: ThreadReplyFormInput) => ({
      input: {
        threadId: formData.threadId,
        content: formData.content,
        parentReplyId: formData.parentReplyId
      }
    }),
    options
  );
}

// =============================================================================
// Form Submission State Management
// =============================================================================

/**
 * Create initial form submission state
 */
export function createInitialSubmissionState(): FormSubmissionState {
  return {
    isSubmitting: false,
    isSubmitted: false,
    submitCount: 0,
    errors: {}
  };
}

/**
 * Update form submission state for submission start
 */
export function updateSubmissionStateForStart(
  state: FormSubmissionState
): FormSubmissionState {
  return {
    ...state,
    isSubmitting: true,
    errors: {}
  };
}

/**
 * Update form submission state for submission success
 */
export function updateSubmissionStateForSuccess(
  state: FormSubmissionState
): FormSubmissionState {
  return {
    ...state,
    isSubmitting: false,
    isSubmitted: true,
    submitCount: state.submitCount + 1,
    errors: {}
  };
}

/**
 * Update form submission state for submission error
 */
export function updateSubmissionStateForError(
  state: FormSubmissionState,
  error: FormSubmissionError
): FormSubmissionState {
  return {
    ...state,
    isSubmitting: false,
    isSubmitted: false,
    submitCount: state.submitCount + 1,
    errors: error.fieldErrors || {}
  };
}

/**
 * Reset form submission state
 */
export function resetSubmissionState(): FormSubmissionState {
  return createInitialSubmissionState();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if form can be submitted
 */
export function canSubmitForm<T>(
  values: T,
  errors: FormErrors<T>,
  submissionState: FormSubmissionState
): boolean {
  return (
    !submissionState.isSubmitting &&
    Object.keys(errors).length === 0 &&
    hasRequiredFields(values)
  );
}

/**
 * Check if form has required fields filled
 */
function hasRequiredFields<T>(values: T): boolean {
  // This is a basic implementation - specific forms may need custom logic
  if (!values || typeof values !== 'object') {
    return false;
  }
  
  // Check for common required fields
  const commonRequiredFields = ['title', 'name', 'email'];
  const valueKeys = Object.keys(values);
  
  return commonRequiredFields.some(field => {
    if (valueKeys.includes(field)) {
      const value = (values as any)[field];
      return value != null && value !== '';
    }
    return true; // Field not present, assume not required
  });
}

/**
 * Extract field errors from submission error
 */
export function extractFieldErrors(error: FormSubmissionError): Record<string, string> {
  return error.fieldErrors || {};
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: FormSubmissionError): string {
  switch (error.type) {
    case 'validation':
      return 'Please fix the validation errors and try again.';
    case 'network':
      return 'Network error. Please check your connection and try again.';
    case 'server':
      return error.message || 'Server error occurred. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}