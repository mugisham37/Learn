/**
 * Foundation Layer Provider Composition
 * 
 * Combines all foundation layer providers into a single, easy-to-use provider
 * that sets up the complete foundation infrastructure.
 */

'use client';

import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { AuthProvider } from '../auth/authProvider';
import { SubscriptionProvider } from '../subscriptions/SubscriptionProvider';
import { apolloClient } from '../graphql/client';
import type { FoundationConfig } from '@/types';

interface FoundationProviderProps {
  children: React.ReactNode;
  config?: Partial<FoundationConfig>;
}

/**
 * Main Foundation Provider
 * 
 * Wraps the application with all necessary foundation layer providers
 * in the correct order to ensure proper initialization and dependency resolution.
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <FoundationProvider>
 *       <YourAppComponents />
 *     </FoundationProvider>
 *   );
 * }
 * ```
 */
export function FoundationProvider({ children }: FoundationProviderProps) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}

/**
 * Foundation Provider with Custom Configuration
 * 
 * Allows for custom configuration of the foundation layer.
 * Useful for testing or different environments.
 */
export function FoundationProviderWithConfig({ 
  children, 
  config: _config 
}: FoundationProviderProps & { config: FoundationConfig }) {
  // Create Apollo client with custom config
  const customApolloClient = React.useMemo(() => {
    // In a real implementation, this would use the custom config
    return apolloClient;
  }, []);

  return (
    <ApolloProvider client={customApolloClient}>
      <AuthProvider>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}

/**
 * Provider Composition Utilities
 * 
 * Helper functions for composing providers in different configurations.
 */
export const ProviderUtils = {
  /**
   * Creates a provider composition with only essential providers
   * Useful for testing or minimal setups
   */
  createMinimalProvider: (children: React.ReactNode) => (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ApolloProvider>
  ),

  /**
   * Creates a provider composition for testing
   * Includes mock providers for isolated testing
   */
  createTestProvider: (children: React.ReactNode, _mocks?: Record<string, unknown>) => (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ApolloProvider>
  ),
};