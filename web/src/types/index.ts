/**
 * Type Definitions
 * 
 * Generated GraphQL types and custom frontend types.
 * This file exports all types used throughout the foundation layer.
 */

// Re-export generated GraphQL types
export * from './schema';

// Re-export domain entity types
export * from './entities';

// Re-export form types when available
// export * from './forms';

// Custom frontend types
export interface FoundationConfig {
  graphqlEndpoint: string;
  wsEndpoint: string;
  enableDevTools: boolean;
}

export interface ErrorContext {
  operation: string;
  variables?: any;
  user?: any;
  requestId: string;
}

// Authentication types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Hook result types
export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any | undefined;
  refetch: () => Promise<any>;
  fetchMore?: (options: any) => Promise<any>;
}

export interface MutationResult<T> {
  mutate: (variables?: any) => Promise<T>;
  loading: boolean;
  error: any | undefined;
  reset: () => void;
}

export interface SubscriptionResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any | undefined;
}

// Upload types
export interface UploadProgress {
  uploadId: string;
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
  status: UploadStatus;
}

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface UploadOptions {
  courseId?: string;
  lessonId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: UploadError) => void;
}

export interface UploadError {
  code: string;
  message: string;
  uploadId: string;
}

// Cache types
export interface CacheUpdateOptions {
  optimistic?: boolean;
  refetchQueries?: string[];
  awaitRefetchQueries?: boolean;
}

// Connection status for subscriptions
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

// Error classification
export type ErrorType = 
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR' 
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UPLOAD_ERROR'
  | 'UNKNOWN_ERROR';

export interface ClassifiedError {
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  field?: string;
  retryable: boolean;
}

// Performance monitoring
export interface PerformanceMetrics {
  requestDuration: number;
  cacheHitRate: number;
  errorRate: number;
  activeSubscriptions: number;
}

// User type is now imported from entities.ts