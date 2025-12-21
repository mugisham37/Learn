/**
 * Notifications Module Hooks
 *
 * React hooks for notification management including:
 * - Notification queries with filtering and pagination
 * - Notification preference management
 * - Real-time notification delivery
 * - Multi-channel notification support
 * - Notification analytics and reporting
 *
 * Requirements: 2.7
 */

import { useCallback, useEffect, useState } from 'react';
import {
  useQuery,
  useMutation,
  useSubscription,
  ApolloCache,
  gql,
} from '@apollo/client/react';
import type { ID, DateTime, JSON } from '../types';

// ============================================================================
// Types and Enums
// ============================================================================

export type NotificationType =
  | 'NEW_MESSAGE'
  | 'ASSIGNMENT_DUE'
  | 'GRADE_POSTED'
  | 'COURSE_UPDATE'
  | 'ANNOUNCEMENT'
  | 'DISCUSSION_REPLY'
  | 'ENROLLMENT_CONFIRMED'
  | 'CERTIFICATE_ISSUED'
  | 'PAYMENT_RECEIVED'
  | 'REFUND_PROCESSED'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_PAYMENT_FAILED';

export type Priority = 'NORMAL' | 'HIGH' | 'URGENT';

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'IN_APP';

export interface Notification {
  id: ID;
  recipientId: ID;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  priority: Priority;
  isRead: boolean;
  readAt?: DateTime;
  metadata?: JSON;
  expiresAt?: DateTime;
  createdAt: DateTime;
}

export interface ChannelPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationPreferences {
  newMessage: ChannelPreferences;
  assignmentDue: ChannelPreferences;
  gradePosted: ChannelPreferences;
  courseUpdate: ChannelPreferences;
  announcement: ChannelPreferences;
  discussionReply: ChannelPreferences;
  enrollmentConfirmed: ChannelPreferences;
  certificateIssued: ChannelPreferences;
  paymentReceived: ChannelPreferences;
  refundProcessed: ChannelPreferences;
}

export interface NotificationFilter {
  notificationType?: NotificationType;
  priority?: Priority;
  isRead?: boolean;
  createdAfter?: DateTime;
  createdBefore?: DateTime;
}

export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface NotificationEdge {
  node: Notification;
  cursor: string;
}

export interface NotificationConnection {
  edges: NotificationEdge[];
  pageInfo: PageInfo;
  totalCount: number;
  unreadCount: number;
}

