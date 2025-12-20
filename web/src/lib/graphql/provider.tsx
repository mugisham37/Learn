/**
 * GraphQL Provider Component
 * 
 * React provider component that wraps the application with Apollo Client.
 * Provides GraphQL capabilities to all child components.
 */

import React from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './client';

export interface GraphQLProviderProps {
  children: React.ReactNode;
  client?: typeof apolloClient;
}

/**
 * GraphQL Provider component that wraps the app with Apollo Client
 */
export function GraphQLProvider({ children, client = apolloClient }: GraphQLProviderProps) {
  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
}

/**
 * Hook to access the GraphQL client
 */
export function useGraphQLClient() {
  return apolloClient;
}