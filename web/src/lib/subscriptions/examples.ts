/**
 * Subscription System Usage Examples
 * 
 * Examples demonstrating how to use the subscription system in React components.
 * These examples show best practices for real-time data integration.
 */

import React, { useEffect } from 'react';
import {
  useMessageSubscription,
  useProgressSubscription,
  useNotificationSubscription,
  usePresenceSubscription,
  useConnectionStatus,
  useIsConnected,
} from './subscriptionHooks';

/**
 * Example: Chat component with real-time messages
 */
export function ChatExample({ userId }: { userId: string }) {
  const { data: messageData, loading, error } = useMessageSubscription(userId, {
    onSubscriptionData: (data) => {
      console.log('New message received:', data);
      // Handle new message (e.g., show notification, play sound)
    },
    onError: (error) => {
      console.error('Message subscription error:', error);
    },
  });

  const connectionStatus = useConnectionStatus();

  return (
    <div>
      <div>Connection Status: {connectionStatus.connected ? 'Connected' : 'Disconnected'}</div>
      {loading && <div>Loading messages...</div>}
      {error && <div>Error: {error.message}</div>}
      {messageData && <div>Latest message data available</div>}
    </div>
  );
}

/**
 * Example: Course progress tracking with real-time updates
 */
export function CourseProgressExample({ enrollmentId }: { enrollmentId: string }) {
  const { data: progressData, loading, error } = useProgressSubscription(enrollmentId, {
    onSubscriptionData: (data) => {
      console.log('Progress updated:', data);
      // Update UI to reflect new progress
    },
  });

  const isConnected = useIsConnected();

  return (
    <div>
      <div>Real-time Updates: {isConnected ? 'Active' : 'Inactive'}</div>
      {loading && <div>Syncing progress...</div>}
      {error && <div>Sync error: {error.message}</div>}
      {progressData && <div>Progress data synchronized</div>}
    </div>
  );
}

/**
 * Example: Notification center with real-time notifications
 */
export function NotificationCenterExample({ userId }: { userId: string }) {
  const { data: notificationData, loading, error } = useNotificationSubscription(userId, {
    onSubscriptionData: (data) => {
      console.log('New notification:', data);
      // Show toast notification or update notification count
    },
  });

  return (
    <div>
      <h3>Notifications</h3>
      {loading && <div>Loading notifications...</div>}
      {error && <div>Error loading notifications: {error.message}</div>}
      {notificationData && <div>Notifications up to date</div>}
    </div>
  );
}

/**
 * Example: Course presence indicator showing online users
 */
export function CoursePresenceExample({ courseId }: { courseId: string }) {
  const { data: presenceData, loading, error } = usePresenceSubscription(courseId, {
    onSubscriptionData: (data) => {
      console.log('Presence updated:', data);
      // Update online user list
    },
  });

  return (
    <div>
      <h4>Who's Online</h4>
      {loading && <div>Loading presence...</div>}
      {error && <div>Error: {error.message}</div>}
      {presenceData && <div>Presence data available</div>}
    </div>
  );
}

/**
 * Example: Connection status indicator component
 */
export function ConnectionStatusIndicator() {
  const connectionStatus = useConnectionStatus();
  const isConnected = useIsConnected();

  const getStatusColor = () => {
    if (connectionStatus.connecting) return 'yellow';
    if (connectionStatus.connected) return 'green';
    if (connectionStatus.error) return 'red';
    return 'gray';
  };

  const getStatusText = () => {
    if (connectionStatus.connecting) return 'Connecting...';
    if (connectionStatus.connected) return 'Connected';
    if (connectionStatus.error) return `Error: ${connectionStatus.error.message}`;
    return 'Disconnected';
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '8px',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px',
    }}>
      <div 
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
        }}
      />
      <span style={{ fontSize: '12px' }}>
        {getStatusText()}
      </span>
      {connectionStatus.reconnectAttempts > 0 && (
        <span style={{ fontSize: '10px', color: '#666' }}>
          (Attempt {connectionStatus.reconnectAttempts})
        </span>
      )}
    </div>
  );
}

/**
 * Example: App-level subscription provider setup
 */
export function AppWithSubscriptions({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Connection status indicator */}
      <ConnectionStatusIndicator />
      
      {/* Main app content */}
      {children}
    </div>
  );
}

/**
 * Example: Custom hook for managing multiple subscriptions
 */
export function useRealtimeFeatures(userId: string, courseId?: string, enrollmentId?: string) {
  // Subscribe to messages
  const messageSubscription = useMessageSubscription(userId, {
    skip: !userId,
  });

  // Subscribe to notifications
  const notificationSubscription = useNotificationSubscription(userId, {
    skip: !userId,
  });

  // Subscribe to course presence if in a course
  const presenceSubscription = usePresenceSubscription(courseId, {
    skip: !courseId,
  });

  // Subscribe to progress if enrolled
  const progressSubscription = useProgressSubscription(enrollmentId, {
    skip: !enrollmentId,
  });

  const isConnected = useIsConnected();

  return {
    messages: messageSubscription,
    notifications: notificationSubscription,
    presence: presenceSubscription,
    progress: progressSubscription,
    isConnected,
    loading: messageSubscription.loading || notificationSubscription.loading,
    error: messageSubscription.error || notificationSubscription.error,
  };
}