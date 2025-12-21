/**
 * Security Module
 *
 * Comprehensive security implementation for the frontend foundation layer.
 * Provides CSRF protection, XSS protection, secure token storage, input validation,
 * file security, and security middleware integration.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

// Security provider and hooks
export { SecurityProvider, useSecurityContext } from './provider';

// Core security components
export * from './csrfProtection';
export * from './xssProtection';
export * from './tokenSecurity';
export * from './fileSecurityValidation';

// Input validation and sanitization
export * from './inputValidation';

// Security middleware
export * from './securityMiddleware';

// Security integration hook
export * from './useSecurityIntegration';

// Security configuration
export * from './securityConfig';

// Security types
export * from './securityTypes';

// Re-export commonly used items
export { securityConfig } from './securityConfig';
export { inputValidator } from './inputValidation';
export { useSecurityIntegration } from './useSecurityIntegration';
export { securityMiddleware } from './securityMiddleware';
