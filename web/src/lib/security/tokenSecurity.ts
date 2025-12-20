/**
 * Secure Token Storage Implementation
 * 
 * Enhanced token storage with encryption, secure storage mechanisms,
 * and comprehensive security validation.
 * 
 * Requirements: 13.1
 */

import type {
  SecureTokenStorage,
  TokenEncryption,
  TokenValidationResult,
  SecurityEvent,
} from './securityTypes';
import { securityConfig, SECURITY_CONSTANTS, ENVIRONMENT_SECURITY } from './securityConfig';

/**
 * Token encryption implementation using Web Crypto API
 */
export class WebCryptoTokenEncryption implements TokenEncryption {
  private key: CryptoKey | null = null;
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;

  /**
   * Generate a new encryption key
   */
  async generateKey(): Promise<CryptoKey> {
    if (!this.isWebCryptoSupported()) {
      throw new Error('Web Crypto API not supported');
    }

    this.key = await crypto.subtle.generateKey(
      {
        name: this.algorithm,
        length: this.keyLength,
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );

    return this.key;
  }

  /**
   * Encrypt data using AES-GCM
   */
  async encrypt(data: string): Promise<string> {
    if (!this.key) {
      await this.generateKey();
    }

    if (!this.key) {
      throw new Error('Failed to generate encryption key');
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      this.key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);

    // Return base64 encoded result with prefix
    return SECURITY_CONSTANTS.ENCRYPTED_TOKEN_PREFIX + btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data using AES-GCM
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption key not available');
    }

    // Remove prefix and decode base64
    if (!encryptedData.startsWith(SECURITY_CONSTANTS.ENCRYPTED_TOKEN_PREFIX)) {
      throw new Error('Invalid encrypted data format');
    }

    const base64Data = encryptedData.slice(SECURITY_CONSTANTS.ENCRYPTED_TOKEN_PREFIX.length);
    const combined = new Uint8Array(
      atob(base64Data)
        .split('')
        .map(char => char.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedBuffer = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: this.algorithm,
        iv: iv,
      },
      this.key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Check if Web Crypto API is supported
   */
  private isWebCryptoSupported(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.generateKey === 'function';
  }
}

/**
 * Enhanced secure token storage implementation
 */
export class EnhancedSecureTokenStorage implements SecureTokenStorage {
  private encryption: TokenEncryption | null = null;
  private readonly useEncryption: boolean;
  private readonly storageType: 'httpOnly' | 'localStorage' | 'sessionStorage';

  constructor() {
    this.useEncryption = securityConfig.tokenStorage.useEncryption;
    this.storageType = securityConfig.tokenStorage.storageType;

    if (this.useEncryption && ENVIRONMENT_SECURITY.enableTokenEncryption) {
      this.encryption = new WebCryptoTokenEncryption();
    }
  }

  /**
   * Check if secure storage is available
   */
  isSecureStorageAvailable(): boolean {
    if (this.storageType === 'httpOnly') {
      // HttpOnly cookies are handled server-side
      return true;
    }

    try {
      const storage = this.getStorage();
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get access token with decryption if enabled
   */
  async getAccessToken(): Promise<string | null> {
    try {
      if (this.storageType === 'httpOnly') {
        // In production with httpOnly cookies, tokens are not accessible to client
        // This would require a server endpoint to validate token presence
        return await this.getTokenFromServer('access');
      }

      const storage = this.getStorage();
      const encryptedToken = storage.getItem(SECURITY_CONSTANTS.TOKEN_STORAGE_KEY);
      
      if (!encryptedToken) {
        return null;
      }

      if (this.useEncryption && this.encryption) {
        return await this.encryption.decrypt(encryptedToken);
      }

      return encryptedToken;
    } catch (error) {
      console.warn('Failed to get access token:', error);
      this.logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { error: 'Failed to get access token', message: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium',
      });
      return null;
    }
  }

  /**
   * Get refresh token with decryption if enabled
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      if (this.storageType === 'httpOnly') {
        return await this.getTokenFromServer('refresh');
      }

      const storage = this.getStorage();
      const encryptedToken = storage.getItem(SECURITY_CONSTANTS.REFRESH_TOKEN_STORAGE_KEY);
      
      if (!encryptedToken) {
        return null;
      }

      if (this.useEncryption && this.encryption) {
        return await this.encryption.decrypt(encryptedToken);
      }

      return encryptedToken;
    } catch (error) {
      console.warn('Failed to get refresh token:', error);
      this.logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { error: 'Failed to get refresh token', message: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium',
      });
      return null;
    }
  }

  /**
   * Set tokens with encryption if enabled
   */
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      if (this.storageType === 'httpOnly') {
        // HttpOnly cookies are set server-side
        await this.setTokensOnServer(accessToken, refreshToken);
        return;
      }

      const storage = this.getStorage();
      
      let encryptedAccessToken = accessToken;
      let encryptedRefreshToken = refreshToken;

      if (this.useEncryption && this.encryption) {
        encryptedAccessToken = await this.encryption.encrypt(accessToken);
        encryptedRefreshToken = await this.encryption.encrypt(refreshToken);
      }

      storage.setItem(SECURITY_CONSTANTS.TOKEN_STORAGE_KEY, encryptedAccessToken);
      storage.setItem(SECURITY_CONSTANTS.REFRESH_TOKEN_STORAGE_KEY, encryptedRefreshToken);

      this.logSecurityEvent({
        type: 'token_refresh',
        timestamp: new Date(),
        details: { action: 'tokens_stored', encrypted: this.useEncryption },
        severity: 'low',
      });
    } catch (error) {
      console.error('Failed to store tokens:', error);
      this.logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { error: 'Failed to store tokens', message: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'high',
      });
      throw error;
    }
  }