export interface ChannelPreferencesInput {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationPreferencesInput {
  newMessage?: ChannelPreferencesInput;
  assignmentDue?: ChannelPreferencesInput;
  gradePosted?: ChannelPreferencesInput;
  courseUpdate?: ChannelPreferencesInput;
  announcement?: ChannelPreferencesInput;
  discussionReply?: ChannelPreferencesInput;
  enrollmentConfirmed?: ChannelPreferencesInput;
  certificateIssued?: ChannelPreferencesInput;
  paymentReceived?: ChannelPreferencesInput;
  refundProcessed?: ChannelPreferencesInput;
}

export interface UpdateNotificationPreferencesInput {
  preferences: NotificationPreferencesInput;
}

export interface MarkNotificationReadInput {
  notificationId: ID;
}

export interface MarkAllNotificationsReadInput {
  notificationType?: NotificationType;
  olderThan?: DateTime;
}

// ============================================================================
// GraphQL Operations
// ============================================================================

const NOTIFICATION_FRAGMENT = gql`
  fragment NotificationFields on Notification {
    id
    recipientId
    notificationType
    title
    content
    actionUrl
    priority
    isRead
    readAt
    metadata
    expiresAt
    createdAt
  }
`;

const GET_USER_NOTIFICATIONS = gql`
  ${NOTIFICATION_FRAGMENT}
  query GetUserNotifications($filter: NotificationFilter, $pagination: PaginationInput) {
    getUserNotifications(filter: $filter, pagination: $pagination) {
      edges {
        node {
          ...NotificationFields
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
      unreadCount
    }
  }
`;

const GET_NOTIFICATION = gql`
  ${NOTIFICATION_FRAGMENT}
  query GetNotification($id: ID!) {
    getNotification(id: $id) {
      ...NotificationFields
    }
  }
`;

const GET_UNREAD_NOTIFICATION_COUNT = gql`
  query GetUnreadNotificationCount($notificationType: NotificationType) {
    getUnreadNotificationCount(notificationType: $notificationType)
  }
`;

const GET_NOTIFICATION_PREFERENCES = gql`
  query GetNotificationPreferences {
    getNotificationPreferences {
      newMessage {
        email
        push
        inApp
      }
      assignmentDue {
        email
        push
        inApp
      }
      gradePosted {
        email
        push
        inApp
      }
      courseUpdate {
        email
        push
        inApp
      }
      announcement {
        email
        push
        inApp
      }
      discussionReply {
        email
        push
        inApp
      }
      enrollmentConfirmed {
        email
        push
        inApp
      }
      certificateIssued {
        email
        push
        inApp
      }
      paymentReceived {
        email
        push
        inApp
      }
      refundProcessed {
        email
        push
        inApp
      }
    }
  }
`;

const MARK_NOTIFICATION_READ = gql`
  ${NOTIFICATION_FRAGMENT}
  mutation MarkNotificationRead($input: MarkNotificationReadInput!) {
    markNotificationRead(input: $input) {
      ...NotificationFields
    }
  }
`;

const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead($input: MarkAllNotificationsReadInput) {
    markAllNotificationsRead(input: $input)
  }
`;

const UPDATE_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {
      newMessage {
        email
        push
        inApp
      }
      assignmentDue {
        email
        push
        inApp
      }
      gradePosted {
        email
        push
        inApp
      }
      courseUpdate {
        email
        push
        inApp
      }
      announcement {
        email
        push
        inApp
      }
      discussionReply {
        email
        push
        inApp
      }
      enrollmentConfirmed {
        email
        push
        inApp
      }
      certificateIssued {
        email
        push
        inApp
      }
      paymentReceived {
        email
        push
        inApp
      }
      refundProcessed {
        email
        push
        inApp
      }
    }
  }
`;

const NOTIFICATION_RECEIVED_SUBSCRIPTION = gql`
  ${NOTIFICATION_FRAGMENT}
  subscription NotificationReceived($userId: ID!) {
    notificationReceived(userId: $userId) {
      ...NotificationFields
    }
  }
`;

const NOTIFICATION_READ_SUBSCRIPTION = gql`
  ${NOTIFICATION_FRAGMENT}
  subscription NotificationRead($userId: ID!) {
    notificationRead(userId: $userId) {
      ...NotificationFields
    }
  }
`;

const UNREAD_COUNT_CHANGED_SUBSCRIPTION = gql`
  subscription UnreadCountChanged($userId: ID!) {
    unreadCountChanged(userId: $userId)
  }
`;

// ============================================================================
// Response Types
// ============================================================================

interface GetUserNotificationsResponse {
  getUserNotifications: NotificationConnection;
}

interface GetNotificationResponse {
  getNotification: Notification | null;
}

interface GetUnreadNotificationCountResponse {
  getUnreadNotificationCount: number;
}

interface GetNotificationPreferencesResponse {
  getNotificationPreferences: NotificationPreferences;
}

interface MarkNotificationReadResponse {
  markNotificationRead: Notification;
}

interface MarkAllNotificationsReadResponse {
  markAllNotificationsRead: boolean;
}

interface UpdateNotificationPreferencesResponse {
  updateNotificationPreferences: NotificationPreferences;
}

interface NotificationReceivedSubscriptionData {
  notificationReceived: Notification;
}

interface NotificationReadSubscriptionData {
  notificationRead: Notification;
}

interface UnreadCountChangedSubscriptionData {
  unreadCountChanged: number;
}

// ============================================================================
// Hook Result Types
// ============================================================================

export interface QueryHookResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<void>;
  fetchMore?: () => Promise<void>;
}

