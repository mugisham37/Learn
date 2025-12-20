/**
 * Real-time Provider
 * 
 * Comprehensive provider that manages both GraphQL subscriptions and Socket.io
 * connections for real-time features. Provides unified real-time state management
 * with automatic connection handling, authentication, and cache integration.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/authHooks';
import { SubscriptionProvider } from '../subscriptions/SubscriptionProvider';
import { useRealtimeManager } from './realtimeManager';

/**
 * Real-time context value
 */
interface RealtimeContextValue {
  // Connection status
  connectionStatus: {
    graphql: { connected: boolean };
    socket: { 
      connected: boolean; 
      connecting: boolean; 
      error: Error | null; 
      reconnectAttempts: number; 
    };
    overall: { connected: boolean; hasErrors: boolean };
  };
  
  // Room management
  joinCourse: (courseId: string) => void;
  leaveCourse: (courseId: string) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  
  // Presence and activity
  updatePresence: (status: 'online' | 'away' | 'busy' | 'offline') => void;
  sendTypingIndicator: (conversationId: string, isTyping: boolean) => void;
  
  // Event subscription
  subscribeToEvent: (eventName: string, handler: (data: unknown) => void) => (() => void);
}

/**
 * Real-time context
 */
const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Real-time provider props
 */
interface RealtimeProviderProps {
  children: React.ReactNode;
  enableAutoPresence?: boolean;
  presenceUpdateInterval?: number;
}

/**
 * Real-time provider component
 */
export function RealtimeProvider({ 
  children, 
  enableAutoPresence = true,
  presenceUpdateInterval = 30000 // 30 seconds
}: RealtimeProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize real-time manager after authentication
  useEffect(() => {
    if (isAuthenticated && user && !isInitialized) {
      setIsInitialized(true);
    } else if (!isAuthenticated && isInitialized) {
      setIsInitialized(false);
    }
  }, [isAuthenticated, user, isInitialized]);

  return (
    <SubscriptionProvider>
      <RealtimeProviderInner
        enableAutoPresence={enableAutoPresence}
        presenceUpdateInterval={presenceUpdateInterval}
        isInitialized={isInitialized}
      >
        {children}
      </RealtimeProviderInner>
    </SubscriptionProvider>
  );
}

/**
 * Inner real-time provider that uses the real-time manager
 */
function RealtimeProviderInner({
  children,
  enableAutoPresence,
  presenceUpdateInterval,
  isInitialized,
}: {
  children: React.ReactNode;
  enableAutoPresence: boolean;
  presenceUpdateInterval: number;
  isInitialized: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const realtimeManager = useRealtimeManager();
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Track user activity for presence updates
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Setup activity tracking
  useEffect(() => {
    if (!enableAutoPresence || !isInitialized) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [enableAutoPresence, isInitialized, updateActivity]);

  // Automatic presence updates based on activity
  useEffect(() => {
    if (!enableAutoPresence || !isAuthenticated || !isInitialized) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      let status: 'online' | 'away' | 'busy' | 'offline' = 'online';
      
      if (timeSinceActivity > 300000) { // 5 minutes
        status = 'away';
      } else if (timeSinceActivity > 1800000) { // 30 minutes
        status = 'offline';
      }
      
      realtimeManager.updatePresence(status);
    }, presenceUpdateInterval);

    return () => clearInterval(interval);
  }, [
    enableAutoPresence, 
    isAuthenticated, 
    isInitialized, 
    lastActivity, 
    presenceUpdateInterval, 
    realtimeManager
  ]);

  // Handle page visibility changes for presence
  useEffect(() => {
    if (!enableAutoPresence || !isAuthenticated || !isInitialized) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        realtimeManager.updatePresence('away');
      } else {
        realtimeManager.updatePresence('online');
        setLastActivity(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableAutoPresence, isAuthenticated, isInitialized, realtimeManager]);

  // Handle page unload for presence cleanup
  useEffect(() => {
    if (!enableAutoPresence || !isAuthenticated || !isInitialized) return;

    const handleBeforeUnload = () => {
      realtimeManager.updatePresence('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enableAutoPresence, isAuthenticated, isInitialized, realtimeManager]);

  // Context value
  const contextValue: RealtimeContextValue = {
    connectionStatus: realtimeManager.getConnectionStatus(),
    joinCourse: realtimeManager.joinCourse,
    leaveCourse: realtimeManager.leaveCourse,
    joinConversation: realtimeManager.joinConversation,
    leaveConversation: realtimeManager.leaveConversation,
    updatePresence: realtimeManager.updatePresence,
    sendTypingIndicator: realtimeManager.sendTypingIndicator,
    subscribeToEvent: realtimeManager.subscribeToEvent,
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Hook to access real-time context
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  
  return context;
}

/**
 * Hook to get real-time connection status
 */
export function useRealtimeStatus() {
  const { connectionStatus } = useRealtime();
  return connectionStatus;
}

/**
 * Hook to manage course real-time features
 */
export function useCourseRealtime(courseId: string | null) {
  const { joinCourse, leaveCourse } = useRealtime();
  
  useEffect(() => {
    if (courseId) {
      joinCourse(courseId);
      return () => leaveCourse(courseId);
    }
  }, [courseId, joinCourse, leaveCourse]);
}

/**
 * Hook to manage conversation real-time features
 */
export function useConversationRealtime(conversationId: string | null) {
  const { joinConversation, leaveConversation, sendTypingIndicator } = useRealtime();
  
  useEffect(() => {
    if (conversationId) {
      joinConversation(conversationId);
      return () => leaveConversation(conversationId);
    }
  }, [conversationId, joinConversation, leaveConversation]);
  
  const startTyping = useCallback(() => {
    if (conversationId) {
      sendTypingIndicator(conversationId, true);
    }
  }, [conversationId, sendTypingIndicator]);
  
  const stopTyping = useCallback(() => {
    if (conversationId) {
      sendTypingIndicator(conversationId, false);
    }
  }, [conversationId, sendTypingIndicator]);
  
  return { startTyping, stopTyping };
}

/**
 * Hook to manage user presence
 */
export function usePresenceManager() {
  const { updatePresence } = useRealtime();
  
  const setOnline = useCallback(() => updatePresence('online'), [updatePresence]);
  const setAway = useCallback(() => updatePresence('away'), [updatePresence]);
  const setBusy = useCallback(() => updatePresence('busy'), [updatePresence]);
  const setOffline = useCallback(() => updatePresence('offline'), [updatePresence]);
  
  return {
    setOnline,
    setAway,
    setBusy,
    setOffline,
    updatePresence,
  };
}

/**
 * Export real-time provider and hooks
 */
export default RealtimeProvider;