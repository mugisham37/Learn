/**
 * GraphQL Resolvers for Notifications Module
 * 
 * Implements GraphQL resolvers for notification queries, mutations, and subscriptions.
 * Handles notification filtering, marking as read, preference management, and real-time updates.
 * 
 * Requirements: 21.2, 21.3, 21.4
 */

import { 
  GraphQLError,
  GraphQLResolveInfo,
} from 'graphql';
import { 
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '../../../../shared/errors/index.js';
import { logger } from '../../../../shared/utils/logger.js';
import { INotificationService } from '../../application/services/INotificationService.js';
import { INotificationPreferenceService } from '../../application/services/INotificationPreferenceService.js';
import { INotificationRepository } from '../../infrastructure/repositories/INotificationRepository.js';
import { IRealtimeService } from '../../../../shared/services/IRealtimeService.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';
import { 
  Notification,
  NotificationType,
  Priority,
} from '../../../../infrastructure/database/schema/notifications.schema.js';
import { NotificationPreferences } from '../../../users/domain/value-objects/UserProfile.js';

/**
 * GraphQL context interface
 */
interface GraphQLContext {
  user?: {
    id: string;
    role: string;
    email: string;
  };
  requestId: string;
  dataSources?: {
    notificationService: INotificationService;
    notificationPreferenceService: INotificationPreferenceService;
    notificationRepository: INotificationRepository;
    realtimeService?: IRealtimeService;
    userRepository: IUserRepository;
  };
}

/**
 * Input types for GraphQL operations
 */
interface NotificationFilter {
  notificationType?: NotificationType;
  priority?: Priority;
  isRead?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

interface MarkNotificationReadInput {
  notificationId: string;
}

interface MarkAllNotificationsReadInput {
  notificationType?: NotificationType;
  olderThan?: string;
}

interface UpdateNotificationPreferencesInput {
  preferences: NotificationPreferences;
}

/**
 * Connection types for pagination
 */
interface NotificationConnection {
  edges: NotificationEdge[];
  pageInfo: PageInfo;
  totalCount: number;
  unreadCount: number;
}

interface NotificationEdge {
  node: Notification;
  cursor: string;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

/**
 * Utility function to require authentication
 */
function requireAuth(context: GraphQLContext): { id: string; role: string; email: string } {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
  return context.user;
}

/**
 * Utility function to get data sources
 */
function getDataSources(context: GraphQLContext) {
  if (!context.dataSources) {
    throw new GraphQLError('Data sources not available');
  }
  return context.dataSources;
}

/**
 * Utility function to convert cursor-based pagination to offset-based
 */
function parsePagination(pagination?: PaginationInput): {
  limit: number;
  offset: number;
} {
  const defaultLimit = 20;
  const maxLimit = 100;

  if (!pagination) {
    return { limit: defaultLimit, offset: 0 };
  }

  let limit = defaultLimit;
  let offset = 0;

  if (pagination.first) {
    limit = Math.min(pagination.first, maxLimit);
    if (pagination.after) {
      // Decode cursor to get offset
      try {
        const decodedCursor = Buffer.from(pagination.after, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);
        offset = cursorData.offset || 0;
      } catch (error) {
        logger.warn('Invalid cursor provided', { cursor: pagination.after });
        offset = 0;
      }
    }
  } else if (pagination.last) {
    limit = Math.min(pagination.last, maxLimit);
    if (pagination.before) {
      // For backward pagination, we need to calculate offset differently
      try {
        const decodedCursor = Buffer.from(pagination.before, 'base64').toString('utf-8');
        const cursorData = JSON.parse(decodedCursor);
        offset = Math.max(0, (cursorData.offset || 0) - limit);
      } catch (error) {
        logger.warn('Invalid cursor provided', { cursor: pagination.before });
        offset = 0;
      }
    }
  }

  return { limit, offset };
}

/**
 * Utility function to create cursor from offset
 */
function createCursor(offset: number): string {
  const cursorData = { offset };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

/**
 * Utility function to convert repository result to GraphQL connection
 */
function createConnection(
  items: Notification[],
  total: number,
  limit: number,
  offset: number,
  unreadCount: number
): NotificationConnection {
  const edges: NotificationEdge[] = items.map((item, index) => ({
    node: item,
    cursor: createCursor(offset + index),
  }));

  const hasNextPage = offset + limit < total;
  const hasPreviousPage = offset > 0;

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length > 0 ? edges[0]!.cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1]!.cursor : undefined,
    },
    totalCount: total,
    unreadCount,
  };
}

/**
 * GraphQL resolvers for notifications module
 */
export const notificationResolvers = {
  Query: {
    /**
     * Gets user notifications with filtering and pagination
     * 
     * Requirements: 21.2
     */
    getUserNotifications: async (
      _parent: unknown,
      args: {
        filter?: NotificationFilter;
        pagination?: PaginationInput;
      },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<NotificationConnection> => {
      try {
        const user = requireAuth(context);
        const { notificationRepository } = getDataSources(context);

        logger.info('Getting user notifications', {
          userId: user.id,
          filter: args.filter,
          pagination: args.pagination,
          requestId: context.requestId,
        });

        // Parse pagination
        const { limit, offset } = parsePagination(args.pagination);

        // Build filters
        const filters: any = {};
        if (args.filter?.notificationType) {
          filters.notificationType = args.filter.notificationType;
        }
        if (args.filter?.priority) {
          filters.priority = args.filter.priority;
        }
        if (typeof args.filter?.isRead === 'boolean') {
          filters.isRead = args.filter.isRead;
        }
        if (args.filter?.createdAfter) {
          filters.createdAfter = new Date(args.filter.createdAfter);
        }
        if (args.filter?.createdBefore) {
          filters.createdBefore = new Date(args.filter.createdBefore);
        }

        // Get notifications
        const result = await notificationRepository.findByRecipient(
          user.id,
          filters,
          {
            limit,
            offset,
            orderBy: 'createdAt',
            orderDirection: 'desc',
          }
        );

        // Get unread count
        const unreadCount = await notificationRepository.countUnreadByRecipient(user.id);

        // Convert to GraphQL connection
        const connection = createConnection(
          result.items,
          result.total,
          limit,
          offset,
          unreadCount
        );

        logger.info('User notifications retrieved successfully', {
          userId: user.id,
          totalCount: result.total,
          unreadCount,
          returnedCount: result.items.length,
          requestId: context.requestId,
        });

        return connection;
      } catch (error) {
        logger.error('Failed to get user notifications', {
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        throw new GraphQLError('Failed to get notifications', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Gets notification preferences for current user
     * 
     * Requirements: 21.2
     */
    getNotificationPreferences: async (
      _parent: unknown,
      _args: {},
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<NotificationPreferences> => {
      try {
        const user = requireAuth(context);
        const { notificationPreferenceService } = getDataSources(context);

        logger.info('Getting notification preferences', {
          userId: user.id,
          requestId: context.requestId,
        });

        const preferences = await notificationPreferenceService.getPreferences(user.id);

        logger.info('Notification preferences retrieved successfully', {
          userId: user.id,
          requestId: context.requestId,
        });

        return preferences;
      } catch (error) {
        logger.error('Failed to get notification preferences', {
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (error instanceof NotFoundError) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        throw new GraphQLError('Failed to get notification preferences', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Gets a single notification by ID
     * 
     * Requirements: 21.2, 21.3
     */
    getNotification: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<Notification | null> => {
      try {
        const user = requireAuth(context);
        const { notificationRepository } = getDataSources(context);

        logger.info('Getting notification by ID', {
          notificationId: args.id,
          userId: user.id,
          requestId: context.requestId,
        });

        const notification = await notificationRepository.findById(args.id);

        if (!notification) {
          return null;
        }

        // Check authorization - user can only access their own notifications
        if (notification.recipientId !== user.id) {
          throw new AuthorizationError('Access denied to this notification');
        }

        logger.info('Notification retrieved successfully', {
          notificationId: args.id,
          userId: user.id,
          requestId: context.requestId,
        });

        return notification;
      } catch (error) {
        logger.error('Failed to get notification', {
          notificationId: args.id,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        throw new GraphQLError('Failed to get notification', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Gets unread notification count
     * 
     * Requirements: 21.2
     */
    getUnreadNotificationCount: async (
      _parent: unknown,
      args: { notificationType?: NotificationType },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<number> => {
      try {
        const user = requireAuth(context);
        const { notificationRepository } = getDataSources(context);

        logger.info('Getting unread notification count', {
          userId: user.id,
          notificationType: args.notificationType,
          requestId: context.requestId,
        });

        let count: number;

        if (args.notificationType) {
          // Get count for specific notification type
          const result = await notificationRepository.findByRecipient(
            user.id,
            {
              notificationType: args.notificationType,
              isRead: false,
            },
            { limit: 1, offset: 0 }
          );
          count = result.total;
        } else {
          // Get total unread count
          count = await notificationRepository.countUnreadByRecipient(user.id);
        }

        logger.info('Unread notification count retrieved successfully', {
          userId: user.id,
          notificationType: args.notificationType,
          count,
          requestId: context.requestId,
        });

        return count;
      } catch (error) {
        logger.error('Failed to get unread notification count', {
          userId: context.user?.id,
          notificationType: args.notificationType,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        throw new GraphQLError('Failed to get unread notification count', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },
  },

  Mutation: {
    /**
     * Marks a notification as read
     * 
     * Requirements: 21.2, 21.3
     */
    markNotificationRead: async (
      _parent: unknown,
      args: { input: MarkNotificationReadInput },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<Notification> => {
      try {
        const user = requireAuth(context);
        const { notificationService } = getDataSources(context);

        logger.info('Marking notification as read', {
          notificationId: args.input.notificationId,
          userId: user.id,
          requestId: context.requestId,
        });

        // Validate input
        if (!args.input.notificationId || args.input.notificationId.trim().length === 0) {
          throw new ValidationError('Notification ID is required');
        }

        const notification = await notificationService.markAsRead(
          args.input.notificationId,
          user.id
        );

        logger.info('Notification marked as read successfully', {
          notificationId: args.input.notificationId,
          userId: user.id,
          requestId: context.requestId,
        });

        return notification;
      } catch (error) {
        logger.error('Failed to mark notification as read', {
          notificationId: args.input?.notificationId,
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (error instanceof NotFoundError) {
          throw new GraphQLError('Notification not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        throw new GraphQLError('Failed to mark notification as read', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Marks all notifications as read
     * 
     * Requirements: 21.2, 21.3
     */
    markAllNotificationsRead: async (
      _parent: unknown,
      args: { input?: MarkAllNotificationsReadInput },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<boolean> => {
      try {
        const user = requireAuth(context);
        const { notificationRepository } = getDataSources(context);

        logger.info('Marking all notifications as read', {
          userId: user.id,
          notificationType: args.input?.notificationType,
          olderThan: args.input?.olderThan,
          requestId: context.requestId,
        });

        let markedCount: number;

        if (args.input?.notificationType || args.input?.olderThan) {
          // Mark specific notifications as read
          const filters: any = { isRead: false };
          
          if (args.input.notificationType) {
            filters.notificationType = args.input.notificationType;
          }
          
          if (args.input.olderThan) {
            filters.createdBefore = new Date(args.input.olderThan);
          }

          // Get notifications to mark as read
          const result = await notificationRepository.findByRecipient(
            user.id,
            filters,
            { limit: 1000, offset: 0 } // Reasonable limit for bulk operations
          );

          if (result.items.length > 0) {
            const notificationIds = result.items.map(n => n.id);
            await notificationRepository.markManyAsRead(notificationIds);
            markedCount = notificationIds.length;
          } else {
            markedCount = 0;
          }
        } else {
          // Mark all notifications as read
          markedCount = await notificationRepository.markAllAsReadByRecipient(user.id);
        }

        logger.info('All notifications marked as read successfully', {
          userId: user.id,
          markedCount,
          requestId: context.requestId,
        });

        return true;
      } catch (error) {
        logger.error('Failed to mark all notifications as read', {
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        throw new GraphQLError('Failed to mark all notifications as read', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Updates notification preferences
     * 
     * Requirements: 21.2, 21.3
     */
    updateNotificationPreferences: async (
      _parent: unknown,
      args: { input: UpdateNotificationPreferencesInput },
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<NotificationPreferences> => {
      try {
        const user = requireAuth(context);
        const { notificationPreferenceService } = getDataSources(context);

        logger.info('Updating notification preferences', {
          userId: user.id,
          requestId: context.requestId,
        });

        // Validate input
        if (!args.input.preferences) {
          throw new ValidationError('Notification preferences are required');
        }

        await notificationPreferenceService.updatePreferences(
          user.id,
          args.input.preferences
        );

        // Get updated preferences
        const updatedPreferences = await notificationPreferenceService.getPreferences(user.id);

        logger.info('Notification preferences updated successfully', {
          userId: user.id,
          requestId: context.requestId,
        });

        return updatedPreferences;
      } catch (error) {
        logger.error('Failed to update notification preferences', {
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        if (error instanceof NotFoundError) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' },
          });
        }

        throw new GraphQLError('Failed to update notification preferences', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },

    /**
     * Deletes expired notifications (admin only)
     * 
     * Requirements: 21.2, 21.3
     */
    deleteExpiredNotifications: async (
      _parent: unknown,
      _args: {},
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ): Promise<number> => {
      try {
        const user = requireAuth(context);
        const { notificationRepository } = getDataSources(context);

        // Check admin authorization
        if (user.role !== 'admin') {
          throw new AuthorizationError('Admin access required');
        }

        logger.info('Deleting expired notifications', {
          userId: user.id,
          requestId: context.requestId,
        });

        const deletedCount = await notificationRepository.deleteExpired();

        logger.info('Expired notifications deleted successfully', {
          userId: user.id,
          deletedCount,
          requestId: context.requestId,
        });

        return deletedCount;
      } catch (error) {
        logger.error('Failed to delete expired notifications', {
          userId: context.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        if (error instanceof AuthenticationError) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Admin access required', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        throw new GraphQLError('Failed to delete expired notifications', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },
  },

  Subscription: {
    /**
     * Real-time notification delivery
     * 
     * Requirements: 21.4
     */
    notificationReceived: {
      subscribe: async (
        _parent: unknown,
        args: { userId: string },
        context: GraphQLContext,
        _info: GraphQLResolveInfo
      ) => {
        try {
          const user = requireAuth(context);
          const { realtimeService } = getDataSources(context);

          // Check authorization - users can only subscribe to their own notifications
          if (args.userId !== user.id) {
            throw new AuthorizationError('Can only subscribe to your own notifications');
          }

          if (!realtimeService) {
            throw new GraphQLError('Real-time service not available');
          }

          logger.info('Setting up notification subscription', {
            userId: args.userId,
            requestId: context.requestId,
          });

          // Return async iterator for real-time notifications
          // This would typically integrate with your WebSocket/subscription infrastructure
          // For now, we'll return a placeholder that would be implemented with your specific
          // subscription system (e.g., GraphQL subscriptions with Redis pub/sub)
          
          throw new GraphQLError('Subscription implementation pending', {
            extensions: { code: 'NOT_IMPLEMENTED' },
          });

        } catch (error) {
          logger.error('Failed to set up notification subscription', {
            userId: args.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: context.requestId,
          });

          if (error instanceof AuthenticationError) {
            throw new GraphQLError('Authentication required', {
              extensions: { code: 'UNAUTHENTICATED' },
            });
          }

          if (error instanceof AuthorizationError) {
            throw new GraphQLError('Access denied', {
              extensions: { code: 'FORBIDDEN' },
            });
          }

          throw error;
        }
      },
    },

    /**
     * Real-time notification read status updates
     * 
     * Requirements: 21.4
     */
    notificationRead: {
      subscribe: async (
        _parent: unknown,
        args: { userId: string },
        context: GraphQLContext,
        _info: GraphQLResolveInfo
      ) => {
        try {
          const user = requireAuth(context);

          // Check authorization - users can only subscribe to their own notifications
          if (args.userId !== user.id) {
            throw new AuthorizationError('Can only subscribe to your own notifications');
          }

          logger.info('Setting up notification read status subscription', {
            userId: args.userId,
            requestId: context.requestId,
          });

          // Placeholder for subscription implementation
          throw new GraphQLError('Subscription implementation pending', {
            extensions: { code: 'NOT_IMPLEMENTED' },
          });

        } catch (error) {
          logger.error('Failed to set up notification read status subscription', {
            userId: args.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: context.requestId,
          });

          throw error;
        }
      },
    },

    /**
     * Real-time unread count updates
     * 
     * Requirements: 21.4
     */
    unreadCountChanged: {
      subscribe: async (
        _parent: unknown,
        args: { userId: string },
        context: GraphQLContext,
        _info: GraphQLResolveInfo
      ) => {
        try {
          const user = requireAuth(context);

          // Check authorization - users can only subscribe to their own unread count
          if (args.userId !== user.id) {
            throw new AuthorizationError('Can only subscribe to your own unread count');
          }

          logger.info('Setting up unread count subscription', {
            userId: args.userId,
            requestId: context.requestId,
          });

          // Placeholder for subscription implementation
          throw new GraphQLError('Subscription implementation pending', {
            extensions: { code: 'NOT_IMPLEMENTED' },
          });

        } catch (error) {
          logger.error('Failed to set up unread count subscription', {
            userId: args.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: context.requestId,
          });

          throw error;
        }
      },
    },
  },

  // Field resolvers
  Notification: {
    /**
     * Resolves the recipient user for a notification
     * 
     * Requirements: 21.2
     */
    recipient: async (
      parent: Notification,
      _args: {},
      context: GraphQLContext,
      _info: GraphQLResolveInfo
    ) => {
      try {
        const { userRepository } = getDataSources(context);

        const user = await userRepository.findById(parent.recipientId);
        if (!user) {
          throw new NotFoundError('User', parent.recipientId);
        }

        return user;
      } catch (error) {
        logger.error('Failed to resolve notification recipient', {
          notificationId: parent.id,
          recipientId: parent.recipientId,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: context.requestId,
        });

        throw new GraphQLError('Failed to resolve recipient', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }
    },
  },
};