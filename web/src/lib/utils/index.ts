/**
 * Utility Functions and Formatters
 * 
 * Comprehensive utility library providing data formatting, validation,
 * progress calculations, and performance optimization utilities.
 * 
 * This module serves as the central export point for all utility functions
 * used throughout the frontend foundation layer.
 */

// =============================================================================
// Formatters
// =============================================================================

export {
  // Date formatting
  formatDate,
  formatRelativeDate,
  parseFormattedDate,
  isToday,
  isYesterday,
  startOfDay,
  endOfDay,
  
  // Currency formatting
  formatCurrency,
  parseCurrency,
  
  // Duration formatting
  formatDuration,
  parseDuration,
  
  // Number formatting
  formatNumber,
  formatPercentage,
  formatFileSize,
  
  // Types
  type DateFormatOptions,
  type CurrencyFormatOptions,
  type DurationFormatOptions,
  type NumberFormatOptions,
  
  // Constants
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
} from './formatters';

// =============================================================================
// Validators
// =============================================================================

export {
  // Validation helpers
  validateField,
  validateForm,
  createValidator,
  createFieldValidator,
  hasFieldError,
  getFieldErrors,
  getFieldErrorMessage,
  
  // Sanitization
  sanitizeHtml,
  sanitizeInput,
  escapeHtml,
  
  // Types
  type ValidationResult,
  type ValidationError,
  type ValidationRule,
  type ValidationContext,
  type FormValidationOptions,
  
  // Constants
  VALIDATION_CONSTRAINTS,
} from './validators';

// =============================================================================
// Progress Calculations
// =============================================================================

export {
  // Progress calculators
  calculateCourseProgress,
  calculateModuleProgress,
  calculateLessonCompletionPercentage,
  isLessonCompleted,
  calculateEnrollmentStatistics,
  generateProgressVisualizationData,
  getNextLesson,
  estimateCompletionDate,
  
  // Types
  type CourseProgress,
  type LessonProgress,
  type ModuleProgress,
  type EnrollmentStatistics,
  type ProgressVisualizationData,
  type Course,
  type Module,
  type Lesson,
  type Enrollment,
} from './progress';

// =============================================================================
// Performance Utilities
// =============================================================================

export {
  // Performance optimization
  debounce,
  throttle,
  createRequestDeduplicator,
  measurePerformance,
  measureAsyncPerformance,
  createBatchProcessor,
  
  // Types
  type DebounceOptions,
  type ThrottleOptions,
  type PerformanceMetrics,
} from './performance';

// =============================================================================
// Memoization Utilities
// =============================================================================

export {
  // Memoization utilities from performance module
  memoize,
  memoizeAsync,
  clearMemoizationCaches,
  
  // Types
  type MemoizeOptions,
} from './performance';

// =============================================================================
// Lazy Loading Utilities
// =============================================================================

export {
  // Lazy loading utilities
  createLazyComponent,
} from './lazyLoading';

// =============================================================================
// Common Utilities
// =============================================================================

/**
 * Generates a unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Generates a UUID v4
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Deep clones an object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};

/**
 * Checks if two objects are deeply equal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    
    return true;
  }
  
  return false;
};

/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Converts a string to title case
 */
export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

/**
 * Converts a string to kebab-case
 */
export const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Converts a string to camelCase
 */
export const toCamelCase = (str: string): string => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '');
};

/**
 * Truncates a string to a specified length
 */
export const truncate = (str: string, length: number, suffix = '...'): string => {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
};

/**
 * Removes undefined values from an object
 */
export const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

/**
 * Groups an array of objects by a key
 */
export const groupBy = <T, K extends keyof T>(
  array: T[],
  key: K
): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group]!.push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

/**
 * Sorts an array of objects by a key
 */
export const sortBy = <T, K extends keyof T>(
  array: T[],
  key: K,
  direction: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Creates a range of numbers
 */
export const range = (start: number, end: number, step = 1): number[] => {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
};

/**
 * Chunks an array into smaller arrays of specified size
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Gets a random item from an array
 */
export const randomItem = <T>(array: T[]): T | undefined => {
  if (array.length === 0) return undefined;
  const item = array[Math.floor(Math.random() * array.length)];
  return item;
};

/**
 * Shuffles an array
 */
export const shuffle = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const itemI = shuffled[i];
    const itemJ = shuffled[j];
    if (itemI !== undefined && itemJ !== undefined) {
      shuffled[i] = itemJ;
      shuffled[j] = itemI;
    }
  }
  return shuffled;
};

/**
 * Sleeps for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retries a function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
};

// =============================================================================
// Combined Exports
// =============================================================================

export const CommonUtils = {
  generateId,
  generateUUID,
  deepClone,
  deepEqual,
  capitalize,
  toTitleCase,
  toKebabCase,
  toCamelCase,
  truncate,
  removeUndefined,
  groupBy,
  sortBy,
  range,
  chunk,
  randomItem,
  shuffle,
  sleep,
  retry,
};