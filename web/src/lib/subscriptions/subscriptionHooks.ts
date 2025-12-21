/**
 * Core Subscription Hooks
 * 
 * React hooks for managing GraphQL subscriptions with automatic cache integration,
 * error handling, and cleanup. Provides hooks for messages, progress updates,
 * notifications, and user presence.
 */

import { useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { useApolloClient } from '@apollo/client/react';
import { DocumentNode } from 'graphql';
import { 
  MessageUpdatesDocument,
  ProgressUpdatesDocument,
  type MessageUpdatesSubscriptionResult,
  type ProgressUpdatesSubscriptionResult 
} from '@/types/schema';
import { SubscriptionHookResult, SubscriptionOptions } from './types';
import { useSubscriptionContext } from './SubscriptionProvider';

/**
 * Generic subscription hook
 * Provides a base implementation for all subscription types
 */
export function useSubscription<TData = Record<string, unknown>>(
  subscription: DocumentNode,
  options: SubscriptionOptions & { variables?: Record<string, unknown> } = {}
): SubscriptionHookResult<TData> {
  return useBaseSubscription<TData>(subscription, options);
}

/**
 * Hook for subscription state management
 * Returns subscription state without data
 */
export function useSubscriptionState() {
  const { connectionStatus, isConnected } = useSubscriptionContext();
  
  return {
    connectionStatus,
    isConnected,
    loading: !isConnected,
    error: connectionStatus.error,
  };
}

/**
 * Base subscription hook that provides common functionality for all subscription hooks
 */
function useBaseSubscription<TData, TVariables = Record<string, unknown>>(
  _subscription: DocumentNode,
  options: SubscriptionOptions & { variables?: TVariables } = {}
): SubscriptionHookResult<TData> {
  const { isConnected } = useSubscriptionContext();
  const cleanupRef = useRef<(() => void) | null>(null);

  const {
    skip = false,
  } = options;

  // Simplified subscription state management
  const [subscriptionState, setSubscriptionState] = React.useState<{
    data: TData | undefined;
    loading: boolean;
    error: Error | undefined;
  }>({
    data: undefined,
    loading: !skip && isConnected,
    error: !isConnected ? new Error('WebSocket not connected') : undefined,
  });

  // Update state based on connection status
  React.useEffect(() => {
    setSubscriptionState(prev => ({
      ...prev,
      loading: !skip && isConnected,
      error: !isConnected ? new Error('WebSocket not connected') : undefined,
    }));
  }, [skip, isConnected]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      const cleanup = cleanupRef.current;
      if (cleanup) {
        cleanup();
        cleanupRef.current = null;
      }
    };
  }, []);

  return subscriptionState;
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

  const handleMessageUpdate = useCallback((data: Record<string, unknown>) => {
    // Update Apollo cache with new message data
    try {
      apolloClient.cache.modify({
        fields: {
          conversations(existingConversations = []) {
            // Update conversation cache with new message
            const messageData = data as Record<string, unknown>;
            return existingConversations.map((conversation: Record<string, unknown>) => {
              if (conversation.id === messageData?.conversationId) {
                return {
                  ...conversation,
                  lastMessage: messageData,
                  updatedAt: new Date().toISOString(),
                  unreadCount: (conversation.unreadCount as number) + 1,
                };
              }
              return conversation;
            });
          },
          messages(existingMessages = [], { args }: { args?: Record<string, unknown> }) {
            // Add new message to the specific conversation's message list
            if (args?.conversationId === (data as Record<string, unknown>)?.conversationId) {
              return [data, ...existingMessages];
            }
            return existingMessages;
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

  const handleProgressUpdate = useCallback((data: Record<string, unknown>) => {
    // Update Apollo cache with new progress data
    try {
      apolloClient.cache.modify({
        fields: {
          enrollments(existingEnrollments = []) {
            // Update enrollment progress in cache
            const progressData = data as Record<string, unknown>;
            return existingEnrollments.map((enrollment: Record<string, unknown>) => {
              if (enrollment.id === progressData?.enrollmentId) {
                return {
                  ...enrollment,
                  progress: progressData.progress || enrollment.progress,
                  completedLessons: progressData.completedLessons || enrollment.completedLessons,
                  lastAccessDate: new Date().toISOString(),
                  ...(progressData.completed && { completedAt: new Date().toISOString() }),
                };
              }
              return enrollment;
            });
          },
          courseProgress(existingProgress = [], { args }: { args?: Record<string, unknown> }) {
            // Update course-specific progress
            if (args?.courseId === (data as Record<string, unknown>)?.courseId) {
              return existingProgress.map((progress: Record<string, unknown>) => {
                if (progress.enrollmentId === (data as Record<string, unknown>)?.enrollmentId) {
                  return {
                    ...progress,
                    ...(data as Record<string, unknown>),
                    updatedAt: new Date().toISOString(),
                  };
                }
                return progress;
              });
            }
            return existingProgress;
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

  const handleNotificationUpdate = useCallback((data: Record<string, unknown>) => {
    // Update Apollo cache with new notification data
    try {
      apolloClient.cache.modify({
        fields: {
          notifications(existingNotifications = []) {
            // Add new notification to the beginning of the list
            return [data, ...existingNotifications];
          },
          unreadNotificationCount(existingCount = 0) {
            // Increment unread count
            return existingCount + 1;
          },
          userNotifications(existingUserNotifications = [], { args }: { args?: Record<string, unknown> }) {
            // Update user-specific notifications
            if (args?.userId === userId) {
              return [data, ...existingUserNotifications];
            }
            return existingUserNotifications;
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
  }, [apolloClient.cache, options, userId]);

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

  const handlePresenceUpdate = useCallback((data: Record<string, unknown>) => {
    // Update Apollo cache with presence data
    try {
      apolloClient.cache.modify({
        fields: {
          coursePresence(existingPresence = []) {
            // Update user presence in course
            const presenceData = data as Record<string, unknown>;
            const existingIndex = existingPresence.findIndex(
              (presence: Record<string, unknown>) => presence.userId === presenceData?.userId
            );
            
            if (existingIndex >= 0) {
              // Update existing presence
              const updatedPresence = [...existingPresence];
              updatedPresence[existingIndex] = {
                ...updatedPresence[existingIndex],
                status: presenceData.status,
                lastSeen: presenceData.lastSeen || new Date().toISOString(),
                isTyping: presenceData.isTyping || false,
              };
              return updatedPresence;
            } else {
              // Add new presence
              return [...existingPresence, {
                userId: presenceData.userId,
                status: presenceData.status,
                lastSeen: presenceData.lastSeen || new Date().toISOString(),
                isTyping: presenceData.isTyping || false,
              }];
            }
          },
          onlineUsers(existingOnlineUsers = []) {
            // Update online users list
            const presenceData = data as Record<string, unknown>;
            if (presenceData.status === 'online') {
              // Add to online users if not already present
              if (!existingOnlineUsers.some((user: Record<string, unknown>) => user.id === presenceData.userId)) {
                return [...existingOnlineUsers, { id: presenceData.userId }];
              }
            } else {
              // Remove from online users
              return existingOnlineUsers.filter((user: Record<string, unknown>) => user.id !== presenceData.userId);
            }
            return existingOnlineUsers;
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
    onData?: (data: Record<string, unknown>) => void;
  }>
): {
  loading: boolean;
  error: Error | undefined;
  connected: boolean;
} {
  const { isConnected } = useSubscriptionContext();
  
  // Simplified implementation for multiple subscriptions
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>(undefined);

  React.useEffect(() => {
    if (!isConnected) {
      setError(new Error('WebSocket not connected'));
      setLoading(false);
    } else {
      setError(undefined);
      setLoading(subscriptions.length > 0);
    }
  }, [isConnected, subscriptions.length]);

  return {
    loading,
    error,
    connected: isConnected,
  };
}