/**
 * Security Configuration
 *
 * Central configuration for all security features in the frontend foundation layer.
 * Provides environment-specific security settings and validation.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import type { SecurityConfig, ContentSecurityPolicy } from './securityTypes';

/**
 * Default Content Security Policy
 */
const defaultCSP: ContentSecurityPolicy = {
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'https:'],
    'connect-src': ["'self'", 'wss:', 'https:'],
    'media-src': ["'self'", 'https:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': [],
  },
  reportOnly: process.env.NODE_ENV === 'development',
};

/**
 * Production security configuration
 */
const productionConfig: SecurityConfig = {
  tokenStorage: {
    useEncryption: true,
    encryptionAlgorithm: 'AES-GCM',
    storageType: 'httpOnly',
    tokenExpirationBuffer: 300000, // 5 minutes
  },
  xssProtection: {
    enabled: true,
    strictMode: true,
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ol',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'a',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'id'],
    },
  },
  csrfProtection: {
    enabled: true,
    tokenHeader: 'x-csrf-token',
    cookieName: 'csrf-token',
    sameSite: 'strict',
  },
  fileUpload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/webm',
      'video/quicktime',
      // Documents
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    requireContentValidation: true,
    requireMalwareScan: true,
  },
  contentSecurityPolicy: defaultCSP,
};

/**
 * Development security configuration
 */
const developmentConfig: SecurityConfig = {
  tokenStorage: {
    useEncryption: false,
    encryptionAlgorithm: 'AES-GCM',
    storageType: 'localStorage',
    tokenExpirationBuffer: 300000, // 5 minutes
  },
  xssProtection: {
    enabled: true,
    strictMode: false,
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ol',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
      'a',
      'img',
      'div',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class', 'id', 'style'],
    },
  },
  csrfProtection: {
    enabled: false, // Disabled in development for easier testing
    tokenHeader: 'x-csrf-token',
    cookieName: 'csrf-token',
    sameSite: 'lax',
  },
  fileUpload: {
    maxFileSize: 500 * 1024 * 1024, // 500MB for development
    allowedMimeTypes: [
      // All production types plus development-friendly types
      ...productionConfig.fileUpload.allowedMimeTypes,
      'text/csv',
      'application/json',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
    ],
    requireContentValidation: false,
    requireMalwareScan: false,
  },
  contentSecurityPolicy: {
    ...defaultCSP,
    reportOnly: true,
  },
};

/**
 * Test security configuration
 */
const testConfig: SecurityConfig = {
  tokenStorage: {
    useEncryption: false,
    encryptionAlgorithm: 'AES-GCM',
    storageType: 'localStorage',
    tokenExpirationBuffer: 60000, // 1 minute for faster testing
  },
  xssProtection: {
    enabled: true,
    strictMode: true,
    allowedTags: ['p', 'br', 'strong', 'em'],
    allowedAttributes: {
      '*': ['class'],
    },
  },
  csrfProtection: {
    enabled: false,
    tokenHeader: 'x-csrf-token',
    cookieName: 'csrf-token',
    sameSite: 'lax',
  },
  fileUpload: {
    maxFileSize: 1024 * 1024, // 1MB for testing
    allowedMimeTypes: ['text/plain', 'image/png'],
    requireContentValidation: false,
    requireMalwareScan: false,
  },
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    },
    reportOnly: true,
  },
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
  const env = process.env.NODE_ENV;

  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];

  // Validate token storage
  if (config.tokenStorage.tokenExpirationBuffer < 60000) {
    errors.push('Token expiration buffer should be at least 1 minute');
  }

  // Validate XSS protection
  if (config.xssProtection.enabled && config.xssProtection.allowedTags.length === 0) {
    errors.push('XSS protection enabled but no allowed tags specified');
  }

  // Validate file upload
  if (config.fileUpload.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  if (config.fileUpload.allowedMimeTypes.length === 0) {
    errors.push('At least one allowed MIME type must be specified');
  }

  // Validate CSP
  if (!config.contentSecurityPolicy.directives['default-src']) {
    errors.push('Content Security Policy must include default-src directive');
  }

  return errors;
}

/**
 * Security configuration constants
 */
export const SECURITY_CONSTANTS = {
  // Token storage
  TOKEN_STORAGE_KEY: 'app_access_token',
  REFRESH_TOKEN_STORAGE_KEY: 'app_refresh_token',
  ENCRYPTED_TOKEN_PREFIX: 'enc:',

  // XSS protection
  XSS_SCAN_TIMEOUT: 5000, // 5 seconds
  MAX_CONTENT_LENGTH: 1000000, // 1MB

  // CSRF protection
  CSRF_TOKEN_LENGTH: 32,
  CSRF_TOKEN_LIFETIME: 3600000, // 1 hour

  // File upload security
  FILE_SCAN_TIMEOUT: 30000, // 30 seconds
  MAX_FILE_NAME_LENGTH: 255,
  SUSPICIOUS_EXTENSIONS: [
    'exe',
    'bat',
    'cmd',
    'com',
    'pif',
    'scr',
    'vbs',
    'js',
    'jar',
    'app',
    'deb',
    'pkg',
    'dmg',
    'rpm',
  ],

  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },
} as const;

/**
 * Environment-specific security settings
 */
export const ENVIRONMENT_SECURITY = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Feature flags
  enableTokenEncryption: process.env.NODE_ENV === 'production',
  enableCSRFProtection: process.env.NODE_ENV === 'production',
  enableMalwareScanning: process.env.NODE_ENV === 'production',
  enableSecurityLogging: process.env.NODE_ENV !== 'test',

  // Debug settings
  logSecurityEvents: process.env.NODE_ENV === 'development',
  strictValidation: process.env.NODE_ENV === 'production',
} as const;

// Export the current configuration
export const securityConfig = getSecurityConfig();
