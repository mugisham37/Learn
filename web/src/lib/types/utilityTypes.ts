/**
 * Utility Types for Common Patterns
 * 
 * Provides utility types for common GraphQL and React patterns,
 * including form handling, API responses, and component props.
 * 
 * Requirements: 2.4 - Utility types for common patterns
 */

import type {
  User,
  Course,
  Enrollment,
  Lesson,
  Quiz,
  Assignment,
  Connection,
  Edge
} from '@/types/entities';

// =============================================================================
// Generic Utility Types
// =============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Pick properties that are not null or undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Extract keys that have non-null values
 */
export type NonNullableKeys<T> = {
  [K in keyof T]: T[K] extends null | undefined ? never : K;
}[keyof T];

/**
 * Pick only non-nullable properties
 */
export type NonNullableProps<T> = Pick<T, NonNullableKeys<T>>;

/**
 * Make specific keys optional while keeping others required
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys required while keeping others optional
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Exclude specific keys from a type
 */
export type Except<T, K extends keyof T> = Omit<T, K>;

/**
 * Include only specific keys from a type
 */
export type Only<T, K extends keyof T> = Pick<T, K>;

/**
 * Create a type with all properties as strings (useful for form handling)
 */
export type Stringify<T> = {
  [K in keyof T]: string;
};

/**
 * Create a type where all properties are optional strings
 */
export type OptionalStringify<T> = {
  [K in keyof T]?: string;
};

// =============================================================================
// GraphQL-Specific Utility Types
// =============================================================================

/**
 * Extract the node type from a GraphQL connection
 */
export type ConnectionNode<T> = T extends Connection<infer U> ? U : never;

/**
 * Extract edge type from a GraphQL connection
 */
export type ConnectionEdge<T> = T extends Connection<infer U> ? Edge<U> : never;

/**
 * Type for GraphQL connection variables
 */
export type ConnectionVariables = {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
};

/**
 * Type for GraphQL connection with variables
 */
export type ConnectionWithVariables<T, V = Record<string, unknown>> = {
  connection: Connection<T>;
  variables: V & ConnectionVariables;
};

/**
 * Type for GraphQL mutation result
 */
export type MutationResult<T> = {
  data?: T;
  errors?: Array<{
    message: string;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
};

/**
 * Type for GraphQL query result
 */
export type QueryResult<T> = {
  data?: T;
  loading: boolean;
  error?: Error;
  networkStatus: number;
};

/**
 * Type for GraphQL subscription result
 */
export type SubscriptionResult<T> = {
  data?: T;
  loading: boolean;
  error?: Error;
};

// =============================================================================
// Form and Input Utility Types
// =============================================================================

/**
 * Convert GraphQL input types to form-friendly types
 */
export type FormInput<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | null | undefined
    ? T[K]
    : T[K] extends Date
    ? string
    : T[K] extends File
    ? File | null
    : T[K] extends Array<infer U>
    ? Array<FormInput<U>>
    : T[K] extends object
    ? FormInput<T[K]>
    : T[K];
};

/**
 * Form field state
 */
export type FormFieldState<T> = {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
};

/**
 * Form state for an object
 */
export type FormState<T> = {
  [K in keyof T]: FormFieldState<T[K]>;
};

/**
 * Form validation errors
 */
export type FormErrors<T> = {
  [K in keyof T]?: T[K] extends object ? FormErrors<T[K]> : string;
};

/**
 * Form submission state
 */
export type FormSubmissionState = {
  isSubmitting: boolean;
  isSubmitted: boolean;
  submitCount: number;
  errors: Record<string, string>;
};

// =============================================================================
// API Response Utility Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
};

/**
 * Paginated API response
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

/**
 * Loading state for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Async operation state
 */
export type AsyncState<T, E = Error> = {
  data?: T;
  error?: E;
  loading: boolean;
  state: LoadingState;
};

// =============================================================================
// Component Prop Utility Types
// =============================================================================

/**
 * Extract props from a React component
 */
export type ComponentProps<T> = T extends React.ComponentType<infer P> ? P : never;

/**
 * Make component props optional except for specific keys
 */
export type OptionalExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Props for components that handle loading states
 */
export type LoadingProps = {
  loading?: boolean;
  loadingText?: string;
  loadingComponent?: React.ComponentType;
};

/**
 * Props for components that handle errors
 */
export type ErrorProps = {
  error?: Error | string;
  onRetry?: () => void;
  errorComponent?: React.ComponentType<{ error: Error | string; onRetry?: () => void }>;
};

/**
 * Props for components with async data
 */
export type AsyncProps<T> = LoadingProps & ErrorProps & {
  data?: T;
  onRefresh?: () => void;
};

// =============================================================================
// Domain-Specific Utility Types
// =============================================================================

