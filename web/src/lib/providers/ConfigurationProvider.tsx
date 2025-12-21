/**
 * Configuration Provider Component
 *
 * React provider that initializes and manages application configuration.
 * Ensures all configuration systems are properly initialized before rendering children.
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initializeNextJSConfiguration,
  useInitializationStatus,
} from '@/lib/config/initialization';
import type { InitializationResult } from '@/types';

interface ConfigurationContextValue {
  initializationResult: InitializationResult | null;
  isReady: boolean;
  isLoading: boolean;
  errors: string[];
}

const ConfigurationContext = createContext<ConfigurationContextValue | null>(null);

export interface ConfigurationProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ errors: string[]; retry: () => void }>;
}

/**
 * Default loading fallback component
 */
function DefaultLoadingFallback() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='text-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
        <h2 className='text-lg font-semibold text-gray-900 mb-2'>Initializing Application</h2>
        <p className='text-gray-600'>Setting up configuration and connecting to services...</p>
      </div>
    </div>
  );
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ errors, retry }: { errors: string[]; retry: () => void }) {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6'>
        <div className='text-center mb-6'>
          <div className='mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4'>
            <svg
              className='h-6 w-6 text-red-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
          </div>
          <h2 className='text-lg font-semibold text-gray-900 mb-2'>Configuration Error</h2>
          <p className='text-gray-600 mb-4'>
            The application failed to initialize properly. Please check your configuration.
          </p>
        </div>

        <div className='mb-6'>
          <h3 className='text-sm font-medium text-gray-900 mb-2'>Issues found:</h3>
          <ul className='text-sm text-red-600 space-y-1'>
            {errors.map((error, index) => (
              <li key={index} className='flex items-start'>
                <span className='mr-2'>•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className='flex space-x-3'>
          <button
            onClick={retry}
            className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            className='flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
          >
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className='mt-4 p-3 bg-yellow-50 rounded-md'>
            <p className='text-xs text-yellow-800'>
              <strong>Development Mode:</strong> Check the console for detailed error information.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Configuration Provider Component
 */
export function ConfigurationProvider({
  children,
  fallback,
  errorFallback: ErrorFallback = DefaultErrorFallback,
}: ConfigurationProviderProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationKey, setInitializationKey] = useState(0);
  const { status, isReady } = useInitializationStatus();

  // Initialize configuration on mount
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setIsInitializing(true);
        await initializeNextJSConfiguration();
      } catch (error) {
        console.error('Configuration initialization failed:', error);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [initializationKey]);

  // Retry function
  const retry = () => {
    setInitializationKey(prev => prev + 1);
  };

  // Context value
  const contextValue: ConfigurationContextValue = {
    initializationResult: status,
    isReady,
    isLoading: isInitializing,
    errors: status?.errors || [],
  };

  // Show loading state
  if (isInitializing || !status) {
    return fallback || <DefaultLoadingFallback />;
  }

  // Show error state if initialization failed
  if (!isReady && status.errors.length > 0) {
    return <ErrorFallback errors={status.errors} retry={retry} />;
  }

  // Show warning for degraded state but allow app to continue
  if (isReady && status.errors.length > 0) {
    console.warn('⚠️  Application started with configuration warnings:', status.errors);
  }

  return (
    <ConfigurationContext.Provider value={contextValue}>{children}</ConfigurationContext.Provider>
  );
}

/**
 * Hook to access configuration context
 */
export function useConfiguration(): ConfigurationContextValue {
  const context = useContext(ConfigurationContext);

  if (!context) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }

  return context;
}

/**
 * Hook to check if configuration is ready
 */
export function useConfigurationReady(): boolean {
  const { isReady } = useConfiguration();
  return isReady;
}

/**
 * Hook to get configuration errors
 */
export function useConfigurationErrors(): string[] {
  const { errors } = useConfiguration();
  return errors;
}
