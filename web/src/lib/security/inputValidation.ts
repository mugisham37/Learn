/**
 * Input Validation and Sanitization
 * 
 * Comprehensive input validation system that integrates with forms,
 * GraphQL operations, and file uploads for security.
 * 
 * Requirements: 12.3 - Input validation and sanitization
 */

import { z } from 'zod';
import { XSSProtector } from './xssProtection';
import { securityConfig } from './securityConfig';
import type { SecurityEvent } from './securityTypes';

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T | undefined;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Input sanitization options
 */
export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  normalizeUnicode?: boolean;
}

/**
 * Base input validator class
 */
export class InputValidator {
  private xssProtector: XSSProtector;
  
  constructor() {
    this.xssProtector = new XSSProtector();
  }
  
  /**
   * Sanitize string input
   */
  sanitizeString(
    input: string, 
    options: SanitizationOptions = {}
  ): { sanitized: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = input;
    
    // Remove null bytes
    if (options.removeNullBytes !== false) {
      const originalLength = sanitized.length;
      sanitized = sanitized.replace(/\0/g, '');
      if (sanitized.length !== originalLength) {
        warnings.push('Null bytes removed from input');
      }
    }
    
    // Normalize unicode
    if (options.normalizeUnicode !== false) {
      sanitized = sanitized.normalize('NFC');
    }
    
    // Trim whitespace
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }
    
    // Check length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.slice(0, options.maxLength);
      warnings.push(`Input truncated to ${options.maxLength} characters`);
    }
    
    // XSS protection
    if (!options.allowHtml) {
      const xssResult = this.xssProtector.sanitize(sanitized);
      sanitized = xssResult.sanitized;
      if (xssResult.removed.length > 0) {
        warnings.push('Potentially dangerous content removed');
      }
    }
    
    return { sanitized, warnings };
  }
  
  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Basic sanitization
    const { sanitized, warnings: sanitizeWarnings } = this.sanitizeString(email, {
      allowHtml: false,
      maxLength: 254, // RFC 5321 limit
    });
    warnings.push(...sanitizeWarnings);
    
    // Email validation schema
    const emailSchema = z.string()
      .email('Invalid email format')
      .min(1, 'Email is required')
      .max(254, 'Email too long');
    
    const result = emailSchema.safeParse(sanitized);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push({
          field: 'email',
          message: issue.message,
          code: issue.code,
          severity: 'medium',
        });
      });
    }
    
    // Additional security checks
    if (sanitized.includes('..')) {
      errors.push({
        field: 'email',
        message: 'Email contains consecutive dots',
        code: 'invalid_format',
        severity: 'medium',
      });
    }
    
    return {
      success: errors.length === 0,
      data: result.success ? result.data : undefined,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate password
   */
  validatePassword(password: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Password should not be sanitized (preserve original)
    const passwordSchema = z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
    
    const result = passwordSchema.safeParse(password);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push({
          field: 'password',
          message: issue.message,
          code: issue.code,
          severity: 'high',
        });
      });
    }
    
    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push({
        field: 'password',
        message: 'Password is too common',
        code: 'weak_password',
        severity: 'high',
      });
    }
    
    return {
      success: errors.length === 0,
      data: result.success ? result.data : undefined,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate URL
   */
  validateUrl(url: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Sanitize URL
    const { sanitized, warnings: sanitizeWarnings } = this.sanitizeString(url, {
      allowHtml: false,
      maxLength: 2048,
    });
    warnings.push(...sanitizeWarnings);
    
    // URL validation schema
    const urlSchema = z.string().url('Invalid URL format');
    const result = urlSchema.safeParse(sanitized);
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push({
          field: 'url',
          message: issue.message,
          code: issue.code,
          severity: 'medium',
        });
      });
    }
    
    // Security checks
    if (result.success) {
      try {
        const parsedUrl = new URL(result.data);
        
        // Check for dangerous protocols
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        if (dangerousProtocols.includes(parsedUrl.protocol)) {
          errors.push({
            field: 'url',
            message: 'Dangerous URL protocol',
            code: 'dangerous_protocol',
            severity: 'high',
          });
        }
        
        // Check for localhost/private IPs in production
        if (process.env.NODE_ENV === 'production') {
          const hostname = parsedUrl.hostname;
          if (
            hostname === 'localhost' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
          ) {
            errors.push({
              field: 'url',
              message: 'Private/local URLs not allowed',
              code: 'private_url',
              severity: 'high',
            });
          }
        }
      } catch (error) {
        errors.push({
          field: 'url',
          message: 'URL parsing failed',
          code: 'parse_error',
          severity: 'medium',
        });
      }
    }
    
    return {
      success: errors.length === 0,
      data: result.success ? result.data : undefined,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate GraphQL operation input
   */
  validateGraphQLInput(input: Record<string, unknown>): ValidationResult<Record<string, unknown>> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const sanitizedInput: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        const { sanitized, warnings: fieldWarnings } = this.sanitizeString(value, {
          allowHtml: false,
          maxLength: 10000, // Reasonable limit for GraphQL inputs
        });
        sanitizedInput[key] = sanitized;
        warnings.push(...fieldWarnings.map(w => `${key}: ${w}`));
      } else if (typeof value === 'object' && value !== null) {
        // Recursively validate nested objects
        const nestedResult = this.validateGraphQLInput(value as Record<string, unknown>);
        sanitizedInput[key] = nestedResult.data;
        errors.push(...nestedResult.errors.map(e => ({
          ...e,
          field: `${key}.${e.field}`,
        })));
        warnings.push(...nestedResult.warnings.map(w => `${key}.${w}`));
      } else {
        sanitizedInput[key] = value;
      }
    }
    
    return {
      success: errors.length === 0,
      data: sanitizedInput,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate file upload
   */
  validateFileUpload(file: File): ValidationResult<File> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Check file size
    if (file.size > securityConfig.fileUpload.maxFileSize) {
      errors.push({
        field: 'file',
        message: `File size exceeds limit of ${securityConfig.fileUpload.maxFileSize} bytes`,
        code: 'file_too_large',
        severity: 'high',
      });
    }
    
    // Check MIME type
    if (!securityConfig.fileUpload.allowedMimeTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: `File type ${file.type} not allowed`,
        code: 'invalid_file_type',
        severity: 'high',
      });
    }
    
    // Check file name
    const { sanitized: sanitizedName, warnings: nameWarnings } = this.sanitizeString(file.name, {
      allowHtml: false,
      maxLength: 255,
    });
    warnings.push(...nameWarnings);
    
    // Check for dangerous file extensions
    const dangerousExtensions = [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js',
      'jar', 'app', 'deb', 'pkg', 'dmg', 'rpm'
    ];
    
    const extension = sanitizedName.split('.').pop()?.toLowerCase();
    if (extension && dangerousExtensions.includes(extension)) {
      errors.push({
        field: 'file',
        message: `File extension .${extension} not allowed`,
        code: 'dangerous_extension',
        severity: 'high',
      });
    }
    
    return {
      success: errors.length === 0,
      data: file,
      errors,
      warnings,
    };
  }
}

