/**
 * Subscription Provider
 *
 * React context provider for GraphQL subscriptions.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SubscriptionContextValue {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isConnected: false,
  connectionStatus: 'disconnected',
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [contextValue, setContextValue] = useState<SubscriptionContextValue>({
    isConnected: false,
    connectionStatus: 'disconnected',
  });

  useEffect(() => {
    // Mock connection logic
    setContextValue({
      isConnected: true,
      connectionStatus: 'connected',
    });
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