export interface MutationResult<T, V = Record<string, unknown>> {
  mutate: (variables: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

export interface SubscriptionHookResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  connected: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching user notifications with filtering and pagination
 *
 * @param filter - Optional filter criteria for notifications
 * @param pagination - Optional pagination parameters
 * @returns Query result with notifications connection
 *
 * @example
 * ```tsx
 * function NotificationList() {
 *   const { data, loading, fetchMore } = useNotifications({
 *     filter: { isRead: false },
 *     pagination: { first: 20 }
 *   });
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       {data?.edges.map(({ node }) => (
 *         <NotificationItem key={node.id} notification={node} />
 *       ))}
 *       {data?.pageInfo.hasNextPage && (
 *         <button onClick={fetchMore}>Load More</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotifications(options?: {
  filter?: NotificationFilter;
  pagination?: PaginationInput;
}): QueryHookResult<NotificationConnection> & {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
  unreadCount: number;
} {
  const {
    data,
    loading,
    error,
    refetch,
    fetchMore: apolloFetchMore,
  } = useQuery<GetUserNotificationsResponse>(GET_USER_NOTIFICATIONS, {
    variables: {
      filter: options?.filter,
      pagination: options?.pagination,
    },
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
  });

  const fetchMore = useCallback(async () => {
    if (!data?.getUserNotifications.pageInfo.hasNextPage) return;

    await apolloFetchMore({
      variables: {
        filter: options?.filter,
        pagination: {
          ...options?.pagination,
          after: data.getUserNotifications.pageInfo.endCursor,
        },
      },
      updateQuery: (prev: any, { fetchMoreResult }: { fetchMoreResult: any }) => {
        if (!fetchMoreResult) return prev;

        return {
          getUserNotifications: {
            ...fetchMoreResult.getUserNotifications,
            edges: [
              ...prev.getUserNotifications.edges,
              ...fetchMoreResult.getUserNotifications.edges,
            ],
          },
        };
      },
    });
  }, [data, options?.filter, options?.pagination, apolloFetchMore]);

  return {
    data: data?.getUserNotifications,
    loading,
    error: error as Error | undefined,
    refetch: async () => {
      await refetch();
    },
    fetchMore,
    hasNextPage: data?.getUserNotifications.pageInfo.hasNextPage ?? false,
    hasPreviousPage: data?.getUserNotifications.pageInfo.hasPreviousPage ?? false,
    totalCount: data?.getUserNotifications.totalCount ?? 0,
    unreadCount: data?.getUserNotifications.unreadCount ?? 0,
  };
}

/**
 * Hook for fetching a single notification by ID
 *
 * @param id - Notification ID
 * @returns Query result with notification data
 *
 * @example
 * ```tsx
 * function NotificationDetail({ notificationId }: { notificationId: string }) {
 *   const { data: notification, loading } = useNotification(notificationId);
 *
 *   if (loading) return <Spinner />;
 *   if (!notification) return <NotFound />;
 *
 *   return <NotificationCard notification={notification} />;
 * }
 * ```
 */
export function useNotification(id: ID): QueryHookResult<Notification | null> {
  const { data, loading, error, refetch } = useQuery<GetNotificationResponse>(GET_NOTIFICATION, {
    variables: { id },
    errorPolicy: 'all',
    skip: !id,
  });

  return {
    data: data?.getNotification ?? null,
    loading,
    error: error as Error | undefined,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching unread notification count
 *
 * @param notificationType - Optional filter by notification type
 * @returns Query result with unread count
 *
 * @example
 * ```tsx
 * function NotificationBadge() {
 *   const { data: unreadCount } = useUnreadNotificationCount();
 *
 *   if (!unreadCount) return null;
 *
 *   return <Badge count={unreadCount} />;
 * }
 * ```
 */
export function useUnreadNotificationCount(
  notificationType?: NotificationType
): QueryHookResult<number> {
  const { data, loading, error, refetch } = useQuery<GetUnreadNotificationCountResponse>(
    GET_UNREAD_NOTIFICATION_COUNT,
    {
      variables: { notificationType },
      errorPolicy: 'all',
      pollInterval: 30000, // Poll every 30 seconds
    }
  );

  return {
    data: data?.getUnreadNotificationCount ?? 0,
    loading,
    error: error as Error | undefined,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for fetching notification preferences
 *
 * @returns Query result with notification preferences
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const { data: preferences, loading } = useGetNotificationPreferences();
 *
 *   if (loading) return <Spinner />;
 *
 *   return <PreferencesForm preferences={preferences} />;
 * }
 * ```
 */
export function useGetNotificationPreferences(): QueryHookResult<
  NotificationPreferences | undefined
> {
  const { data, loading, error, refetch } = useQuery<GetNotificationPreferencesResponse>(
    GET_NOTIFICATION_PREFERENCES,
    {
      errorPolicy: 'all',
    }
  );

  return {
    data: data?.getNotificationPreferences,
    loading,
    error: error as Error | undefined,
    refetch: async () => {
      await refetch();
    },
  };
}

/**
 * Hook for marking a notification as read
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function NotificationItem({ notification }: { notification: Notification }) {
 *   const { mutate: markAsRead, loading } = useMarkNotificationRead();
 *
 *   const handleClick = async () => {
 *     await markAsRead({ input: { notificationId: notification.id } });
 *   };
 *
 *   return (
 *     <div onClick={handleClick}>
 *       {notification.title}
 *       {!notification.isRead && <Badge>New</Badge>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMarkNotificationRead(): MutationResult<
  Notification,
  { input: MarkNotificationReadInput }
> {
  const [markReadMutation, { loading, error, reset }] = useMutation<MarkNotificationReadResponse>(
    MARK_NOTIFICATION_READ,
    {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }: { data: any }) => {
        if (data?.markNotificationRead) {
          // Update the notification in cache
          cache.modify({
            id: cache.identify(data.markNotificationRead),
            fields: {
              isRead: () => true,
              readAt: () => data.markNotificationRead.readAt,
            },
          });

          // Decrement unread count
          cache.modify({
            fields: {
              getUserNotifications(existing: any) {
                if (!existing) return existing;
                return {
                  ...existing,
                  unreadCount: Math.max(0, (existing.unreadCount || 0) - 1),
                };
              },
            },
          });
        }
      },
    }
  );

  const mutate = async (variables: { input: MarkNotificationReadInput }): Promise<Notification> => {
    const result = await markReadMutation({ variables });
    if (!result.data?.markNotificationRead) {
      throw new Error('Failed to mark notification as read');
    }
    return result.data.markNotificationRead;
  };

  return {
    mutate,
    loading,
    error: error as Error | undefined,
    reset,
  };
}

/**
 * Hook for marking all notifications as read
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function NotificationHeader() {
 *   const { mutate: markAllAsRead, loading } = useMarkAllNotificationsRead();
 *
 *   const handleMarkAllRead = async () => {
 *     await markAllAsRead({ input: {} });
 *   };
 *
 *   return (
 *     <button onClick={handleMarkAllRead} disabled={loading}>
 *       Mark All as Read
 *     </button>
 *   );
 * }
 * ```
 */
export function useMarkAllNotificationsRead(): MutationResult<
  boolean,
  { input?: MarkAllNotificationsReadInput }
> {
  const [markAllReadMutation, { loading, error, reset }] =
    useMutation<MarkAllNotificationsReadResponse>(MARK_ALL_NOTIFICATIONS_READ, {
      errorPolicy: 'all',
      refetchQueries: [{ query: GET_USER_NOTIFICATIONS }, { query: GET_UNREAD_NOTIFICATION_COUNT }],
    });

  const mutate = async (variables: { input?: MarkAllNotificationsReadInput }): Promise<boolean> => {
    const result = await markAllReadMutation({ variables });
    if (!result.data?.markAllNotificationsRead) {
      throw new Error('Failed to mark all notifications as read');
    }
    return result.data.markAllNotificationsRead;
  };

  return {
    mutate,
    loading,
    error: error as Error | undefined,
    reset,
  };
}

/**
 * Hook for updating notification preferences
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function PreferencesForm() {
 *   const { mutate: updatePreferences, loading } = useUpdateNotificationPreferences();
 *
 *   const handleSubmit = async (preferences: NotificationPreferencesInput) => {
 *     await updatePreferences({ input: { preferences } });
 *   };
 *
 *   return <Form onSubmit={handleSubmit} />;
 * }
 * ```
 */
export function useUpdateNotificationPreferences(): MutationResult<
  NotificationPreferences,
  { input: UpdateNotificationPreferencesInput }
> {
  const [updatePreferencesMutation, { loading, error, reset }] =
    useMutation<UpdateNotificationPreferencesResponse>(UPDATE_NOTIFICATION_PREFERENCES, {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }: { data: any }) => {
        if (data?.updateNotificationPreferences) {
          // Update preferences in cache
          cache.writeQuery({
            query: GET_NOTIFICATION_PREFERENCES,
            data: {
              getNotificationPreferences: data.updateNotificationPreferences,
            },
          });
        }
      },
    });

