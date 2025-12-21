/**
 * Subscription System Types
 *
 * Type definitions for the real-time subscription system including
 * connection management, subscription lifecycle, and error handling.
 */

import { Observable } from '@apollo/client';
import { DocumentNode } from 'graphql';

/**
 * Connection status for WebSocket subscriptions
 */
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

/**
 * Subscription manager interface for managing WebSocket subscriptions
 */
export interface SubscriptionManager {
  subscribe<T>(subscription: DocumentNode, variables?: Record<string, unknown>): Observable<T>;
  unsubscribe(subscriptionId: string): void;
  getConnectionStatus(): ConnectionStatus;
  reconnect(): Promise<void>;
}

/**
 * Subscription context value provided by SubscriptionProvider
 */
export interface SubscriptionContextValue {
  connectionStatus: ConnectionStatus;
  reconnect: () => Promise<void>;
  isConnected: boolean;
}

/**
 * Subscription hook result interface
 */
export interface SubscriptionHookResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Subscription options for configuring subscription behavior
 */
export interface SubscriptionOptions {
  skip?: boolean;
  onSubscriptionData?: (data: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  shouldResubscribe?: boolean;
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default reconnection configuration with exponential backoff
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  maxAttempts: 10,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};
