/**
 * Simple Logger Interface
 *
 * Provides a simple logging interface that can be used without importing
 * the full logger to avoid circular dependencies
 */

/**
 * Simple logger that can be used in infrastructure files
 */
export const simpleLogger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    // In production, this would use a proper logger
    // For now, we'll use console but with proper formatting
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  
  error: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  },
  
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
};