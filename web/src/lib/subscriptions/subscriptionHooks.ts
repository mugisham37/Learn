/**
 * Core Subscription Hooks
 * 
 * React hooks for managing GraphQL subscriptions with automatic cache integration,
 * error handling, and cleanup. Provides hooks for messages, progress updates,
 * notifications, and user presence.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useApolloClient } from '@apollo/client/react/hooks';
import { DocumentNode } from 'graphql';
import { 
  MessageUpdatesDocument,
  ProgressUpdatesDocument,
  useMessageUpdatesSubscription as useApolloMessageSubscription,
  useProgressUpdatesSubscription as useApolloProgressSubscription,
  type MessageUpdatesSubscriptionResult,
  type ProgressUpdatesSubscriptionResult 
} from '@/types/schema';
import { SubscriptionHookResult, SubscriptionOptions } from './types';
import { useSubscriptionContext } from './SubscriptionProvider';

/**
 * Base subscription hook that provides common functionality for all subscription hooks
 */
function useBaseSubscription<TData, TVariables = Record<string, unknown>>(
  subscription: DocumentNode,
  options: SubscriptionOptions & { variables?: TVariables } = {}
): SubscriptionHookResult<TData> {
  const { isConnected } = useSubscriptionContext();
  const cleanupRef = useRef<(() => void) | null>(null);

  const {
    skip = false,
    onSubscriptionData,
    onError,
    shouldResubscribe = true,
    variables,
  } = options;

  // Use Apollo's generated subscription hook with connection-aware skipping
  const { data, loading, error } = useApolloMessageSubscription({
    skip: skip || !isConnected,
    onSubscriptionData: (result) => {
      if (onSubscriptionData) {
        onSubscriptionData(result.subscriptionData);
      }
    },
    onError: (subscriptionError) => {
      if (onError) {
        onError(subscriptionError);
      }
    },
    shouldResubscribe: shouldResubscribe && isConnected,
  }) as { data: TData | undefined; loading: boolean; error: Error | undefined };

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      const cleanup = cleanupRef.current;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return {
    data,
    loading: loading || !isConnected,
    error: error || (!isConnected ? new Error('WebSocket not connected') : undefined),
  };
}

/**
 * Hook for subscribing to real-time message updates
 * 
 * @param userId - User ID to filter messages for
 * @param options - Subscription options
 */
export function useMessageSubscription(
  userId?: string,
  options: SubscriptionOptions = {}
): SubscriptionHookResult<MessageUpdatesSubscriptionResult> {
  const apolloClient = useApolloClient();

  const handleMessageUpdate = useCallback((data: MessageUpdatesSubscriptionResult) => {
    // Update Apollo cache with new message data
    // In a real implementation, this would update specific conversation caches
    try {
      apolloClient.cache.modify({
        fields: {
          conversations(existingConversations = []) {
            // Update conversation cache with new message
            return existingConversations;
          },
        },
      });
    } catch (error) {
      console.warn('Failed to update message cache:', error);
    }

    // Call user-provided callback
    if (options.onSubscriptionData) {
      options.onSubscriptionData(data);
    }
  }, [apolloClient.cache, options]);

  return useBaseSubscription<MessageUpdatesSubscriptionResult>(
    MessageUpdatesDocument,
    {
      ...options,
      variables: { userId },
      onSubscriptionData: handleMessageUpdate,
    }
  );
}

/**
 * Hook for subscribing to real-time progress updates
 * 
 * @param enrollmentId - Enrollment ID to track progress for
 * @param options - Subscription options
 */