/**
 * Form validation schemas
 */
export const FormValidationSchemas = {
  // User registration
  userRegistration: z.object({
    email: z.string().email('Invalid email').max(254),
    password: z.string().min(8).max(128),
    fullName: z.string().min(1).max(100),
    acceptTerms: z.boolean().refine(val => val === true, 'Must accept terms'),
  }),
  
  // User login
  userLogin: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password required'),
    rememberMe: z.boolean().optional(),
  }),
  
  // Course creation
  courseCreation: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    category: z.string().min(1).max(50),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    price: z.number().min(0).max(10000).optional(),
    currency: z.string().length(3).optional(),
  }),
  
  // Profile update
  profileUpdate: z.object({
    fullName: z.string().min(1).max(100).optional(),
    bio: z.string().max(1000).optional(),
    timezone: z.string().max(50).optional(),
    language: z.string().length(2).optional(),
  }),
  
  // Message sending
  messageSending: z.object({
    content: z.string().min(1).max(2000),
    conversationId: z.string().uuid(),
    type: z.enum(['TEXT', 'IMAGE', 'FILE']).optional(),
  }),
};

/**
 * Global input validator instance
 */
export const inputValidator = new InputValidator();

/**
 * Validate form data with schema
 */
export function validateFormData<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: [],
    };
  }
  
  const errors: ValidationError[] = result.error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    severity: 'medium',
  }));
  
  return {
    success: false,
    errors,
    warnings: [],
  };
}

/**
 * Log validation security event
 */
function logValidationEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Validation Security Event]', event);
  }
  
  // In production, send to monitoring service
}

/**
 * Middleware for validating request bodies
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<ValidationResult<T>> => {
    try {
      const result = validateFormData(data, schema);
      
      if (!result.success) {
        logValidationEvent({
          type: 'security_error',
          details: {
            reason: 'validation_failed',
            errors: result.errors,
          },
          severity: 'medium',
        });
      }
      
      return result;
    } catch (error) {
      logValidationEvent({
        type: 'security_error',
        details: {
          reason: 'validation_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'high',
      });
      
      return {
        success: false,
        errors: [{
          field: 'general',
          message: 'Validation failed',
          code: 'validation_error',
          severity: 'high',
        }],
        warnings: [],
      };
    }
  };
}