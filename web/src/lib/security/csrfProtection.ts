/**
 * CSRF Protection Utilities
 * 
 * Cross-Site Request Forgery protection utilities for secure form submissions
 * and API requests. Provides token generation, validation, and request integration.
 * 
 * Requirements: 13.3
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  CSRFTokenManager,
  CSRFRequestConfig,
  CSRFError,
  SecurityEvent,
} from './securityTypes';
import { securityConfig, SECURITY_CONSTANTS, ENVIRONMENT_SECURITY } from './securityConfig';

/**
 * CSRF token manager implementation
 */
export class CSRFTokenManagerImpl implements CSRFTokenManager {
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly tokenHeader: string;
  private readonly cookieName: string;

  constructor() {
    this.tokenHeader = securityConfig.csrfProtection.tokenHeader;
    this.cookieName = securityConfig.csrfProtection.cookieName;
  }

  /**
   * Get current CSRF token, generating if needed
   */
  async getToken(): Promise<string | null> {
    try {
      // Check if current token is still valid
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      // Try to get token from cookie first
      const cookieToken = this.getTokenFromCookie();
      if (cookieToken && this.isTokenValid(cookieToken)) {
        this.token = cookieToken;
        this.tokenExpiry = Date.now() + SECURITY_CONSTANTS.CSRF_TOKEN_LIFETIME;
        return this.token;
      }

      // Generate new token
      const newToken = await this.generateToken();
      await this.setToken(newToken);
      
      return newToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      this.logSecurityEvent({
        type: 'csrf_violation',
        timestamp: new Date(),
        details: { error: 'Failed to get CSRF token', message: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium',
      });
      return null;
    }
  }

  /**
   * Set CSRF token
   */
  async setToken(token: string): Promise<void> {
    try {
      if (!this.isTokenValid(token)) {
        throw new Error('Invalid CSRF token format');
      }

      this.token = token;
      this.tokenExpiry = Date.now() + SECURITY_CONSTANTS.CSRF_TOKEN_LIFETIME;

      // Store in cookie if supported
      this.setTokenInCookie(token);

      this.logSecurityEvent({
        type: 'csrf_violation',
        timestamp: new Date(),
        details: { action: 'token_set', tokenLength: token.length },
        severity: 'low',
      });
    } catch (error) {
      console.error('Failed to set CSRF token:', error);
      throw error;
    }
  }

  /**
   * Clear CSRF token
   */
  async clearToken(): Promise<void> {
    try {
      this.token = null;
      this.tokenExpiry = null;
      
      // Clear from cookie
      this.clearTokenFromCookie();

      this.logSecurityEvent({
        type: 'csrf_violation',
        timestamp: new Date(),
        details: { action: 'token_cleared' },
        severity: 'low',
      });
    } catch (error) {
      console.warn('Failed to clear CSRF token:', error);
    }
  }

  /**
   * Validate CSRF token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      if (!token || !this.token) {
        return false;
      }

      // Simple constant-time comparison to prevent timing attacks
      if (token.length !== this.token.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < token.length; i++) {
        result |= token.charCodeAt(i) ^ this.token.charCodeAt(i);
      }

      const isValid = result === 0 && this.tokenExpiry !== null && Date.now() < this.tokenExpiry;

      if (!isValid) {
        this.logSecurityEvent({
          type: 'csrf_violation',
          timestamp: new Date(),
          details: { 
            action: 'token_validation_failed',
            providedTokenLength: token.length,
            expectedTokenLength: this.token?.length || 0,
            expired: this.tokenExpiry !== null && Date.now() >= this.tokenExpiry,
          },
          severity: 'high',
        });
      }

      return isValid;
    } catch (error) {
      console.error('CSRF token validation failed:', error);
      return false;
    }
  }

  /**
   * Generate a new CSRF token
   */
  private async generateToken(): Promise<string> {
    // Use crypto.getRandomValues for secure random token generation
    const array = new Uint8Array(SECURITY_CONSTANTS.CSRF_TOKEN_LENGTH);
    crypto.getRandomValues(array);
    
    // Convert to base64 string
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Validate token format
   */
  private isTokenValid(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Check length (base64 encoded 32 bytes should be ~43 characters)
    if (token.length < 32 || token.length > 64) {
      return false;
    }

    // Check for valid base64url characters
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    return base64urlRegex.test(token);
  }

  /**
   * Get token from cookie
   */
  private getTokenFromCookie(): string | null {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === this.cookieName && value) {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set token in cookie
   */
  private setTokenInCookie(token: string): void {
    try {
      const sameSite = securityConfig.csrfProtection.sameSite;
      const secure = window.location.protocol === 'https:';
      const expires = new Date(Date.now() + SECURITY_CONSTANTS.CSRF_TOKEN_LIFETIME);

      let cookieString = `${this.cookieName}=${encodeURIComponent(token)}; `;
      cookieString += `expires=${expires.toUTCString()}; `;
      cookieString += `path=/; `;
      cookieString += `samesite=${sameSite}; `;
      
      if (secure) {
        cookieString += 'secure; ';
      }

      document.cookie = cookieString;
    } catch (error) {
      console.warn('Failed to set CSRF token in cookie:', error);
    }
  }

  /**
   * Clear token from cookie
   */
  private clearTokenFromCookie(): void {
    try {
      document.cookie = `${this.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } catch (error) {
      console.warn('Failed to clear CSRF token from cookie:', error);
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: SecurityEvent): void {
    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.log('CSRF Security Event:', event);
    }

    // In production, this would send to a security monitoring service
    if (ENVIRONMENT_SECURITY.enableSecurityLogging) {
      // TODO: Integrate with security monitoring service
    }
  }
}

/**
 * CSRF protection utilities
 */
export class CSRFProtector {
  private static tokenManager = new CSRFTokenManagerImpl();

  /**
   * Check if request requires CSRF protection
   */
  static requiresCSRFProtection(config: CSRFRequestConfig): boolean {
    // Skip CSRF for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
    if (safeMethods.includes(config.method.toUpperCase())) {
      return false;
    }

    // Skip CSRF for API endpoints that use other authentication
    if (config.url.includes('/api/auth/') && config.headers['Authorization']) {
      return false;
    }

    // Skip if CSRF protection is disabled
    if (!securityConfig.csrfProtection.enabled) {
      return false;
    }

    return true;
  }

  /**
   * Add CSRF token to request headers
   */
  static async addCSRFToken(headers: Record<string, string>): Promise<Record<string, string>> {
    try {
      const token = await this.tokenManager.getToken();
      if (token) {
        return {
          ...headers,
          [securityConfig.csrfProtection.tokenHeader]: token,
        };
      }
      return headers;
    } catch (error) {
      console.error('Failed to add CSRF token to headers:', error);
      return headers;
    }
  }

  /**
   * Validate CSRF token from request
   */
  static async validateCSRFToken(token: string): Promise<boolean> {
    return await this.tokenManager.validateToken(token);
  }

  /**
   * Get CSRF token for forms
   */
  static async getCSRFToken(): Promise<string | null> {
    return await this.tokenManager.getToken();
  }

  /**
   * Clear CSRF token (e.g., on logout)
   */
  static async clearCSRFToken(): Promise<void> {
    await this.tokenManager.clearToken();
  }

  /**
   * Create CSRF error
   */
  static createCSRFError(code: CSRFError['code'], message: string): CSRFError {
    const error = new Error(message) as CSRFError;
    error.name = 'CSRFError';
    error.code = code;
    error.retryable = code === 'CSRF_TOKEN_EXPIRED';
    return error;
  }

  /**
   * Handle CSRF error in request
   */
  static async handleCSRFError(error: CSRFError): Promise<void> {
    console.warn('CSRF Error:', error);

    // Log security event
    const event: SecurityEvent = {
      type: 'csrf_violation',
      timestamp: new Date(),
      details: {
        errorCode: error.code,
        message: error.message,
        retryable: error.retryable,
        userAgent: navigator.userAgent,
        url: window.location.href,
      },
      severity: 'high',
    };

    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.warn('CSRF Violation:', event);
    }

    // Clear token if it's invalid
    if (error.code === 'CSRF_TOKEN_INVALID' || error.code === 'CSRF_TOKEN_EXPIRED') {
      await this.tokenManager.clearToken();
    }
  }
}

/**
 * CSRF-aware fetch wrapper
 */
export class CSRFFetch {
  /**
   * Fetch with automatic CSRF protection
   */
  static async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const method = options.method || 'GET';
    const headers = { ...options.headers } as Record<string, string>;

    const requestConfig: CSRFRequestConfig = {
      method,
      url,
      headers,
      requiresCSRF: CSRFProtector.requiresCSRFProtection({ method, url, headers, requiresCSRF: true }),
    };

    // Add CSRF token if required
    if (requestConfig.requiresCSRF) {
      const protectedHeaders = await CSRFProtector.addCSRFToken(headers);
      options.headers = protectedHeaders;
    }

    try {
      const response = await fetch(url, options);

      // Handle CSRF errors
      if (response.status === 403) {
        const errorText = await response.text();
        if (errorText && (errorText.includes('CSRF') || errorText.includes('csrf'))) {
          const csrfError = CSRFProtector.createCSRFError(
            'CSRF_TOKEN_INVALID',
            'CSRF token validation failed'
          );
          await CSRFProtector.handleCSRFError(csrfError);
          throw csrfError;
        }
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'CSRFError') {
        throw error;
      }

      // Wrap other errors
      console.error('Fetch error:', error);
      throw error;
    }
  }

  /**
   * POST with CSRF protection
   */
  static async post(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    const body = data ? JSON.stringify(data) : null;
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * PUT with CSRF protection
   */
  static async put(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    const body = data ? JSON.stringify(data) : null;
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * DELETE with CSRF protection
   */
  static async delete(url: string, options: RequestInit = {}): Promise<Response> {
    return this.fetch(url, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * PATCH with CSRF protection
   */
  static async patch(url: string, data?: unknown, options: RequestInit = {}): Promise<Response> {
    const body = data ? JSON.stringify(data) : null;
    return this.fetch(url, {
      ...options,
      method: 'PATCH',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
}

/**
 * React hook for CSRF token management
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshToken = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newToken = await CSRFProtector.getCSRFToken();
      setToken(newToken);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get CSRF token'));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearToken = useCallback(async () => {
    try {
      await CSRFProtector.clearCSRFToken();
      setToken(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to clear CSRF token'));
    }
  }, []);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  return {
    token,
    loading,
    error,
    refreshToken,
    clearToken,
  };
}

// Export singleton instances and utilities
export const csrfTokenManager = new CSRFTokenManagerImpl();
export const csrfProtector = CSRFProtector;
export const csrfFetch = CSRFFetch;

// Convenience functions
export const getCSRFToken = CSRFProtector.getCSRFToken;
export const clearCSRFToken = CSRFProtector.clearCSRFToken;
export const validateCSRFToken = CSRFProtector.validateCSRFToken;
export const addCSRFToken = CSRFProtector.addCSRFToken;