/**
 * User with specific role constraint
 */
export type UserWithRole<R extends User['role']> = User & { role: R };

/**
 * Course with specific status constraint
 */
export type CourseWithStatus<S extends Course['status']> = Course & { status: S };

/**
 * Enrollment with specific status constraint
 */
export type EnrollmentWithStatus<S extends Enrollment['status']> = Enrollment & { status: S };

/**
 * Lesson with specific type constraint
 */
export type LessonWithType<T extends Lesson['type']> = Lesson & { type: T };

/**
 * Course creation data (omitting generated fields)
 */
export type CourseCreationData = Omit<
  Course,
  'id' | 'instructor' | 'modules' | 'enrollmentCount' | 'averageRating' | 'reviews' | 'createdAt' | 'updatedAt'
>;

/**
 * Course update data (partial with ID required)
 */
export type CourseUpdateData = { id: string } & Partial<CourseCreationData>;

/**
 * User profile update data
 */
export type ProfileUpdateData = Partial<User['profile']>;

/**
 * Lesson content based on type
 */
export type LessonContentByType<T extends Lesson['type']> = T extends 'VIDEO'
  ? { videoUrl: string; duration?: number }
  : T extends 'TEXT'
  ? { content: string }
  : T extends 'QUIZ'
  ? { quiz: Quiz }
  : T extends 'ASSIGNMENT'
  ? { assignment: Assignment }
  : T extends 'INTERACTIVE'
  ? { content?: string }
  : never;

// =============================================================================
// Permission and Access Control Types
// =============================================================================

/**
 * Permission levels for different resources
 */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

/**
 * Resource permissions
 */
export type ResourcePermissions = {
  courses: PermissionLevel;
  enrollments: PermissionLevel;
  assessments: PermissionLevel;
  messages: PermissionLevel;
  users: PermissionLevel;
};

/**
 * Context for permission checking
 */
export type PermissionContext = {
  user: User;
  resource?: {
    type: keyof ResourcePermissions;
    id: string;
    ownerId?: string;
  };
};

// =============================================================================
// Event and Callback Types
// =============================================================================

/**
 * Generic event handler type
 */
export type EventHandler<T = void> = (event: T) => void;

/**
 * Async event handler type
 */
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>;

/**
 * Form event handlers
 */
export type FormEventHandlers<T> = {
  onChange: (field: keyof T, value: T[keyof T]) => void;
  onBlur: (field: keyof T) => void;
  onSubmit: (data: T) => Promise<void>;
  onReset: () => void;
};

/**
 * Data fetching event handlers
 */
export type DataEventHandlers<T> = {
  onLoad: (data: T) => void;
  onError: (error: Error) => void;
  onRefresh: () => void;
};

// =============================================================================
// Utility Functions for Type Manipulation
// =============================================================================

/**
 * Type-safe keys extraction
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Extract function parameter types
 */
export type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;

/**
 * Extract function return type
 */
export type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

/**
 * Extract promise resolved type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Create a branded type for type safety
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Remove brand from branded type
 */
export type Unbrand<T> = T extends Brand<infer U, unknown> ? U : T;

// =============================================================================
// Conditional Types for Complex Logic
// =============================================================================

/**
 * Check if type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if type is any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Check if type is unknown
 */
export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;

/**
 * Get optional keys from a type
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, unknown> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Get required keys from a type
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, unknown> extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Split type into optional and required parts
 */
export type SplitType<T> = {
  optional: Pick<T, OptionalKeys<T>>;
  required: Pick<T, RequiredKeys<T>>;
};

// =============================================================================
// Type Helpers for GraphQL Code Generation
// =============================================================================

/**
 * Input type for GraphQL mutations
 */
export type MutationInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | '__typename'>;

/**
 * Update input type for GraphQL mutations
 */
export type UpdateInput<T> = { id: string } & Partial<MutationInput<T>>;

/**
 * Filter input type for GraphQL queries
 */
export type FilterInput<T> = {
  [K in keyof T]?: T[K] extends string
    ? string | { contains?: string; startsWith?: string; endsWith?: string }
    : T[K] extends number
    ? number | { gt?: number; gte?: number; lt?: number; lte?: number }
    : T[K] extends boolean
    ? boolean
    : T[K] extends Date
    ? Date | { before?: Date; after?: Date }
    : T[K];
};

/**
 * Sort input type for GraphQL queries
 */
export type SortInput<T> = {
  [K in keyof T]?: 'ASC' | 'DESC';
};

/**
 * Search input combining filters, sorting, and pagination
 */
export type SearchInput<T> = {
  filter?: FilterInput<T>;
  sort?: SortInput<T>;
  pagination?: ConnectionVariables;
  search?: string;
};