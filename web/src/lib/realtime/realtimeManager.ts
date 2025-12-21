/**
 * Real-time Manager
 *
 * Centralized manager for all real-time communication including GraphQL subscriptions
 * and Socket.io events. Provides unified interface for real-time features with
 * automatic connection management, authentication, and cache integration.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/authHooks';
import socketClient, {
  SOCKET_EVENTS,
  SocketEventHandler,
  getConnectionStatus as getSocketStatus,
} from './socketClient';
import { useSubscriptionContext } from '../subscriptions/SubscriptionProvider';

/**
 * Real-time event types
 */
export interface RealtimeEvent {
  type: string;
  data: unknown;
  timestamp: Date;
  source: 'graphql' | 'socket';
}

/**
 * Real-time manager hook
 */
export function useRealtimeManager() {
  const { user, isAuthenticated } = useAuth();
  const { isConnected: graphqlConnected, client: apolloClient } = useSubscriptionContext();
  const eventHandlersRef = useRef<Map<string, Set<SocketEventHandler>>>(new Map());

  /**
   * Initialize real-time connections
   */
  const initializeConnections = useCallback(() => {
    if (isAuthenticated && user) {
      // Connect Socket.io client
      socketClient.connectSocket();

      // Join user-specific room
      socketClient.joinRoom(`user:${user.id}`);

      // Join role-specific room if applicable
      if (user.role) {
        socketClient.joinRoom(`role:${user.role}`);
      }
    }
  }, [isAuthenticated, user]);

  /**
   * Cleanup connections
   */
  const cleanupConnections = useCallback(() => {
    if (user) {
      // Leave user-specific rooms
      socketClient.leaveRoom(`user:${user.id}`);

      if (user.role) {
        socketClient.leaveRoom(`role:${user.role}`);
      }
    }

    // Disconnect Socket.io
    socketClient.disconnectSocket();
  }, [user]);

  /**
   * Subscribe to real-time event
   */
  const subscribeToEvent = useCallback(
    (eventName: string, handler: SocketEventHandler): (() => void) => {
      // Add handler to local registry
      if (!eventHandlersRef.current.has(eventName)) {
        eventHandlersRef.current.set(eventName, new Set());
      }
      eventHandlersRef.current.get(eventName)!.add(handler);

      // Subscribe to Socket.io event
      const unsubscribeSocket = socketClient.subscribeToEvent(eventName, handler);

      // Return combined unsubscribe function
      return () => {
        // Remove from local registry
        const handlers = eventHandlersRef.current.get(eventName);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            eventHandlersRef.current.delete(eventName);
          }
        }

        // Unsubscribe from Socket.io
        unsubscribeSocket();
      };
    },
    []
  );

  /**
   * Handle notification events with cache updates
   */
  const handleNotificationEvent = useCallback(
    (data: unknown) => {
      try {
        // Update Apollo cache with new notification if client is available
        if (apolloClient) {
          apolloClient.cache.modify({
            fields: {
              notifications(existingNotifications = []) {
                // Add new notification to the beginning of the list
                return [data, ...existingNotifications];
              },
              unreadNotificationCount(existingCount = 0) {
                return existingCount + 1;
              },
            },
          });
        } else {
          console.log('Notification received (no client):', data);
        }
      } catch (error) {
        console.error('Failed to update notification cache:', error);
      }
    },
    [apolloClient]
  );

  /**
   * Handle message events with cache updates
   */
  const handleMessageEvent = useCallback(
    (data: unknown) => {
      try {
        if (apolloClient) {
          const messageData = data as { conversationId?: string; [key: string]: unknown };
          // Update Apollo cache with new message
          apolloClient.cache.modify({
            fields: {
              conversations(existingConversations = []) {
                // Update the specific conversation with new message
                return existingConversations.map((conversation: { id: string; [key: string]: unknown }) => {
                  if (conversation.id === messageData?.conversationId) {
                    return {
                      ...conversation,
                      lastMessage: data,
                      updatedAt: new Date().toISOString(),
                    };
                  }
                  return conversation;
                });
              },
            },
          });
        } else {
          console.log('Message received (no client):', data);
        }
      } catch (error) {
        console.error('Failed to update message cache:', error);
      }
    },
    [apolloClient]
  );

  /**
   * Handle progress events with cache updates
   */
  const handleProgressEvent = useCallback(
    (data: unknown) => {
      try {
        if (apolloClient) {
          const progressData = data as { enrollmentId?: string; progress?: number; [key: string]: unknown };
          // Update Apollo cache with progress data
          apolloClient.cache.modify({
            fields: {
              enrollments(existingEnrollments = []) {
                return existingEnrollments.map((enrollment: { id: string; progress?: number; [key: string]: unknown }) => {
                  if (enrollment.id === progressData?.enrollmentId) {
                    return {
                      ...enrollment,
                      progress: progressData?.progress || enrollment.progress,
                      updatedAt: new Date().toISOString(),
                    };
                  }
                  return enrollment;
                });
              },
            },
          });
        } else {
          console.log('Progress updated (no client):', data);
        }
      } catch (error) {
        console.error('Failed to update progress cache:', error);
      }
    },
    [apolloClient]
  );

  /**
   * Handle presence events with cache updates
   */
  const handlePresenceEvent = useCallback(
    (data: unknown) => {
      try {
        if (apolloClient) {
          const presenceData = data as { userId?: string; status?: string; lastSeen?: string; [key: string]: unknown };
          // Update Apollo cache with presence data
          apolloClient.cache.modify({
            fields: {
              coursePresence(existingPresence = []) {
                return existingPresence.map((presence: { userId: string; status?: string; lastSeen?: string; [key: string]: unknown }) => {
                  if (presence.userId === presenceData?.userId) {
                    return {
                      ...presence,
                      status: presenceData.status,
                      lastSeen: presenceData.lastSeen || new Date().toISOString(),
                    };
                  }
                  return presence;
                });
              },
            },
          });
        } else {
          console.log('Presence updated (no client):', data);
        }
      } catch (error) {
        console.error('Failed to update presence cache:', error);
      }
    },
    [apolloClient]
  );

  /**
   * Get connection status for both GraphQL and Socket.io
   */
  const getConnectionStatus = useCallback(() => {
    const socketStatus = getSocketStatus();

    return {
      graphql: {
        connected: graphqlConnected,
      },
      socket: {
        connected: socketStatus.connected,
        connecting: socketStatus.connecting,
        error: socketStatus.error,
        reconnectAttempts: socketStatus.reconnectAttempts,
      },
      overall: {
        connected: graphqlConnected && socketStatus.connected,
        hasErrors: !!socketStatus.error,
      },
    };
  }, [graphqlConnected]);

  /**
   * Join course room for real-time updates
   */
  const joinCourse = useCallback((courseId: string) => {
    socketClient.joinCourseRoom(courseId);
  }, []);

  /**
   * Leave course room
   */
  const leaveCourse = useCallback((courseId: string) => {
    socketClient.leaveCourseRoom(courseId);
  }, []);

  /**
   * Join conversation for real-time messaging
   */
  const joinConversation = useCallback((conversationId: string) => {
    socketClient.joinConversationRoom(conversationId);
  }, []);

  /**
   * Leave conversation
   */
  const leaveConversation = useCallback((conversationId: string) => {
    socketClient.leaveConversationRoom(conversationId);
  }, []);

  /**
   * Update user presence status
   */
  const updatePresence = useCallback((status: 'online' | 'away' | 'busy' | 'offline') => {
    socketClient.updatePresence(status);
  }, []);

  /**
   * Send typing indicator
   */
  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    socketClient.sendTypingIndicator(conversationId, isTyping);
  }, []);

  // Initialize connections when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initializeConnections();
    } else {
      cleanupConnections();
    }

    return cleanupConnections;
  }, [isAuthenticated, initializeConnections, cleanupConnections]);

  // Setup default event handlers
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Subscribe to notification events
    unsubscribers.push(
      subscribeToEvent(SOCKET_EVENTS.NOTIFICATION_RECEIVED, handleNotificationEvent)
    );

    // Subscribe to message events
    unsubscribers.push(subscribeToEvent(SOCKET_EVENTS.MESSAGE_RECEIVED, handleMessageEvent));

    // Subscribe to progress events
    unsubscribers.push(
      subscribeToEvent(SOCKET_EVENTS.ENROLLMENT_PROGRESS_UPDATED, handleProgressEvent),
      subscribeToEvent(SOCKET_EVENTS.LESSON_PROGRESS_UPDATED, handleProgressEvent),
      subscribeToEvent(SOCKET_EVENTS.COURSE_COMPLETED, handleProgressEvent)
    );

    // Subscribe to presence events
    unsubscribers.push(subscribeToEvent(SOCKET_EVENTS.USER_PRESENCE, handlePresenceEvent));

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [
    subscribeToEvent,
    handleNotificationEvent,
    handleMessageEvent,
    handleProgressEvent,
    handlePresenceEvent,
  ]);

  return {
    // Connection management
    getConnectionStatus,

    // Room management
    joinCourse,
    leaveCourse,
    joinConversation,
    leaveConversation,

    // Presence and activity
    updatePresence,
    sendTypingIndicator,

    // Event subscription
    subscribeToEvent,
  };
}

/**
 * Real-time provider hook for managing global real-time state
 */
export function useRealtimeProvider() {
  const realtimeManager = useRealtimeManager();

  return realtimeManager;
}

/**
 * Export real-time utilities
 */
const realtimeUtils = {
  useRealtimeManager,
  useRealtimeProvider,
};

export default realtimeUtils;
