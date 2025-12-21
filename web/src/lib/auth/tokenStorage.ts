/**
 * Token Storage and Management
 *
 * Handles JWT token storage, retrieval, and refresh logic for authentication.
 */

import type { User } from '@/types';

/**
 * Token storage interface
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearTokens(): void;
}

/**
 * Secure token storage implementation
 */
export class SecureTokenStorage implements TokenStorage {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access-token');
  }

  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access-token', token);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh-token');
  }

  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refresh-token', token);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access-token');
    localStorage.removeItem('refresh-token');
  }
}

/**
 * Token manager class
 */
export class TokenManager extends SecureTokenStorage {
  /**
   * Set both access and refresh tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  }

  /**
   * Extract user data from JWT token
   */
  getUserFromToken(token: string): User | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = parts[1];
      if (!payload) {
        return null;
      }
      
      const decoded = JSON.parse(atob(payload));
      
      // Extract user data from token payload
      if (decoded.sub && decoded.email) {
        return {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role || 'STUDENT',
          emailVerified: decoded.emailVerified || false,
          createdAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
          updatedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        } as User;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email: string): Promise<void> {
    const response = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send verification email');
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, email: string): Promise<{ success: boolean; user?: User }> {
    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Email verification failed');
    }

    const data = await response.json();
    return {
      success: data.success,
      user: data.user,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request password reset');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; user?: User }> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email, newPassword }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Password reset failed');
    }

    const data = await response.json();
    return {
      success: data.success,
      user: data.user,
    };
  }
}

export const tokenManager = {
  /**
   * Get access token from storage
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access-token');
  },

  /**
   * Set access token in storage
   */
  setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access-token', token);
  },

  /**
   * Get refresh token from storage
   */
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh-token');
  },

  /**
   * Set refresh token in storage
   */
  setRefreshToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refresh-token', token);
  },

  /**
   * Set both access and refresh tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  },

  /**
   * Extract user data from JWT token
   */
  getUserFromToken(token: string): User | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = parts[1];
      if (!payload) {
        return null;
      }
      
      const decoded = JSON.parse(atob(payload));
      
      // Extract user data from token payload
      if (decoded.sub && decoded.email) {
        return {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role || 'STUDENT',
          emailVerified: decoded.emailVerified || false,
          createdAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
          updatedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        } as User;
      }
      
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Send email verification
   */
  async sendEmailVerification(email: string): Promise<void> {
    const response = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send verification email');
    }
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, email: string): Promise<{ success: boolean; user?: User }> {
    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Email verification failed');
    }

    const data = await response.json();
    return {
      success: data.success,
      user: data.user,
    };
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request password reset');
    }
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; user?: User }> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email, newPassword }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Password reset failed');
    }

    const data = await response.json();
    return {
      success: data.success,
      user: data.user,
    };
  },

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }
      
      const payload = parts[1];
      if (!payload) {
        return true;
      }
      
      const decoded = JSON.parse(atob(payload));
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  },

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Mock implementation - replace with actual API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          const newToken = 'new-access-token-' + Date.now();
          this.setAccessToken(newToken);
          resolve(newToken);
        } else {
          reject(new Error('Token refresh failed'));
        }
      }, 1000);
    });
  },

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access-token');
    localStorage.removeItem('refresh-token');
  },
};

// Create singleton instance
const tokenManagerInstance = new TokenManager();

// Add missing methods to the existing tokenManager object
Object.assign(tokenManager, {
  setTokens: tokenManagerInstance.setTokens.bind(tokenManagerInstance),
  getUserFromToken: tokenManagerInstance.getUserFromToken.bind(tokenManagerInstance),
  sendEmailVerification: tokenManagerInstance.sendEmailVerification.bind(tokenManagerInstance),
  verifyEmail: tokenManagerInstance.verifyEmail.bind(tokenManagerInstance),
  requestPasswordReset: tokenManagerInstance.requestPasswordReset.bind(tokenManagerInstance),
  resetPassword: tokenManagerInstance.resetPassword.bind(tokenManagerInstance),
});
