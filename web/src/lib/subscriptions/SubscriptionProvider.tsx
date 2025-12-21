/**
 * Subscription Provider
 *
 * React context provider for GraphQL subscriptions.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApolloClient } from '@apollo/client';
import { ConnectionStatus } from './types';

interface SubscriptionContextValue {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  client: ApolloClient | null;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isConnected: false,
  connectionStatus: {
    connected: false,
    connecting: false,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  },
  client: null,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [contextValue, setContextValue] = useState<SubscriptionContextValue>({
    isConnected: true, // Initialize with connected state
    connectionStatus: {
      connected: true,
      connecting: false,
      error: null,
      lastConnected: new Date(),
      reconnectAttempts: 0,
    },
    client: null, // Would be set to actual Apollo client in real implementation
  });

  useEffect(() => {
    // Mock connection logic - using setTimeout to avoid direct setState in effect
    const timer = setTimeout(() => {
      setContextValue(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: {
          connected: true,
          connecting: false,
          error: null,
          lastConnected: new Date(),
          reconnectAttempts: 0,
        },
      }));
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}

export function useConnectionStatus() {
  const { connectionStatus } = useSubscriptionContext();
  return connectionStatus;
}

export function useIsConnected() {
  const { isConnected } = useSubscriptionContext();
  return isConnected;
}