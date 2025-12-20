/**
 * Form Type Integration
 * 
 * Provides form input types that match GraphQL mutation inputs exactly,
 * form validation schema from GraphQL types, and type-safe form utilities.
 * 
 * Requirements: 2.5 - Form input types matching GraphQL mutations
 */

import type {
  User,
  Course,
  Lesson,
  Quiz,
  Assignment,
  CreateCourseInput,
  UpdateCourseInput,
  UpdateProfileInput,
  UpdateNotificationPreferencesInput,
  EnrollInCourseInput,
  UpdateLessonProgressInput,
  FileUploadInput,
  VideoUploadInput,
  StartQuizInput,
  SubmitQuizAnswerInput,
  SubmitAssignmentInput,
  GradeAssignmentInput,
  SendMessageInput,
  CreateThreadInput,
  ReplyToThreadInput,
  LessonType,
  QuestionType
} from '@/types/entities';

import type {
  FormInput,
  FormFieldState,
  FormState,
  FormErrors,
  FormSubmissionState
} from '@/lib/types/utilityTypes';

// Re-export commonly used types for easier access
export type { FormErrors, FormSubmissionState } from '@/lib/types/utilityTypes';

// =============================================================================
// Form Input Types Matching GraphQL Mutations
// =============================================================================

/**
 * User profile form input
 */
export type ProfileFormInput = FormInput<UpdateProfileInput>;

/**
 * Notification preferences form input
 */
export type NotificationPreferencesFormInput = FormInput<UpdateNotificationPreferencesInput>;

/**
 * Course creation form input
 */
export type CourseCreationFormInput = FormInput<CreateCourseInput> & {
  // Additional form-specific fields
  thumbnailFile?: File | null;
  modules?: ModuleFormInput[];
};

/**
 * Course update form input
 */
export type CourseUpdateFormInput = FormInput<UpdateCourseInput> & {
  id: string; // Required for updates
  // Additional form-specific fields
  thumbnailFile?: File | null;
  modules?: ModuleFormInput[];
};

/**
 * Module form input
 */
export type ModuleFormInput = {
  id?: string;
  title: string;
  description: string;
  orderIndex: number;
  lessons?: LessonFormInput[];
};

/**
 * Lesson form input
 */
export type LessonFormInput = {
  id?: string;
  title: string;
  description: string;
  type: LessonType;
  content?: string;
  videoFile?: File | null;
  videoUrl?: string;
  duration?: number;
  orderIndex: number;
  quiz?: QuizFormInput;
  assignment?: AssignmentFormInput;
};

/**
 * Quiz form input
 */
export type QuizFormInput = {
  id?: string;
  title: string;
  description: string;
  timeLimit?: number;
  maxAttempts: number;
  passingScore: number;
  questions?: QuestionFormInput[];
};

/**
 * Question form input
 */
export type QuestionFormInput = {
  id?: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  orderIndex: number;
};

/**
 * Assignment form input
 */
export type AssignmentFormInput = {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  dueDate?: string; // ISO date string for form handling
  maxPoints: number;
  allowedFileTypes?: string[];
  maxFileSize?: number;
};

/**
 * Enrollment form input
 */
export type EnrollmentFormInput = FormInput<EnrollInCourseInput>;

/**
 * Lesson progress form input
 */
export type LessonProgressFormInput = FormInput<UpdateLessonProgressInput> & {
  lastAccessedAt?: string; // ISO date string
  completedAt?: string; // ISO date string
};

/**
 * File upload form input
 */
export type FileUploadFormInput = FormInput<FileUploadInput> & {
  file: File;
  uploadProgress?: number;
};

/**
 * Video upload form input
 */
export type VideoUploadFormInput = FormInput<VideoUploadInput> & {
  file: File;
  uploadProgress?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
};

/**
 * Quiz start form input
 */
export type QuizStartFormInput = FormInput<StartQuizInput>;

/**
 * Quiz answer form input
 */
export type QuizAnswerFormInput = FormInput<SubmitQuizAnswerInput>;

