/**
 * Token Storage and Management
 *
 * Handles JWT token storage, retrieval, and refresh logic for authentication.
 */

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
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
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