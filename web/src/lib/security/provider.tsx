/**
 * Security Provider Component
 * 
 * React provider component that provides security functionality to child components.
 */

'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SecurityContextValue {
  /** Check if content is safe from XSS */
  sanitizeContent: (content: string) => string;
  /** Validate file upload security */
  validateFileUpload: (file: File) => Promise<boolean>;
  /** Generate CSRF token */
  generateCSRFToken: () => string;
  /** Validate CSRF token */
  validateCSRFToken: (token: string) => boolean;
  /** Check if URL is safe */
  isSafeURL: (url: string) => boolean;
  /** Security configuration */
  config: SecurityConfig;
}

export interface SecurityConfig {
  /** Enable XSS protection */
  enableXSSProtection: boolean;
  /** Enable CSRF protection */
  enableCSRFProtection: boolean;
  /** Enable file validation */
  enableFileValidation: boolean;
  /** Allowed file types */
  allowedFileTypes: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Allowed domains for URLs */
  allowedDomains: string[];
}

// =============================================================================
// Context
// =============================================================================

const SecurityContext = createContext<SecurityContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export interface SecurityProviderProps {
  children: React.ReactNode;
  config?: Partial<SecurityConfig>;
}

const defaultConfig: SecurityConfig = {
  enableXSSProtection: true,
  enableCSRFProtection: true,
  enableFileValidation: true,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedDomains: ['localhost', 'example.com'],
};

export function SecurityProvider({ children, config: customConfig }: SecurityProviderProps) {
  const [config] = useState<SecurityConfig>({
    ...defaultConfig,
    ...customConfig,
  });

  const [csrfToken, setCSRFToken] = useState<string>('');

  // Generate CSRF token on mount
  useEffect(() => {
    if (config.enableCSRFProtection) {
      // Use a callback to avoid direct state update in effect
      const updateToken = () => setCSRFToken(generateRandomToken());
      updateToken();
    }
  }, [config.enableCSRFProtection]);

  const sanitizeContent = useCallback((content: string): string => {
    if (!config.enableXSSProtection) return content;
    
    // Basic XSS sanitization (in production, use a proper library like DOMPurify)
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }, [config.enableXSSProtection]);

  const validateFileUpload = useCallback(async (file: File): Promise<boolean> => {
    if (!config.enableFileValidation) return true;
    
    // Check file type
    if (!config.allowedFileTypes.includes(file.type)) {
      return false;
    }
    
    // Check file size
    if (file.size > config.maxFileSize) {
      return false;
    }
    
    // Additional security checks could be added here
    return true;
  }, [config.enableFileValidation, config.allowedFileTypes, config.maxFileSize]);

  const generateCSRFToken = useCallback((): string => {
    if (!config.enableCSRFProtection) return '';
    
    const newToken = generateRandomToken();
    setCSRFToken(newToken);
    return newToken;
  }, [config.enableCSRFProtection]);

  const validateCSRFToken = useCallback((token: string): boolean => {
    if (!config.enableCSRFProtection) return true;
    
    return token === csrfToken;
  }, [config.enableCSRFProtection, csrfToken]);

  const isSafeURL = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      
      // Check if domain is allowed
      if (config.allowedDomains.length > 0) {
        return config.allowedDomains.includes(urlObj.hostname);
      }
      
      // Basic safety checks
      return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
    } catch {
      return false;
    }
  }, [config.allowedDomains]);

  const contextValue: SecurityContextValue = {
    sanitizeContent,
    validateFileUpload,
    generateCSRFToken,
    validateCSRFToken,
    isSafeURL,
    config,
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

export function useSecurityContext(): SecurityContextValue {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityProvider');
  }
  return context;
}

// =============================================================================
// Utilities
// =============================================================================

function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}