  const mutate = async (variables: {
    input: UpdateNotificationPreferencesInput;
  }): Promise<NotificationPreferences> => {
    const result = await updatePreferencesMutation({ variables });
    if (!result.data?.updateNotificationPreferences) {
      throw new Error('Failed to update notification preferences');
    }
    return result.data.updateNotificationPreferences;
  };

  return {
    mutate,
    loading,
    error: error as Error | undefined,
    reset,
  };
}

/**
 * Hook for real-time notification delivery
 *
 * @param userId - User ID to receive notifications for
 * @param onNotification - Callback function when notification is received
 * @returns Subscription result with connection status
 *
 * @example
 * ```tsx
 * function NotificationListener({ userId }: { userId: string }) {
 *   const { connected } = useNotificationReceived(userId, (notification) => {
 *     toast.info(notification.title);
 *   });
 *
 *   return <StatusIndicator connected={connected} />;
 * }
 * ```
 */
export function useNotificationReceived(
  userId: ID,
  onNotification?: (notification: Notification) => void
): SubscriptionHookResult<Notification> {
  const { data, loading, error } = useSubscription<NotificationReceivedSubscriptionData>(
    NOTIFICATION_RECEIVED_SUBSCRIPTION,
    {
      variables: { userId },
      skip: !userId,
      onData: ({ data: subscriptionData }: { data: any }) => {
        if (subscriptionData.data?.notificationReceived && onNotification) {
          onNotification(subscriptionData.data.notificationReceived);
        }
      },
    }
  );

  return {
    data: data?.notificationReceived,
    loading,
    error: error as Error | undefined,
    connected: !loading && !error,
  };
}

