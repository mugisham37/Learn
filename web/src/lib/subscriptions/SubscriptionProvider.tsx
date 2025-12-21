/**
 * Subscription Provider
 *
 * React context provider for GraphQL subscriptions.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApolloClient } from '@apollo/client';

interface SubscriptionContextValue {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  client: ApolloClient | null;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isConnected: false,
  connectionStatus: 'disconnected',
  client: null,
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [contextValue, setContextValue] = useState<SubscriptionContextValue>({
    isConnected: true, // Initialize with connected state
    connectionStatus: 'connected',
    client: null, // Would be set to actual Apollo client in real implementation
  });

  useEffect(() => {
    // Mock connection logic - using setTimeout to avoid direct setState in effect
    const timer = setTimeout(() => {
      setContextValue(prev => ({
        ...prev,
        isConnected: true,
        connectionStatus: 'connected',
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