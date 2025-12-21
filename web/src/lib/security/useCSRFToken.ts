'use client';

/**
 * CSRF Token React Hook
 *
 * Client-side React hook for CSRF token management.
 */

import { useState, useEffect, useCallback } from 'react';
import { CSRFProtector } from './csrfProtection';

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