/**
 * Hook for real-time notification read status updates
 *
 * @param userId - User ID to receive updates for
 * @param onNotificationRead - Callback function when notification is marked as read
 * @returns Subscription result with connection status
 *
 * @example
 * ```tsx
 * function NotificationSync({ userId }: { userId: string }) {
 *   useNotificationRead(userId, (notification) => {
 *     console.log('Notification marked as read:', notification.id);
 *   });
 *
 *   return null;
 * }
 * ```
 */
export function useNotificationRead(
  userId: ID,
  onNotificationRead?: (notification: Notification) => void
): SubscriptionHookResult<Notification> {
  const { data, loading, error } = useSubscription<NotificationReadSubscriptionData>(
    NOTIFICATION_READ_SUBSCRIPTION,
    {
      variables: { userId },
      skip: !userId,
      onData: ({ data: subscriptionData }: { data: any }) => {
        if (subscriptionData.data?.notificationRead && onNotificationRead) {
          onNotificationRead(subscriptionData.data.notificationRead);
        }
      },
    }
  );

  return {
    data: data?.notificationRead,
    loading,
    error: error as Error | undefined,
    connected: !loading && !error,
  };
}

/**
 * Hook for real-time unread count updates
 *
 * @param userId - User ID to receive updates for
 * @param onCountChanged - Callback function when unread count changes
 * @returns Subscription result with connection status
 *
 * @example
 * ```tsx
 * function UnreadBadge({ userId }: { userId: string }) {
 *   const [count, setCount] = useState(0);
 *
 *   useUnreadCountChanged(userId, (newCount) => {
 *     setCount(newCount);
 *   });
 *
 *   return <Badge count={count} />;
 * }
 * ```
 */
export function useUnreadCountChanged(
  userId: ID,
  onCountChanged?: (count: number) => void
): SubscriptionHookResult<number> {
  const { data, loading, error } = useSubscription<UnreadCountChangedSubscriptionData>(
    UNREAD_COUNT_CHANGED_SUBSCRIPTION,
    {
      variables: { userId },
      skip: !userId,
      onData: ({ data: subscriptionData }: { data: any }) => {
        if (typeof subscriptionData.data?.unreadCountChanged === 'number' && onCountChanged) {
          onCountChanged(subscriptionData.data.unreadCountChanged);
        }
      },
    }
  );

  return {
    data: data?.unreadCountChanged,
    loading,
    error: error as Error | undefined,
    connected: !loading && !error,
  };
}

