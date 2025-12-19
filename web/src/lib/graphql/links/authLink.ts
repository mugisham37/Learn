/**
 * Authentication Link
 * 
 * Apollo Link that automatically injects JWT tokens into GraphQL requests
 * and handles token refresh on authentication errors.
 */

import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { fromPromise } from '@apollo/client';
import { authConfig } from '../../config';

/**
 * Token storage interface
 * Abstracts token storage to support different storage mechanisms
 */
interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clearTokens(): void;
}

/**
 * Browser-based token storage implementation
 * Uses localStorage with fallback to sessionStorage
 */
class BrowserTokenStorage implements TokenStorage {
  private storage: Storage;

  constructor() {
    // Use localStorage if available, fallback to sessionStorage
    this.storage = typeof window !== 'undefined' 
      ? (window.localStorage || window.sessionStorage)
      : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          length: 0,
          clear: () => {},
          key: () => null,
        } as Storage;
  }

  getAccessToken(): string | null {
    try {
      return this.storage.getItem(authConfig.tokenStorageKey);
    } catch (error) {
      console.warn('Failed to get access token from storage:', error);
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      return this.storage.getItem(authConfig.refreshTokenStorageKey);
    } catch (error) {
      console.warn('Failed to get refresh token from storage:', error);
      return null;
    }
  }

  setTokens(accessToken: string, refreshToken: string): void {
    try {
      this.storage.setItem(authConfig.tokenStorageKey, accessToken);
      this.storage.setItem(authConfig.refreshTokenStorageKey, refreshToken);
    } catch (error) {
      console.warn('Failed to store tokens:', error);
    }
  }

  clearTokens(): void {
    try {
      this.storage.removeItem(authConfig.tokenStorageKey);
      this.storage.removeItem(authConfig.refreshTokenStorageKey);
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }
}

/**
 * JWT token utilities
 */
class TokenManager {
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
   * Checks if a JWT token is expired or will expire soon
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid token format
      }
      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = payload.exp;
      
      // Consider token expired if it expires within the buffer time
      return expirationTime <= currentTime + (authConfig.tokenExpirationBuffer / 1000);
    } catch (error) {
      console.warn('Failed to parse token:', error);
      return true; // Treat invalid tokens as expired
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
}

// Global token manager instance
const tokenManager = new TokenManager(new BrowserTokenStorage());

/**
 * Creates the authentication link that injects JWT tokens
 */
export function createAuthLink() {
  return setContext(async (_, { headers }) => {
    let accessToken = tokenManager.getAccessToken();

    // Check if token needs refresh
    if (accessToken && tokenManager.isTokenExpired(accessToken)) {
      try {
        accessToken = await tokenManager.refreshAccessToken();
      } catch (error) {
        console.warn('Token refresh failed, proceeding without token:', error);
        accessToken = null;
      }
    }

    // Return headers with authorization if token is available
    return {
      headers: {
        ...headers,
        ...(accessToken && {
          authorization: `Bearer ${accessToken}`,
        }),
      },
    };
  });
}

/**
 * Creates an error link that handles authentication errors
 */
export function createAuthErrorLink() {
  return onError(({ graphQLErrors, networkError, operation, forward }) => {
    // Handle GraphQL authentication errors
    if (graphQLErrors) {
      for (const error of graphQLErrors) {
        if (error.extensions?.code === 'UNAUTHENTICATED') {
          // Try to refresh token and retry the operation
          return fromPromise(
            tokenManager.refreshAccessToken()
              .then((newToken) => {
                // Update the operation context with new token
                operation.setContext(({ headers = {} }) => ({
                  headers: {
                    ...headers,
                    authorization: `Bearer ${newToken}`,
                  },
                }));
                return true;
              })
              .catch((error) => {
                // Refresh failed, clear tokens and redirect to login
                tokenManager.clearTokens();
                
                // Emit authentication error event for app-level handling
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('auth:token-expired'));
                }
                
                throw error;
              })
          ).flatMap(() => forward(operation));
        }
      }
    }

    // Handle network authentication errors (401)
    if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
      return fromPromise(
        tokenManager.refreshAccessToken()
          .then((newToken) => {
            operation.setContext(({ headers = {} }) => ({
              headers: {
                ...headers,
                authorization: `Bearer ${newToken}`,
              },
            }));
            return true;
          })
          .catch((error) => {
            tokenManager.clearTokens();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth:token-expired'));
            }
            
            throw error;
          })
      ).flatMap(() => forward(operation));
    }
  });
}

/**
 * Export token manager for use in other parts of the application
 */
export { tokenManager, TokenManager, type TokenStorage };