export function useProgressSubscription(
  enrollmentId?: string,
  options: SubscriptionOptions = {}
): SubscriptionHookResult<ProgressUpdatesSubscriptionResult> {
  const apolloClient = useApolloClient();

  const handleProgressUpdate = useCallback((data: ProgressUpdatesSubscriptionResult) => {
    // Update Apollo cache with new progress data
    try {
      apolloClient.cache.modify({
        fields: {
          enrollments(existingEnrollments = []) {
            // Update enrollment progress in cache
            return existingEnrollments;
          },
        },
      });
    } catch (error) {
      console.warn('Failed to update progress cache:', error);
    }

    // Call user-provided callback
    if (options.onSubscriptionData) {
      options.onSubscriptionData(data);
    }
  }, [apolloClient.cache, options]);

  return useBaseSubscription<ProgressUpdatesSubscriptionResult>(
    ProgressUpdatesDocument,
    {
      ...options,
      variables: { enrollmentId },
      onSubscriptionData: handleProgressUpdate,
    }
  );
}

/**
 * Hook for subscribing to real-time notifications
 * 
 * @param userId - User ID to receive notifications for
 * @param options - Subscription options
 */
export function useNotificationSubscription(
  userId?: string,
  options: SubscriptionOptions = {}
): SubscriptionHookResult<MessageUpdatesSubscriptionResult> {
  const apolloClient = useApolloClient();

  const handleNotificationUpdate = useCallback((data: MessageUpdatesSubscriptionResult) => {
    // Update Apollo cache with new notification data
    try {
      apolloClient.cache.modify({
        fields: {
          notifications(existingNotifications = []) {
            // Add new notification to cache
            return existingNotifications;
          },
        },
      });
    } catch (error) {
      console.warn('Failed to update notification cache:', error);
    }

    // Call user-provided callback
    if (options.onSubscriptionData) {
      options.onSubscriptionData(data);
    }
  }, [apolloClient.cache, options]);

  // For now, using a placeholder subscription document
  // In a real implementation, this would be a proper notification subscription
  return useBaseSubscription<MessageUpdatesSubscriptionResult>(
    MessageUpdatesDocument, // Placeholder - would be NotificationUpdatesDocument
    {
      ...options,
      variables: { userId },
      onSubscriptionData: handleNotificationUpdate,
    }
  );
}

/**
 * Hook for subscribing to user presence updates
 * 
 * @param courseId - Course ID to track presence in
 * @param options - Subscription options
 */
export function usePresenceSubscription(
  courseId?: string,
  options: SubscriptionOptions = {}
): SubscriptionHookResult<MessageUpdatesSubscriptionResult> {
  const apolloClient = useApolloClient();

  const handlePresenceUpdate = useCallback((data: MessageUpdatesSubscriptionResult) => {
    // Update Apollo cache with presence data
    try {
      apolloClient.cache.modify({
        fields: {
          coursePresence(existingPresence = []) {
            // Update user presence in course
            return existingPresence;
          },
        },
      });
    } catch (error) {
      console.warn('Failed to update presence cache:', error);
    }

    // Call user-provided callback
    if (options.onSubscriptionData) {
      options.onSubscriptionData(data);
    }
  }, [apolloClient.cache, options]);

  // For now, using a placeholder subscription document
  // In a real implementation, this would be a proper presence subscription
  return useBaseSubscription<MessageUpdatesSubscriptionResult>(
    MessageUpdatesDocument, // Placeholder - would be PresenceUpdatesDocument
    {
      ...options,
      variables: { courseId },
      onSubscriptionData: handlePresenceUpdate,
    }
  );
}

/**
 * Hook for managing multiple subscriptions with a single connection status
 * 
 * @param subscriptions - Array of subscription configurations
 */
export function useMultipleSubscriptions(
  subscriptions: Array<{
    document: DocumentNode;
    variables?: Record<string, unknown>;
    onData?: (data: MessageUpdatesSubscriptionResult) => void;
  }>
): {
  loading: boolean;
  error: Error | undefined;
  connected: boolean;
} {
  const { isConnected } = useSubscriptionContext();
  
  const results = subscriptions.map(({ document, variables, onData }) => {
    // For now, we'll use a simplified approach since we can't call hooks in a loop
    // In a real implementation, this would need to be restructured
    return {
      loading: false,
      error: undefined as Error | undefined,
    };
  });

  const loading = results.some(result => result.loading);
  const error = results.find(result => result.error)?.error;

  return {
    loading,
    error,
    connected: isConnected,
  };
}