/**
 * Comprehensive hook that combines all notification functionality
 *
 * @param userId - User ID for subscriptions
 * @param options - Optional filter and pagination options
 * @returns Combined notification management interface
 *
 * @example
 * ```tsx
 * function NotificationCenter({ userId }: { userId: string }) {
 *   const {
 *     notifications,
 *     unreadCount,
 *     loading,
 *     markAsRead,
 *     markAllAsRead,
 *     fetchMore,
 *     hasNextPage,
 *   } = useNotificationManagement(userId, {
 *     filter: { isRead: false },
 *     pagination: { first: 20 },
 *   });
 *
 *   return (
 *     <div>
 *       <Header unreadCount={unreadCount} onMarkAllRead={markAllAsRead} />
 *       <NotificationList
 *         notifications={notifications}
 *         onMarkAsRead={markAsRead}
 *         loading={loading}
 *       />
 *       {hasNextPage && <button onClick={fetchMore}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotificationManagement(
  userId: ID,
  options?: {
    filter?: NotificationFilter;
    pagination?: PaginationInput;
  }
) {
  const notificationsQuery = useNotifications(options);
  const { mutate: markAsRead, loading: markingAsRead } = useMarkNotificationRead();
  const { mutate: markAllAsRead, loading: markingAllAsRead } = useMarkAllNotificationsRead();

  // Set up real-time subscriptions
  useNotificationReceived(userId, notification => {
    // Notification will be automatically added to cache by subscription
    console.log('New notification received:', notification.title);
  });

  useUnreadCountChanged(userId, count => {
    console.log('Unread count changed:', count);
  });

  return {
    notifications: notificationsQuery.data?.edges.map(edge => edge.node) ?? [],
    unreadCount: notificationsQuery.unreadCount,
    totalCount: notificationsQuery.totalCount,
    loading: notificationsQuery.loading,
    error: notificationsQuery.error,
    hasNextPage: notificationsQuery.hasNextPage,
    hasPreviousPage: notificationsQuery.hasPreviousPage,
    fetchMore: notificationsQuery.fetchMore,
    refetch: notificationsQuery.refetch,
    markAsRead: async (notificationId: ID) => {
      await markAsRead({ input: { notificationId } });
    },
    markAllAsRead: async (input?: MarkAllNotificationsReadInput) => {
      await markAllAsRead({ input: input || {} });
    },
    markingAsRead,
    markingAllAsRead,
  };
}

// ============================================================================
// Analytics and Reporting Hooks
// ============================================================================

/**
 * Hook for notification analytics and reporting
 *
 * @param options - Analytics options and filters
 * @returns Analytics data and reporting functions
 *
 * @example
 * ```tsx
 * function NotificationAnalytics() {
 *   const {
 *     deliveryStats,
 *     engagementMetrics,
 *     channelPerformance,
 *     generateReport,
 *   } = useNotificationAnalytics({
 *     dateRange: { start: '2024-01-01', end: '2024-12-31' },
 *     notificationTypes: ['ASSIGNMENT_DUE', 'GRADE_POSTED'],
 *   });
 *
 *   return (
 *     <div>
 *       <DeliveryChart data={deliveryStats} />
 *       <EngagementMetrics data={engagementMetrics} />
 *       <ChannelComparison data={channelPerformance} />
 *       <button onClick={() => generateReport('pdf')}>
 *         Export Report
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useNotificationAnalytics(options?: {
  dateRange?: { start: DateTime; end: DateTime };
  notificationTypes?: NotificationType[];
  channels?: NotificationChannel[];
  userId?: ID;
}) {
  const [analyticsData, setAnalyticsData] = useState<{
    deliveryStats: Array<{
      date: DateTime;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }>;
    engagementMetrics: {
      totalSent: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      averageTimeToRead: number;
    };
    channelPerformance: Array<{
      channel: NotificationChannel;
      sent: number;
      delivered: number;
      engagementRate: number;
    }>;
    typeBreakdown: Array<{
      type: NotificationType;
      count: number;
      engagementRate: number;
    }>;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      // In a real implementation, this would call a GraphQL query for analytics
      // For now, we'll simulate the data structure
      const mockData = {
        deliveryStats: [
          {
            date: '2024-01-01',
            sent: 100,
            delivered: 95,
            opened: 75,
            clicked: 25,
          },
          // ... more data points
        ],
        engagementMetrics: {
          totalSent: 1000,
          deliveryRate: 0.95,
          openRate: 0.75,
          clickRate: 0.25,
          averageTimeToRead: 300, // seconds
        },
        channelPerformance: [
          {
            channel: 'EMAIL' as NotificationChannel,
            sent: 500,
            delivered: 475,
            engagementRate: 0.6,
          },
          {
            channel: 'PUSH' as NotificationChannel,
            sent: 300,
            delivered: 285,
            engagementRate: 0.8,
          },
          {
            channel: 'IN_APP' as NotificationChannel,
            sent: 200,
            delivered: 200,
            engagementRate: 0.9,
          },
        ],
        typeBreakdown: [
          {
            type: 'ASSIGNMENT_DUE' as NotificationType,
            count: 300,
            engagementRate: 0.85,
          },
          {
            type: 'GRADE_POSTED' as NotificationType,
            count: 250,
            engagementRate: 0.9,
          },
          // ... more types
        ],
      };

      setAnalyticsData(mockData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const generateReport = useCallback(
    async (format: 'pdf' | 'csv' | 'excel') => {
      if (!analyticsData) return;

      // In a real implementation, this would call a backend service to generate reports
      console.log(`Generating ${format} report with data:`, analyticsData);

      // Simulate report generation
      const reportData = {
        format,
        data: analyticsData,
        generatedAt: new Date().toISOString(),
        filters: options,
      };

      // In a real app, this would trigger a download
      console.log('Report generated:', reportData);
    },
    [analyticsData, options]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    deliveryStats: analyticsData?.deliveryStats ?? [],
    engagementMetrics: analyticsData?.engagementMetrics,
    channelPerformance: analyticsData?.channelPerformance ?? [],
    typeBreakdown: analyticsData?.typeBreakdown ?? [],
    loading,
    error,
    refetch: fetchAnalytics,
    generateReport,
  };
}

/**
 * Hook for notification scheduling and batching
 *
 * @returns Scheduling and batching functions
 *
 * @example
 * ```tsx
 * function NotificationScheduler() {
 *   const {
 *     scheduleNotification,
 *     scheduleBatch,
 *     getScheduledNotifications,
 *     cancelScheduled,
 *   } = useNotificationScheduling();
 *
 *   const handleSchedule = async () => {
 *     await scheduleNotification({
 *       type: 'ASSIGNMENT_DUE',
 *       recipients: ['user1', 'user2'],
 *       scheduledFor: '2024-12-25T09:00:00Z',
 *       template: 'assignment-reminder',
 *       data: { assignmentId: 'assignment123' },
 *     });
 *   };
 *
 *   return <ScheduleForm onSubmit={handleSchedule} />;
 * }
 * ```
 */