  /**
   * Clear all tokens
   */
  async clearTokens(): Promise<void> {
    try {
      if (this.storageType === 'httpOnly') {
        await this.clearTokensOnServer();
        return;
      }

      const storage = this.getStorage();
      storage.removeItem(SECURITY_CONSTANTS.TOKEN_STORAGE_KEY);
      storage.removeItem(SECURITY_CONSTANTS.REFRESH_TOKEN_STORAGE_KEY);

      this.logSecurityEvent({
        type: 'token_refresh',
        timestamp: new Date(),
        details: { action: 'tokens_cleared' },
        severity: 'low',
      });
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
      this.logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { error: 'Failed to clear tokens', message: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium',
      });
    }
  }

  /**
   * Get storage instance based on configuration
   */
  private getStorage(): Storage {
    switch (this.storageType) {
      case 'sessionStorage':
        return sessionStorage;
      case 'localStorage':
      default:
        return localStorage;
    }
  }

  /**
   * Get token from server (for httpOnly cookie mode)
   */
  private async getTokenFromServer(type: 'access' | 'refresh'): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/token-status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return type === 'access' ? data.hasAccessToken : data.hasRefreshToken;
    } catch {
      return null;
    }
  }

  /**
   * Set tokens on server (for httpOnly cookie mode)
   */
  private async setTokensOnServer(accessToken: string, refreshToken: string): Promise<void> {
    const response = await fetch('/api/auth/set-tokens', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken, refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to set tokens on server');
    }
  }

  /**
   * Clear tokens on server (for httpOnly cookie mode)
   */
  private async clearTokensOnServer(): Promise<void> {
    const response = await fetch('/api/auth/clear-tokens', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to clear tokens on server');
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: SecurityEvent): void {
    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.log('Security Event:', event);
    }

    // In production, this would send to a security monitoring service
    if (ENVIRONMENT_SECURITY.enableSecurityLogging) {
      // TODO: Integrate with security monitoring service
    }
  }
}

/**
 * Token validation utilities
 */
export class TokenValidator {
  /**
   * Validate JWT token structure and expiration
   */
  static validateToken(token: string): TokenValidationResult {
    try {
      if (!token || typeof token !== 'string') {
        return {
          valid: false,
          expired: false,
          error: 'Invalid token format',
        };
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return {
          valid: false,
          expired: false,
          error: 'Invalid JWT structure',
        };
      }

      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = payload.exp;
      const bufferTime = securityConfig.tokenStorage.tokenExpirationBuffer / 1000;

      // Check expiration with buffer
      const expired = expirationTime <= currentTime + bufferTime;

      return {
        valid: !expired,
        expired,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        expired: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Extract user information from token
   */
  static extractUserInfo(token: string): any {
    const validation = this.validateToken(token);
    if (!validation.valid || !validation.payload) {
      return null;
    }

    return {
      id: validation.payload.sub || validation.payload.userId,
      email: validation.payload.email,
      role: validation.payload.role,
      fullName: validation.payload.fullName,
      emailVerified: validation.payload.emailVerified,
      iat: validation.payload.iat,
      exp: validation.payload.exp,
    };
  }

  /**
   * Check if token needs refresh
   */
  static needsRefresh(token: string): boolean {
    const validation = this.validateToken(token);
    return !validation.valid || validation.expired;
  }
}

/**
 * Security audit utilities for token operations
 */
export class TokenSecurityAuditor {
  private static events: SecurityEvent[] = [];

  /**
   * Audit token access
   */
  static auditTokenAccess(type: 'access' | 'refresh', success: boolean): void {
    const event: SecurityEvent = {
      type: 'token_refresh',
      timestamp: new Date(),
      details: {
        tokenType: type,
        success,
        userAgent: navigator.userAgent,
      },
      severity: success ? 'low' : 'medium',
    };

    this.events.push(event);
    this.cleanupOldEvents();

    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.log('Token Access Audit:', event);
    }
  }

  /**
   * Audit suspicious token activity
   */
  static auditSuspiciousActivity(details: any): void {
    const event: SecurityEvent = {
      type: 'security_error',
      timestamp: new Date(),
      details: {
        ...details,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
      severity: 'high',
    };

    this.events.push(event);
    this.cleanupOldEvents();

    console.warn('Suspicious Token Activity:', event);
  }

  /**
   * Get recent security events
   */
  static getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clean up old events to prevent memory leaks
   */
  private static cleanupOldEvents(): void {
    const maxEvents = 1000;
    if (this.events.length > maxEvents) {
      this.events = this.events.slice(-maxEvents);
    }
  }
}

// Export singleton instances
export const secureTokenStorage = new EnhancedSecureTokenStorage();
export const tokenValidator = TokenValidator;
export const tokenSecurityAuditor = TokenSecurityAuditor;