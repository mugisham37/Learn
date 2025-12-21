/**
 * Socket.io Client Integration
 *
 * Manages WebSocket connection to backend Socket.io server with authentication,
 * automatic reconnection, and event handling for real-time features.
 *
 * Features:
 * - Authenticated WebSocket connections with JWT tokens
 * - Automatic reconnection with exponential backoff
 * - Room management for course-specific and user-specific events
 * - Presence tracking and activity management
 * - Event routing and handler registration
 */

// Mock Socket.io types for now - replace with actual socket.io-client when available
interface Socket {
  connected: boolean;
  connecting: boolean;
  auth?: { token: string };
  connect(): void;
  disconnect(): void;
  emit(event: string, ...args: unknown[]): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler?: (...args: unknown[]) => void): void;
}

function io(url: string, options?: Record<string, unknown>): Socket {
  // Mock implementation - replace with actual socket.io-client
  // Use parameters to avoid unused warnings
  console.debug('Mock socket.io client for:', url, options);
  return {
    connected: false,
    connecting: false,
    auth: { token: '' },
    connect() { /* mock */ },
    disconnect() { /* mock */ },
    emit() { /* mock */ },
    on() { /* mock */ },
    off() { /* mock */ },
  };
}

import { config } from '../config';
import { tokenManager } from '../auth/tokenStorage';

/**
 * Socket.io client instance
 */
let socket: Socket | null = null;

/**
 * Connection status
 */
export interface SocketConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
}

/**
 * Event handler type
 */
export type SocketEventHandler = (data: unknown) => void;

/**
 * Socket event names matching backend SUBSCRIPTION_EVENTS
 */
export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed',

  // Notification events
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  UNREAD_COUNT_CHANGED: 'UNREAD_COUNT_CHANGED',

  // Message events
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  CONVERSATION_UPDATED: 'CONVERSATION_UPDATED',

  // Discussion events
  NEW_DISCUSSION_POST: 'NEW_DISCUSSION_POST',
  THREAD_UPDATED: 'THREAD_UPDATED',
  POST_VOTED: 'POST_VOTED',

  // Announcement events
  ANNOUNCEMENT_PUBLISHED: 'ANNOUNCEMENT_PUBLISHED',

  // Presence events
  USER_PRESENCE: 'USER_PRESENCE',
  TYPING_INDICATOR: 'TYPING_INDICATOR',

  // Progress events
  ENROLLMENT_PROGRESS_UPDATED: 'ENROLLMENT_PROGRESS_UPDATED',
  LESSON_PROGRESS_UPDATED: 'LESSON_PROGRESS_UPDATED',
  CERTIFICATE_GENERATED: 'CERTIFICATE_GENERATED',
  COURSE_COMPLETED: 'COURSE_COMPLETED',
} as const;

/**
 * Creates and configures Socket.io client
 */
export function createSocketClient(): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  // Get access token for authentication
  const accessToken = tokenManager.getAccessToken();

  // Create Socket.io client with authentication
  socket = io(config.wsEndpoint, {
    auth: {
      token: accessToken || '',
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
    autoConnect: true,
  });

  // Setup connection event handlers
  socket.on(SOCKET_EVENTS.CONNECT, () => {
    console.log('Socket.io connected');
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, reason => {
    console.log('Socket.io disconnected:', reason);
  });

  socket.on(SOCKET_EVENTS.CONNECT_ERROR, error => {
    console.error('Socket.io connection error:', error);
  });

  socket.on(SOCKET_EVENTS.RECONNECT, attemptNumber => {
    console.log('Socket.io reconnected after', attemptNumber, 'attempts');
  });

  socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, attemptNumber => {
    console.log('Socket.io reconnection attempt:', attemptNumber);

    // Refresh token before reconnection attempt
    const currentToken = tokenManager.getAccessToken();
    if (currentToken && tokenManager.isTokenExpired(currentToken)) {
      tokenManager
        .refreshAccessToken()
        .then(newToken => {
          if (socket && socket.auth) {
            socket.auth.token = newToken;
          }
        })
        .catch(error => {
          console.error('Token refresh failed during reconnection:', error);
        });
    }
  });

  socket.on(SOCKET_EVENTS.RECONNECT_ERROR, error => {
    console.error('Socket.io reconnection error:', error);
  });

  socket.on(SOCKET_EVENTS.RECONNECT_FAILED, () => {
    console.error('Socket.io reconnection failed after maximum attempts');
  });

  return socket;
}

/**
 * Gets the Socket.io client instance
 */
export function getSocketClient(): Socket | null {
  return socket;
}

/**
 * Connects to Socket.io server
 */
export function connectSocket(): void {
  if (!socket) {
    createSocketClient();
  } else if (!socket.connected) {
    socket.connect();
  }
}

/**
 * Disconnects from Socket.io server
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

/**
 * Joins a Socket.io room
 */
export function joinRoom(roomName: string): void {
  if (socket && socket.connected) {
    socket.emit('join-room', roomName);
  }
}

/**
 * Leaves a Socket.io room
 */
export function leaveRoom(roomName: string): void {
  if (socket && socket.connected) {
    socket.emit('leave-room', roomName);
  }
}

/**
 * Subscribes to a Socket.io event
 */
export function subscribeToEvent(eventName: string, handler: SocketEventHandler): () => void {
  if (!socket) {
    createSocketClient();
  }

  if (socket) {
    socket.on(eventName, handler);

    // Return unsubscribe function
    return () => {
      if (socket) {
        socket.off(eventName, handler);
      }
    };
  }

  return () => {};
}

/**
 * Emits a Socket.io event
 */
export function emitEvent(eventName: string, data: unknown): void {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
  }
}

/**
 * Gets current connection status
 */
export function getConnectionStatus(): SocketConnectionStatus {
  if (!socket) {
    return {
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    };
  }

  return {
    connected: socket.connected,
    connecting: socket.connecting,
    error: null,
    reconnectAttempts: 0,
  };
}

/**
 * Updates presence status
 */
export function updatePresence(status: 'online' | 'away' | 'busy' | 'offline'): void {
  emitEvent('update-presence', { status });
}

/**
 * Sends typing indicator
 */
export function sendTypingIndicator(conversationId: string, isTyping: boolean): void {
  emitEvent('typing-indicator', { conversationId, isTyping });
}

/**
 * Joins a course room for real-time updates
 */
export function joinCourseRoom(courseId: string): void {
  joinRoom(`course:${courseId}`);
}

/**
 * Leaves a course room
 */
export function leaveCourseRoom(courseId: string): void {
  leaveRoom(`course:${courseId}`);
}

/**
 * Joins a conversation room for real-time messaging
 */
export function joinConversationRoom(conversationId: string): void {
  joinRoom(`conversation:${conversationId}`);
}

/**
 * Leaves a conversation room
 */
export function leaveConversationRoom(conversationId: string): void {
  leaveRoom(`conversation:${conversationId}`);
}

/**
 * Export socket client utilities
 */
const socketClientUtils = {
  createSocketClient,
  getSocketClient,
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  subscribeToEvent,
  emitEvent,
  getConnectionStatus,
  updatePresence,
  sendTypingIndicator,
  joinCourseRoom,
  leaveCourseRoom,
  joinConversationRoom,
  leaveConversationRoom,
  SOCKET_EVENTS,
};

export default socketClientUtils;
