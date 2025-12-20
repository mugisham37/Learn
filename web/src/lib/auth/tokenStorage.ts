/**
 * Token Storage Utilities
 * 
 * Secure token storage with httpOnly cookie support and localStorage fallback.
 * Handles JWT token generation, validation, and automatic refresh.
 */

import { authConfig } from '../config';

/**
 * Token storage interface
 * Abstracts token storage to support different storage mechanisms
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
}

/**
 * Secure token storage implementation
 * Uses httpOnly cookies in production, localStorage in development
 */
export class SecureTokenStorage implements TokenStorage {
  private useHttpOnlyCookies: boolean;

  constructor() {
    // Use httpOnly cookies in production, localStorage in development
    this.useHttpOnlyCookies = process.env.NODE_ENV === 'production';
  }

  getAccessToken(): string | null {
    if (this.useHttpOnlyCookies) {
      // In production, tokens are handled server-side via httpOnly cookies
      // The client doesn't directly access them
      return null;
    }

    try {
      return localStorage.getItem(authConfig.tokenStorageKey);
    } catch (error) {
      console.warn('Failed to get access token from storage:', error);
      return null;
    }
  }

  getRefreshToken(): string | null {
    if (this.useHttpOnlyCookies) {
      // In production, refresh tokens are handled server-side
      return null;
    }

    try {
      return localStorage.getItem(authConfig.refreshTokenStorageKey);
    } catch (error) {
      console.warn('Failed to get refresh token from storage:', error);
      return null;
    }
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (this.useHttpOnlyCookies) {
      // In production, tokens are set via server-side cookies
      // This would typically be handled by the login API endpoint
      return;
    }

    try {
      localStorage.setItem(authConfig.tokenStorageKey, accessToken);
      localStorage.setItem(authConfig.refreshTokenStorageKey, refreshToken);
    } catch (error) {
      console.warn('Failed to store tokens:', error);
    }
  }

  clearTokens(): void {
    if (this.useHttpOnlyCookies) {
      // In production, clearing tokens requires a server-side call
      // This would typically be handled by the logout API endpoint
      return;
    }

    try {
      localStorage.removeItem(authConfig.tokenStorageKey);
      localStorage.removeItem(authConfig.refreshTokenStorageKey);
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }
}

/**
 * JWT token utilities for validation and parsing
 */
export class TokenManager {
  private storage: TokenStorage;
  private refreshPromise: Promise<string> | null = null;

  constructor(storage: TokenStorage) {
    this.storage = storage;
  }

  /**
   * Gets the current access token
   */
  getAccessToken(): string | null {
    return this.storage.getAccessToken();
  }

  /**
   * Gets the current refresh token
   */
  getRefreshToken(): string | null {
    return this.storage.getRefreshToken();
  }

  /**
   * Parses a JWT token and returns the payload
   */
  parseToken(token: string): Record<string, unknown> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const payload = parts[1];
      if (!payload) {
        throw new Error('Invalid token payload');
      }
      return JSON.parse(atob(payload));
    } catch {
      throw new Error('Failed to parse token');
    }
  }

  /**
   * Checks if a JWT token is expired or will expire soon
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.parseToken(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = payload.exp as number;
      
      // Consider token expired if it expires within the buffer time
      return expirationTime <= currentTime + (authConfig.tokenExpirationBuffer / 1000);
    } catch {
      console.warn('Failed to check token expiration');
      return true; // Treat invalid tokens as expired
    }
  }

  /**
   * Extracts user information from a JWT token
   */
  getUserFromToken(token: string): Record<string, unknown> | null {
    try {
      const payload = this.parseToken(token);
      return {
        id: payload.sub || payload.userId,
        email: payload.email,
        role: payload.role,
        fullName: payload.fullName,
        emailVerified: payload.emailVerified,
      };
    } catch {
      console.warn('Failed to extract user from token');
      return null;
    }
  }

  /**
   * Refreshes the access token using the refresh token
   */
  async refreshAccessToken(): Promise<string> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this.performTokenRefresh(refreshToken);
    
    try {
      const newAccessToken = await this.refreshPromise;
      return newAccessToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Performs the actual token refresh API call
   */
  private async performTokenRefresh(refreshToken: string): Promise<string> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include', // Include cookies for httpOnly token handling
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.accessToken) {
        throw new Error('No access token in refresh response');
      }

      // Store the new tokens
      this.storage.setTokens(data.accessToken, data.refreshToken || refreshToken);
      
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear invalid tokens
      this.storage.clearTokens();
      throw error;
    }
  }

  /**
   * Sets new tokens in storage
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.storage.setTokens(accessToken, refreshToken);
  }

  /**
   * Clears all tokens from storage
   */
  clearTokens(): void {
    this.storage.clearTokens();
  }

  /**
   * Checks if the user is currently authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return token !== null && !this.isTokenExpired(token);
  }
}

// Global token manager instance
export const tokenManager = new TokenManager(new SecureTokenStorage());