/**
 * Security Module
 * 
 * Comprehensive security utilities for the frontend foundation layer.
 * Provides secure token storage, XSS prevention, CSRF protection, and file validation.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

// Security provider and hooks
export { SecurityProvider, useSecurityContext } from './provider';

// Token storage and encryption
export * from './tokenSecurity';

// XSS prevention utilities
export * from './xssProtection';

// CSRF protection utilities
export * from './csrfProtection';

// Secure file upload validation
export * from './fileSecurityValidation';

// Security configuration
export * from './securityConfig';

// Security types
export * from './securityTypes';