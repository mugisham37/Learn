/**
 * Authentication Hooks
 *
 * React hooks for authentication state management.
 */

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Hook for authentication state
 */
export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Mock authentication check
    const checkAuth = () => {
      const token = localStorage.getItem('access-token');
      if (token) {
        // Mock user data
        setAuthState({
          user: {
            id: '1',
            email: 'user@example.com',
            role: 'user',
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    checkAuth();
  }, []);

  return authState;
}