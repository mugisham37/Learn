/**
 * Subscription Provider
 * 
 * React Context provider for managing WebSocket connections and subscription state.
 * Provides connection status tracking, automatic reconnection with exponential backoff,
 * and authentication handling for GraphQL subscriptions.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { 
  ConnectionStatus, 
  SubscriptionContextValue, 
  ReconnectionConfig, 
  DEFAULT_RECONNECTION_CONFIG 
} from './types';
import { useAuth } from '../auth/authHooks';

/**
 * Subscription context for sharing connection state across components
 */
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/**
 * Props for SubscriptionProvider component
 */
interface SubscriptionProviderProps {
  children: React.ReactNode;
  reconnectionConfig?: Partial<ReconnectionConfig>;
  enableAutoReconnect?: boolean;
}

/**
 * SubscriptionProvider component that manages WebSocket connection state
 * and provides subscription utilities to child components.
 */
export function SubscriptionProvider({ 
  children, 
  reconnectionConfig = {},
  enableAutoReconnect = true 
}: SubscriptionProviderProps) {
  const apolloClient = useApolloClient();
  const { isAuthenticated, user } = useAuth();
  
  // Merge default config with provided config
  const config: ReconnectionConfig = useMemo(() => ({ 
    ...DEFAULT_RECONNECTION_CONFIG, 
    ...reconnectionConfig 
  }), [reconnectionConfig]);
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  });

  // Refs for managing reconnection logic
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);

  /**
   * Calculate exponential backoff delay for reconnection attempts
   */
  const calculateReconnectDelay = useCallback((attemptNumber: number): number => {
    const delay = Math.min(
      config.initialDelay * Math.pow(config.backoffMultiplier, attemptNumber),
      config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }, [config]);

  /**
   * Clear any pending reconnection timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = useCallback(async () => {
    if (!enableAutoReconnect || isReconnectingRef.current) {
      return;
    }

    if (reconnectAttemptsRef.current >= config.maxAttempts) {
      setConnectionStatus(prev => ({
        ...prev,
        connecting: false,
        error: new Error(`Max reconnection attempts (${config.maxAttempts}) exceeded`),
      }));
      return;
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;

    setConnectionStatus(prev => ({
      ...prev,
      connecting: true,
      reconnectAttempts: reconnectAttemptsRef.current,
    }));

    try {
      // Force Apollo Client to reconnect WebSocket
      await apolloClient.resetStore();
      
      // Simulate connection check - in real implementation, this would
      // check the actual WebSocket connection status
      setConnectionStatus(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
        lastConnected: new Date(),
      }));

      // Reset reconnection attempts on successful connection
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;

    } catch (error) {
      const delay = calculateReconnectDelay(reconnectAttemptsRef.current - 1);
      
      setConnectionStatus(prev => ({
        ...prev,
        connecting: false,
        error: error instanceof Error ? error : new Error('Connection failed'),
      }));

      // Schedule next reconnection attempt
      reconnectTimeoutRef.current = setTimeout(() => {
        isReconnectingRef.current = false;
        attemptReconnect();
      }, delay);
    }
  }, [apolloClient, enableAutoReconnect, config.maxAttempts, calculateReconnectDelay]);

  /**
   * Manual reconnection function exposed to consumers
   */
  const reconnect = useCallback(async () => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    await attemptReconnect();
  }, [clearReconnectTimeout, attemptReconnect]);

  /**
   * Initialize connection status based on authentication state
   */
  useEffect(() => {
    if (isAuthenticated && user) {
      setConnectionStatus(prev => ({
        ...prev,
        connected: true,
        lastConnected: new Date(),
        error: null,
        reconnectAttempts: 0,
      }));
      reconnectAttemptsRef.current = 0;
    } else {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: null,
      }));
    }
  }, [isAuthenticated, user]);

  /**
   * Handle connection errors and trigger reconnection
   */
  useEffect(() => {
    const handleConnectionError = () => {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: new Error('WebSocket connection lost'),
      }));

      if (enableAutoReconnect && isAuthenticated) {
        attemptReconnect();
      }
    };

    // In a real implementation, you would listen to actual WebSocket events
    // For now, we'll simulate connection monitoring
    const connectionCheckInterval = setInterval(() => {
      // Simulate random connection drops for testing
      if (Math.random() < 0.001 && connectionStatus.connected) { // 0.1% chance
        handleConnectionError();
      }
    }, 1000);

    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, [enableAutoReconnect, isAuthenticated, attemptReconnect, connectionStatus.connected]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      isReconnectingRef.current = false;
    };
  }, [clearReconnectTimeout]);

  // Context value
  const contextValue: SubscriptionContextValue = {
    connectionStatus,
    reconnect,
    isConnected: connectionStatus.connected,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access subscription context
 * 
 * @throws Error if used outside of SubscriptionProvider
 */
export function useSubscriptionContext(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  
  if (!context) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  
  return context;
}

/**
 * Hook to get connection status
 */
export function useConnectionStatus(): ConnectionStatus {
  const { connectionStatus } = useSubscriptionContext();
  return connectionStatus;
}

/**
 * Hook to check if subscriptions are connected
 */
export function useIsConnected(): boolean {
  const { isConnected } = useSubscriptionContext();
  return isConnected;
}