export function useNotificationScheduling() {
  const [scheduledNotifications, setScheduledNotifications] = useState<
    Array<{
      id: ID;
      type: NotificationType;
      recipients: ID[];
      scheduledFor: DateTime;
      status: 'pending' | 'sent' | 'cancelled';
      template: string;
      data: Record<string, unknown>;
    }>
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const scheduleNotification = useCallback(
    async (notification: {
      type: NotificationType;
      recipients: ID[];
      scheduledFor: DateTime;
      template: string;
      data: Record<string, unknown>;
      priority?: Priority;
    }) => {
      setLoading(true);
      setError(undefined);

      try {
        // In a real implementation, this would call a GraphQL mutation
        const scheduledNotification = {
          id: `scheduled_${Date.now()}`,
          ...notification,
          status: 'pending' as const,
        };

        setScheduledNotifications(prev => [...prev, scheduledNotification]);

        console.log('Notification scheduled:', scheduledNotification);
        return scheduledNotification;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const scheduleBatch = useCallback(
    async (
      notifications: Array<{
        type: NotificationType;
        recipients: ID[];
        scheduledFor: DateTime;
        template: string;
        data: Record<string, unknown>;
        priority?: Priority;
      }>
    ) => {
      setLoading(true);
      setError(undefined);

      try {
        const scheduledBatch = notifications.map(notification => ({
          id: `batch_${Date.now()}_${Math.random()}`,
          ...notification,
          status: 'pending' as const,
        }));

        setScheduledNotifications(prev => [...prev, ...scheduledBatch]);

        console.log('Batch scheduled:', scheduledBatch);
        return scheduledBatch;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getScheduledNotifications = useCallback(
    async (filter?: {
      status?: 'pending' | 'sent' | 'cancelled';
      type?: NotificationType;
      scheduledAfter?: DateTime;
      scheduledBefore?: DateTime;
    }) => {
      let filtered = scheduledNotifications;

      if (filter) {
        if (filter.status) {
          filtered = filtered.filter(n => n.status === filter.status);
        }
        if (filter.type) {
          filtered = filtered.filter(n => n.type === filter.type);
        }
        if (filter.scheduledAfter) {
          filtered = filtered.filter(n => n.scheduledFor >= filter.scheduledAfter!);
        }
        if (filter.scheduledBefore) {
          filtered = filtered.filter(n => n.scheduledFor <= filter.scheduledBefore!);
        }
      }

      return filtered;
    },
    [scheduledNotifications]
  );

  const cancelScheduled = useCallback(async (notificationId: ID) => {
    setScheduledNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, status: 'cancelled' as const } : n))
    );

    console.log('Notification cancelled:', notificationId);
  }, []);

  return {
    scheduleNotification,
    scheduleBatch,
    getScheduledNotifications,
    cancelScheduled,
    scheduledNotifications,
    loading,
    error,
  };
}

/**
 * Hook for multi-channel notification support
 *
 * @returns Multi-channel notification functions
 *
 * @example
 * ```tsx
 * function MultiChannelNotifier() {
 *   const {
 *     sendMultiChannel,
 *     getChannelStatus,
 *     configureChannels,
 *   } = useMultiChannelNotifications();
 *
 *   const handleSend = async () => {
 *     await sendMultiChannel({
 *       type: 'COURSE_UPDATE',
 *       recipients: ['user1', 'user2'],
 *       channels: ['EMAIL', 'PUSH'],
 *       content: {
 *         title: 'Course Updated',
 *         message: 'Your course has been updated with new content.',
 *       },
 *       fallbackStrategy: 'cascade',
 *     });
 *   };
 *
 *   return <MultiChannelForm onSubmit={handleSend} />;
 * }
 * ```
 */
export function useMultiChannelNotifications() {
  const [channelStatus, setChannelStatus] = useState<
    Record<
      NotificationChannel,
      {
        available: boolean;
        lastError?: string;
        deliveryRate: number;
      }
    >
  >({
    EMAIL: { available: true, deliveryRate: 0.95 },
    PUSH: { available: true, deliveryRate: 0.85 },
    IN_APP: { available: true, deliveryRate: 1.0 },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const sendMultiChannel = useCallback(
    async (notification: {
      type: NotificationType;
      recipients: ID[];
      channels: NotificationChannel[];
      content: {
        title: string;
        message: string;
        actionUrl?: string;
      };
      fallbackStrategy?: 'cascade' | 'parallel' | 'none';
      priority?: Priority;
    }) => {
      setLoading(true);
      setError(undefined);

      try {
        // In a real implementation, this would call backend services for each channel
        const results = await Promise.allSettled(
          notification.channels.map(async channel => {
            // Simulate channel-specific delivery
            const channelInfo = channelStatus[channel];
            if (!channelInfo.available) {
              throw new Error(`Channel ${channel} is not available`);
            }

            // Simulate delivery success/failure based on delivery rate
            const success = Math.random() < channelInfo.deliveryRate;
            if (!success) {
              throw new Error(`Delivery failed for channel ${channel}`);
            }

            return {
              channel,
              status: 'delivered',
              deliveredAt: new Date().toISOString(),
            };
          })
        );

        const deliveryResults = results.map((result, index) => ({
          channel: notification.channels[index]!,
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason.message : undefined,
          data: result.status === 'fulfilled' ? result.value : undefined,
        }));

        console.log('Multi-channel delivery results:', deliveryResults);
        return deliveryResults;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [channelStatus]
  );

  const getChannelStatus = useCallback(async () => {
    // In a real implementation, this would check backend service status
    return channelStatus;
  }, [channelStatus]);

  const configureChannels = useCallback(
    async (
      config: Partial<
        Record<
          NotificationChannel,
          {
            enabled: boolean;
            priority: number;
            retryAttempts: number;
            timeout: number;
          }
        >
      >
    ) => {
      // In a real implementation, this would update backend configuration
      console.log('Channel configuration updated:', config);
    },
    []
  );

  return {
    sendMultiChannel,
    getChannelStatus,
    configureChannels,
    channelStatus,
    loading,
    error,
  };
}