/**
 * Assignment submission form input
 */
export type AssignmentSubmissionFormInput = FormInput<SubmitAssignmentInput> & {
  files?: File[];
};

/**
 * Assignment grading form input
 */
export type AssignmentGradingFormInput = FormInput<GradeAssignmentInput>;

/**
 * Message form input
 */
export type MessageFormInput = FormInput<SendMessageInput> & {
  attachmentFiles?: File[];
};

/**
 * Discussion thread form input
 */
export type ThreadFormInput = FormInput<CreateThreadInput>;

/**
 * Thread reply form input
 */
export type ThreadReplyFormInput = FormInput<ReplyToThreadInput>;

/**
 * Login form input
 */
export type LoginFormInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

/**
 * Registration form input
 */
export type RegistrationFormInput = {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  role: 'STUDENT' | 'EDUCATOR';
  acceptTerms: boolean;
};

/**
 * Password reset form input
 */
export type PasswordResetFormInput = {
  email: string;
};

/**
 * Password change form input
 */
export type PasswordChangeFormInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// =============================================================================
// Form State Types
// =============================================================================

/**
 * Profile form state
 */
export type ProfileFormState = FormState<ProfileFormInput>;

/**
 * Course creation form state
 */
export type CourseCreationFormState = FormState<CourseCreationFormInput>;

/**
 * Course update form state
 */
export type CourseUpdateFormState = FormState<CourseUpdateFormInput>;

/**
 * Lesson form state
 */
export type LessonFormState = FormState<LessonFormInput>;

/**
 * Quiz form state
 */
export type QuizFormState = FormState<QuizFormInput>;

/**
 * Assignment form state
 */
export type AssignmentFormState = FormState<AssignmentFormInput>;

/**
 * Login form state
 */
export type LoginFormState = FormState<LoginFormInput>;

/**
 * Registration form state
 */
export type RegistrationFormState = FormState<RegistrationFormInput>;

// =============================================================================
// Form Validation Schema Types
// =============================================================================

/**
 * Validation rule type
 */
export type ValidationRule<T> = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T, formData?: Record<string, unknown>) => string | null;
  message?: string | undefined;
};

/**
 * Validation schema for a form
 */
export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

/**
 * Profile validation schema
 */
export type ProfileValidationSchema = ValidationSchema<ProfileFormInput>;

/**
 * Course validation schema
 */
export type CourseValidationSchema = ValidationSchema<CourseCreationFormInput>;

/**
 * Lesson validation schema
 */
export type LessonValidationSchema = ValidationSchema<LessonFormInput>;

/**
 * Quiz validation schema
 */
export type QuizValidationSchema = ValidationSchema<QuizFormInput>;

/**
 * Assignment validation schema
 */
export type AssignmentValidationSchema = ValidationSchema<AssignmentFormInput>;

/**
 * Login validation schema
 */
export type LoginValidationSchema = ValidationSchema<LoginFormInput>;

/**
 * Registration validation schema
 */
export type RegistrationValidationSchema = ValidationSchema<RegistrationFormInput>;

// =============================================================================
// Form Configuration Types
// =============================================================================

/**
 * Form field configuration
 */
export type FormFieldConfig<T> = {
  name: keyof T;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date' | 'datetime-local';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: ValidationRule<T[keyof T]>;
  disabled?: boolean;
  hidden?: boolean;
  autoComplete?: string;
  accept?: string; // For file inputs
  multiple?: boolean; // For file inputs
};

/**
 * Form configuration
 */
export type FormConfig<T> = {
  fields: FormFieldConfig<T>[];
  submitText?: string;
  resetText?: string;
  cancelText?: string;
  showReset?: boolean;
  showCancel?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
};

// =============================================================================
// Form Hook Types
// =============================================================================

/**
 * Form hook options
 */
export type FormHookOptions<T> = {
  initialValues?: Partial<T>;
  validationSchema?: ValidationSchema<T>;
  onSubmit: (values: T) => Promise<void>;
  onReset?: () => void;
  onCancel?: () => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
};

