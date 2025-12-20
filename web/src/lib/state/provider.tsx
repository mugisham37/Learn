/**
 * State Provider Component
 * 
 * React provider component that provides global state management functionality.
 */

'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface AppState {
  user: any | null;
  theme: 'light' | 'dark';
  language: string;
  notifications: any[];
  loading: boolean;
  error: string | null;
}

export type AppAction = 
  | { type: 'SET_USER'; payload: any }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: any }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

export interface StateContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setUser: (user: any) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: string) => void;
  addNotification: (notification: any) => void;
  removeNotification: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

// =============================================================================
// Reducer
// =============================================================================

const initialState: AppState = {
  user: null,
  theme: 'light',
  language: 'en',
  notifications: [],
  loading: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] };
    case 'REMOVE_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.filter(n => n.id !== action.payload) 
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

const StateContext = createContext<StateContextValue | null>(null);

// =============================================================================
// Provider Component
// =============================================================================

export interface StateProviderProps {
  children: React.ReactNode;
  initialState?: Partial<AppState>;
}

export function StateProvider({ children, initialState: customInitialState }: StateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    ...customInitialState,
  });

  const setUser = useCallback((user: any) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const setLanguage = useCallback((language: string) => {
    dispatch({ type: 'SET_LANGUAGE', payload: language });
  }, []);

  const addNotification = useCallback((notification: any) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const contextValue: StateContextValue = {
    state,
    dispatch,
    setUser,
    setTheme,
    setLanguage,
    addNotification,
    removeNotification,
    setLoading,
    setError,
    resetState,
  };

  return (
    <StateContext.Provider value={contextValue}>
      {children}
    </StateContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

export function useAppState(): StateContextValue {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
}

export function useStateManager() {
  const { state, dispatch, ...actions } = useAppState();
  
  return {
    state,
    dispatch,
    actions,
  };
}