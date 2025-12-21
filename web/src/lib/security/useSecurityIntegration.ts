/**
 * Security Integration Hook
 * 
 * React hook that provides comprehensive security integration
 * for forms, GraphQL operations, and file uploads.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { ApolloClient, DocumentNode, InMemoryCache } from '@apollo/client';
import { CSRFProtector } from './csrfProtection';
import { inputValidator, type ValidationResult } from './inputValidation';
import { secureTokenStorage } from './tokenSecurity';
import { securityConfig } from './securityConfig';
import type { SecurityEvent } from './securityTypes';

/**
 * Security integration state
 */
interface SecurityState {
  csrfToken: string | null;
  isSecureStorageAvailable: boolean;
  securityHeaders: Record<string, string>;
  rateLimitStatus: {
    remaining: number;
    resetTime: number;
  } | null;
}

/**
 * Security integration hook
 */
export function useSecurityIntegration() {
  // Create a mock Apollo client for now - in real implementation, use useApolloClient()
  const apolloClient = React.useMemo(() => new ApolloClient({
    cache: new InMemoryCache(),
    link: {} as any, // Mock link for now
  }), []);
  const [securityState, setSecurityState] = useState<SecurityState>({
    csrfToken: null,
    isSecureStorageAvailable: false,
    securityHeaders: {},
    rateLimitStatus: null,
  });

  /**
   * Initialize security features
   */
  const initializeSecurity = useCallback(async () => {
    try {
      // Initialize CSRF token
      if (securityConfig.csrfProtection.enabled) {
        const csrfToken = await CSRFProtector.getCSRFToken();
        setSecurityState(prev => ({ ...prev, csrfToken }));
      }

      // Check secure storage availability
      const isSecureStorageAvailable = secureTokenStorage.isSecureStorageAvailable();
      setSecurityState(prev => ({ ...prev, isSecureStorageAvailable }));

      // Set up security headers
      const securityHeaders: Record<string, string> = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      };

      if (securityState.csrfToken) {
        securityHeaders[securityConfig.csrfProtection.tokenHeader] = securityState.csrfToken;
      }

      setSecurityState(prev => ({ ...prev, securityHeaders }));
    } catch (securityError) {
      console.error('Failed to initialize security:', securityError);
    }
  }, [securityState.csrfToken]);

  /**
   * Validate and sanitize form input
   */
  const validateInput = useCallback((input: string, options?: {
    allowHtml?: boolean;
    maxLength?: number;
  }): ValidationResult<string> => {
    try {
      const { sanitized, warnings } = inputValidator.sanitizeString(input, options);
      
      return {
        success: true,
        data: sanitized,
        errors: [],
        warnings,
      };
    } catch (_validationError) {
      return {
        success: false,
        errors: [{
          field: 'input',
          message: 'Input validation failed',
          code: 'validation_error',
          severity: 'high',
        }],
        warnings: [],
      };
    }
  }, []);

  /**
   * Validate email input
   */
  const validateEmail = useCallback((email: string): ValidationResult<string> => {
    return inputValidator.validateEmail(email);
  }, []);

  /**
   * Validate password input
   */
  const validatePassword = useCallback((password: string): ValidationResult<string> => {
    return inputValidator.validatePassword(password);
  }, []);

  /**
   * Validate URL input
   */
  const validateUrl = useCallback((url: string): ValidationResult<string> => {
    return inputValidator.validateUrl(url);
  }, []);

  /**
   * Validate file upload
   */
  const validateFileUpload = useCallback((file: File): ValidationResult<File> => {
    return inputValidator.validateFileUpload(file);
  }, []);

  /**
   * Secure GraphQL request
   */
  const secureGraphQLRequest = useCallback(async (
    operation: string,
    variables?: Record<string, unknown>
  ) => {
    try {
      // Validate input variables
      if (variables) {
        const validationResult = inputValidator.validateGraphQLInput(variables);
        if (!validationResult.success) {
          throw new Error(`Input validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
        }
        variables = validationResult.data;
      }

      // Add security headers
      const headers: Record<string, string> = { ...securityState.securityHeaders };

      // Add authentication token
      const accessToken = await secureTokenStorage.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Execute GraphQL operation with security headers
      const result = await apolloClient.query({
        query: operation as unknown as DocumentNode,
        variables,
        context: {
          headers,
        },
        fetchPolicy: 'network-only', // Ensure fresh data for security-sensitive operations
      });

      return result;
    } catch (error) {
      logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: {
          reason: 'graphql_request_failed',
          operation,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'medium',
      });
      throw error;
    }
  }, [apolloClient, securityState.securityHeaders]);

  /**
   * Secure mutation request
   */
  const secureMutationRequest = useCallback(async (
    mutation: string,
    variables?: Record<string, unknown>
  ) => {
    try {
      // Validate input variables
      if (variables) {
        const validationResult = inputValidator.validateGraphQLInput(variables);
        if (!validationResult.success) {
          throw new Error(`Input validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
        }
        variables = validationResult.data;
      }

      // Add security headers including CSRF token
      const headers: Record<string, string> = { ...securityState.securityHeaders };

      // Ensure CSRF token is present for mutations
      if (securityConfig.csrfProtection.enabled && !headers[securityConfig.csrfProtection.tokenHeader]) {
        const csrfToken = await CSRFProtector.getCSRFToken();
        if (csrfToken) {
          headers[securityConfig.csrfProtection.tokenHeader] = csrfToken;
        }
      }

      // Add authentication token
      const accessToken = await secureTokenStorage.getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Execute GraphQL mutation with security headers
      const result = await apolloClient.mutate({
        mutation: mutation as unknown as DocumentNode,
        variables,
        context: {
          headers,
        },
      });

      return result;
    } catch (error) {
      logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: {
          reason: 'graphql_mutation_failed',
          mutation,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'high',
      });
      throw error;
    }
  }, [apolloClient, securityState.securityHeaders]);

  /**
   * Secure file upload
   */
  const secureFileUpload = useCallback(async (
    file: File,
    uploadUrl: string,
    options?: {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }
  ) => {
    try {
      // Validate file
      const validationResult = validateFileUpload(file);
      if (!validationResult.success) {
        throw new Error(`File validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Create secure upload request
      const formData = new FormData();
      formData.append('file', file);

      // Add CSRF token if required
      if (securityConfig.csrfProtection.enabled && securityState.csrfToken) {
        formData.append('csrf_token', securityState.csrfToken);
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          ...securityState.securityHeaders,
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        ...(options?.signal && { signal: options.signal }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: {
          reason: 'file_upload_failed',
          fileName: file.name,
          fileSize: file.size,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'medium',
      });
      throw error;
    }
  }, [securityState.csrfToken, securityState.securityHeaders, validateFileUpload]);

  /**
   * Check if URL is safe for navigation
   */
  const isSafeUrl = useCallback((url: string): boolean => {
    try {
      const validationResult = validateUrl(url);
      return validationResult.success;
    } catch {
      return false;
    }
  }, [validateUrl]);

  /**
   * Get security audit information
   */
  const getSecurityAudit = useCallback(() => {
    return {
      csrfProtectionEnabled: securityConfig.csrfProtection.enabled,
      xssProtectionEnabled: securityConfig.xssProtection.enabled,
      tokenStorageSecure: securityState.isSecureStorageAvailable,
      secureHeaders: Object.keys(securityState.securityHeaders).length > 0,
      fileUploadSecure: securityConfig.fileUpload.requireContentValidation,
    };
  }, [securityState]);

  // Initialize security on mount
  useEffect(() => {
    initializeSecurity();
  }, [initializeSecurity]);

  return {
    // State
    securityState,
    
    // Validation functions
    validateInput,
    validateEmail,
    validatePassword,
    validateUrl,
    validateFileUpload,
    
    // Secure request functions
    secureGraphQLRequest,
    secureMutationRequest,
    secureFileUpload,
    
    // Utility functions
    isSafeUrl,
    getSecurityAudit,
    
    // Actions
    initializeSecurity,
  };
}

/**
 * Log security event
 */
function logSecurityEvent(event: SecurityEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Security Event]', event);
  }
  
  // In production, send to monitoring service (Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with monitoring service
  }
}

/**
 * Security context for React components
 */
export type SecurityContextType = ReturnType<typeof useSecurityIntegration>;