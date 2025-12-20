/**
 * Real-time Communication Infrastructure
 * 
 * Comprehensive real-time system that integrates GraphQL subscriptions and Socket.io
 * for seamless real-time features including messaging, presence, notifications,
 * and progress updates.
 */

// Socket.io client
export { default as socketClient } from './socketClient';
export type { SocketConnectionStatus, SocketEventHandler } from './socketClient';
export { SOCKET_EVENTS } from './socketClient';

// Real-time manager
export { useRealtimeManager, useRealtimeProvider } from './realtimeManager';
export type { RealtimeEvent } from './realtimeManager';

// Real-time provider and hooks
export { default as RealtimeProvider } from './RealtimeProvider';
export {
  useRealtime,
  useRealtimeStatus,
  useCourseRealtime,
  useConversationRealtime,
  usePresenceManager,
} from './RealtimeProvider';

// Re-export subscription system
export {
  SubscriptionProvider,
  useSubscriptionContext,
  useConnectionStatus,
  useIsConnected,
} from '../subscriptions/SubscriptionProvider';

export {
  useSubscription,
  useSubscriptionState,
  useMessageSubscription,
  useProgressSubscription,
  useNotificationSubscription,
  usePresenceSubscription,
  useMultipleSubscriptions,
} from '../subscriptions/subscriptionHooks';

export type {
  ConnectionStatus,
  SubscriptionManager,
  SubscriptionContextValue,
  SubscriptionHookResult,
  SubscriptionOptions,
  ReconnectionConfig,
} from '../subscriptions/types';

export { DEFAULT_RECONNECTION_CONFIG } from '../subscriptions/types';

// Cache integration
export {
  updateCacheWithSubscriptionData,
  invalidateCacheForEntity,
  getCacheUpdateStrategy,
  createOptimisticResponse,
} from '../subscriptions/cacheIntegration';

export type {
  CacheUpdateStrategy,
  CacheInvalidationRule,
  SubscriptionCacheConfig,
} from '../subscriptions/cacheIntegration';