/**
 * Form hook return type
 */
export type FormHookReturn<T> = {
  values: T;
  errors: FormErrors<T>;
  touched: Record<keyof T, boolean>;
  dirty: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isValid: boolean;
  submitCount: number;
  
  // Field methods
  setValue: (field: keyof T, value: T[keyof T]) => void;
  setError: (field: keyof T, error: string) => void;
  setTouched: (field: keyof T, touched?: boolean) => void;
  
  // Form methods
  handleChange: (field: keyof T) => (value: T[keyof T]) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleReset: () => void;
  
  // Validation methods
  validateField: (field: keyof T) => Promise<string | null>;
  validateForm: () => Promise<FormErrors<T>>;
  
  // Utility methods
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: FormErrors<T>) => void;
  resetForm: () => void;
  clearErrors: () => void;
};

// =============================================================================
// Form Component Props Types
// =============================================================================

/**
 * Base form component props
 */
export type BaseFormProps<T> = {
  initialValues?: Partial<T>;
  validationSchema?: ValidationSchema<T>;
  onSubmit: (values: T) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Form field component props
 */
export type FormFieldProps<T> = {
  name: keyof T;
  label: string;
  value: T[keyof T];
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  onChange: (value: T[keyof T]) => void;
  onBlur: () => void;
  className?: string;
} & Omit<FormFieldConfig<T>, 'name' | 'label' | 'validation'>;

/**
 * Form button props
 */
export type FormButtonProps = {
  type?: 'submit' | 'reset' | 'button';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
};

// =============================================================================
// Specific Form Component Props
// =============================================================================

/**
 * Profile form props
 */
export type ProfileFormProps = BaseFormProps<ProfileFormInput> & {
  user?: User;
  showAvatarUpload?: boolean;
};

/**
 * Course form props
 */
export type CourseFormProps = BaseFormProps<CourseCreationFormInput> & {
  course?: Course;
  mode: 'create' | 'edit';
  showAdvancedOptions?: boolean;
};

/**
 * Lesson form props
 */
export type LessonFormProps = BaseFormProps<LessonFormInput> & {
  lesson?: Lesson;
  courseId: string;
  moduleId: string;
  mode: 'create' | 'edit';
};

/**
 * Quiz form props
 */
export type QuizFormProps = BaseFormProps<QuizFormInput> & {
  quiz?: Quiz;
  lessonId: string;
  mode: 'create' | 'edit';
};

/**
 * Assignment form props
 */
export type AssignmentFormProps = BaseFormProps<AssignmentFormInput> & {
  assignment?: Assignment;
  lessonId: string;
  mode: 'create' | 'edit';
};

/**
 * Login form props
 */
export type LoginFormProps = BaseFormProps<LoginFormInput> & {
  redirectTo?: string;
  showRememberMe?: boolean;
  showForgotPassword?: boolean;
};

/**
 * Registration form props
 */
export type RegistrationFormProps = BaseFormProps<RegistrationFormInput> & {
  redirectTo?: string;
  showTermsLink?: boolean;
  allowRoleSelection?: boolean;
};

// =============================================================================
// Form Utility Types
// =============================================================================

/**
 * Form field value type
 */
export type FormFieldValue = string | number | boolean | File | Date | null | undefined;

/**
 * Form change event
 */
export type FormChangeEvent<T> = {
  field: keyof T;
  value: T[keyof T];
  previousValue: T[keyof T];
};

/**
 * Form submission event
 */
export type FormSubmissionEvent<T> = {
  values: T;
  isValid: boolean;
  errors: FormErrors<T>;
};

/**
 * Form validation event
 */
export type FormValidationEvent<T> = {
  field?: keyof T;
  errors: FormErrors<T>;
  isValid: boolean;
};

/**
 * Auto-save event
 */
export type AutoSaveEvent<T> = {
  values: T;
  changedFields: (keyof T)[];
  timestamp: Date;
};