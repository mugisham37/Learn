/**
 * Authentication Provider
 *
 * React Context provider for authentication state management.
 * Handles login, logout, registration flows, email verification,
 * password reset, and session persistence with backend integration.
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
  sendEmailVerification: (email: string) => Promise<void>;
  verifyEmail: (token: string, email: string) => Promise<{ success: boolean; user?: User }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (
    token: string,
    email: string,
    newPassword: string
  ) => Promise<{ success: boolean; user?: User }>;
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
  | { type: 'SET_LOADING'; payload: { loading: boolean } }
  | { type: 'UPDATE_USER'; payload: { user: User } };

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

    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload.user,
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
        if (user && typeof user === 'object' && 'id' in user) {
          dispatch({ type: 'AUTH_SUCCESS', payload: { user: user as unknown as User } });
          return;
        }
      }

      // Try to refresh token if available
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken || process.env.NODE_ENV === 'production') {
        try {
          const newAccessToken = await tokenManager.refreshAccessToken();
          const user = tokenManager.getUserFromToken(newAccessToken);
          if (user && typeof user === 'object' && 'id' in user) {
            dispatch({ type: 'AUTH_SUCCESS', payload: { user: user as unknown as User } });
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
   * Login function with backend integration
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
        throw new Error(errorData.error || 'Login failed');
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
   * Logout function with backend integration
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
   * Registration function with backend integration
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
        throw new Error(errorData.error || 'Registration failed');
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
   * Refresh user data from backend
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
      dispatch({ type: 'UPDATE_USER', payload: { user: userData } });
    } catch (refreshError) {
      console.error('Failed to refresh user data:', refreshError);
      // Don't logout on refresh failure, just log the error
    }
  }, [state.isAuthenticated]);

  /**
   * Send email verification
   */
  const sendEmailVerification = useCallback(async (email: string) => {
    try {
      await tokenManager.sendEmailVerification(email);
    } catch (error) {
      const authError: AuthError = {
        code: 'EMAIL_VERIFICATION_SEND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send verification email',
      };
      dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
      throw error;
    }
  }, []);

  /**
   * Verify email with token
   */
  const verifyEmail = useCallback(
    async (token: string, email: string) => {
      try {
        const result = await tokenManager.verifyEmail(token, email);

        // If verification successful and user is currently authenticated, update user data
        if (result.success && result.user && state.isAuthenticated) {
          dispatch({ type: 'UPDATE_USER', payload: { user: result.user } });
        }

        return result;
      } catch (error) {
        const authError: AuthError = {
          code: 'EMAIL_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Email verification failed',
        };
        dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
        throw error;
      }
    },
    [state.isAuthenticated]
  );

  /**
   * Request password reset
   */
  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      await tokenManager.requestPasswordReset(email);
    } catch (error) {
      const authError: AuthError = {
        code: 'PASSWORD_RESET_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to request password reset',
      };
      dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
      throw error;
    }
  }, []);

  /**
   * Reset password with token
   */
  const resetPassword = useCallback(async (token: string, email: string, newPassword: string) => {
    try {
      const result = await tokenManager.resetPassword(token, email, newPassword);
      return result;
    } catch (error) {
      const authError: AuthError = {
        code: 'PASSWORD_RESET_FAILED',
        message: error instanceof Error ? error.message : 'Password reset failed',
      };
      dispatch({ type: 'AUTH_ERROR', payload: { error: authError } });
      throw error;
    }
  }, []);

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
    sendEmailVerification,
    verifyEmail,
    requestPasswordReset,
    resetPassword,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
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
