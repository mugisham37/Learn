/**
 * Authentication Provider
 * 
 * React Context provider for authentication state management.
 * Handles login, logout, registration flows and session persistence.
 */

'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { tokenManager } from './tokenStorage';
import type { AuthState, AuthError, User } from '@/types';

/**
 * Authentication context interface
 */
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

/**
 * Authentication actions
 */
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User } }
  | { type: 'AUTH_ERROR'; payload: { error: AuthError } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: { loading: boolean } };

/**
 * Authentication reducer
 */
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_ERROR':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case 'AUTH_LOGOUT':
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.loading,
      };

    default:
      return state;
  }
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true to check for existing session
  error: null,
};

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider props
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication provider component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Initialize authentication state from stored tokens
   */
  const initializeAuth = useCallback(async () => {
    try {
      const accessToken = tokenManager.getAccessToken();
      
      if (accessToken && !tokenManager.isTokenExpired(accessToken)) {
        // Extract user from valid token
        const user = tokenManager.getUserFromToken(accessToken);
        if (user) {
          dispatch({ type: 'AUTH_SUCCESS', payload: { user: user as User } });
          return;
        }
      }

      // Try to refresh token if available
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        try {
          const newAccessToken = await tokenManager.refreshAccessToken();
          const user = tokenManager.getUserFromToken(newAccessToken);
          if (user) {
            dispatch({ type: 'AUTH_SUCCESS', payload: { user: user as User } });
            return;
          }
        } catch (refreshError) {
          console.warn('Token refresh failed during initialization:', refreshError);
        }
      }

      // No valid authentication found
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (initError) {
      console.error('Auth initialization failed:', initError);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  /**
   * Login function
   */
  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Include cookies for httpOnly token handling
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      
      if (!data.accessToken || !data.user) {
        throw new Error('Invalid login response');
      }

      // Store tokens
      tokenManager.setTokens(data.accessToken, data.refreshToken);

      // Update auth state
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: data.user } });
    } catch (error) {
      const authError: AuthError = {
        code: 'LOGIN_FAILED',
        message: error instanceof Error ? error.message : 'Login failed',
      };
      dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
      throw error;
    }
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { loading: true } });

    try {
      // Call logout endpoint to invalidate server-side session
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.warn('Logout API call failed:', logoutError);
      // Continue with client-side logout even if server call fails
    }

    // Clear tokens and update state
    tokenManager.clearTokens();
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  /**
   * Registration function
   */
  const register = useCallback(async (email: string, password: string, fullName: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, fullName }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      
      if (!data.accessToken || !data.user) {
        throw new Error('Invalid registration response');
      }

      // Store tokens
      tokenManager.setTokens(data.accessToken, data.refreshToken);

      // Update auth state
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: data.user } });
    } catch (error) {
      const authError: AuthError = {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed',
      };
      dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
      throw error;
    }
  }, []);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) {
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: userData } });
    } catch (refreshError) {
      console.error('Failed to refresh user data:', refreshError);
      // Don't logout on refresh failure, just log the error
    }
  }, [state.isAuthenticated]);

  /**
   * Clear authentication error
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  /**
   * Handle token expiration events
   */
  useEffect(() => {
    const handleTokenExpired = () => {
      console.warn('Token expired, logging out user');
      dispatch({ type: 'AUTH_LOGOUT' });
      tokenManager.clearTokens();
    };

    // Listen for token expiration events from the auth link
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:token-expired', handleTokenExpired);
      
      return () => {
        window.removeEventListener('auth:token-expired', handleTokenExpired);
      };
    }
    
    return undefined;
  }, []);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * Context value
   */
  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    register,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}