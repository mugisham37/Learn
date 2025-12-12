/**
 * GraphQL Resolvers for Communication Module
 * 
 * Implements GraphQL resolvers for messaging, discussions, announcements,
 * and real-time communication operations with proper error handling,
 * authorization, and enrollment validation.
 * 
 * Requirements: 21.2, 21.3, 21.4
 */

import { GraphQLError } from 'graphql';
import { 
  SUBSCRIPTION_EVENTS, 
  createAsyncIterator, 
  publishEvent, 
  withFilter 
} from '../../../../infrastructure/graphql/pubsub.js';
import { requireSubscriptionAuth } from '../../../../infrastructure/graphql/subscriptionServer.js';

import { ValidationError, AuthorizationError, NotFoundError } from '../../../../shared/errors/index.js';
import { IRealtimeService, PresenceStatus } from '../../../../shared/services/IRealtimeService.js';
import { 
  IAnnouncementService,
  AnnouncementCreationResult 
} from '../../application/services/IAnnouncementService.js';
import { 
  IDiscussionService,
  CreateThreadDTO,
  CreateReplyDTO,
  VotePostDTO,
  MarkSolutionDTO
} from '../../application/services/IDiscussionService.js';
import { 
  IMessagingService, 
  MessageContent, 
  MessageResult, 
  ConversationResult 
} from '../../application/services/IMessagingService.js';
import { VoteType } from '../../domain/entities/DiscussionPost.js';

/**
 * GraphQL context interface
 */
export interface CommunicationGraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  messagingService: IMessagingService;
  discussionService: IDiscussionService;
  announcementService: IAnnouncementService;
  realtimeService?: IRealtimeService;
  pubsub: PubSub;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface MessageInput {
  subject?: string;
  content: string;
  attachments?: MessageAttachmentInput[];
  parentMessageId?: string;
}

interface MessageAttachmentInput {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface CreateThreadInput {
  category: string;
  title: string;
  content: string;
}

interface ReplyToThreadInput {
  content: string;
  parentPostId?: string;
}

interface AnnouncementInput {
  title: string;
  content: string;
  scheduledFor?: string; // ISO date string
}

interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

interface ThreadFilter {
  category?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  authorId?: string;
}

interface AnnouncementFilter {
  publishedOnly?: boolean;
  scheduledOnly?: boolean;
}

/**
 * Helper function to require authentication
 */
function requireAuth(context: CommunicationGraphQLContext): { id: string; email: string; role: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
  return context.user;
}

/**
 * Helper function to check educator role
 */
function requireEducatorRole(context: CommunicationGraphQLContext): { id: string; email: string; role: string } {
  const user = requireAuth(context);
  if (user.role !== 'educator' && user.role !== 'admin') {
    throw new GraphQLError('Educator role required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 }
      }
    });
  }
  return user;
}

/**
 * Helper function to convert pagination input to service format
 */
function convertPagination(pagination?: PaginationInput): { limit: number; offset: number } {
  if (!pagination) {
    return { limit: 20, offset: 0 };
  }

  // Simple pagination conversion - in a real implementation you'd handle cursor-based pagination
  const limit = pagination.first || pagination.last || 20;
  const offset = pagination.after ? parseInt(pagination.after, 10) || 0 : 0;
  
  return { limit: Math.min(limit, 100), offset }; // Cap at 100 items
}

/**
 * Helper function to convert service results to GraphQL connection format
 */
function toConnection<T>(items: T[], totalCount: number, pagination: { limit: number; offset: number }): any {
  const edges = items.map((item, index) => ({
    node: item,
    cursor: (pagination.offset + index).toString()
  }));

  const hasNextPage = pagination.offset + pagination.limit < totalCount;
  const hasPreviousPage = pagination.offset > 0;

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
    },
    totalCount
  };
}

// PubSub instance will be provided through GraphQL context

/**
 * GraphQL resolvers for communication module
 */
export const communicationResolvers = {
  Query: {
    /**
     * Get conversations for the authenticated user
     */
    conversations: async (
      _parent: any, 
      args: { pagination?: PaginationInput }, 
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const pagination = convertPagination(args.pagination);
        const result: ConversationResult = await context.messagingService.getConversations(
          user.id, 
          pagination
        );
        
        return toConnection(
          result.conversations.items, 
          result.conversations.totalCount, 
          pagination
        );
      } catch (error) {
        throw new GraphQLError('Failed to fetch conversations', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get messages in a conversation
     */
    conversationMessages: async (
      _parent: any,
      args: { conversationId: string; pagination?: PaginationInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const pagination = convertPagination(args.pagination);
        const result = await context.messagingService.getConversationMessages(
          args.conversationId,
          user.id,
          pagination
        );
        
        return toConnection(result.items, result.totalCount, pagination);
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to conversation', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        throw new GraphQLError('Failed to fetch conversation messages', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get unread message count
     */
    unreadMessageCount: async (
      _parent: any,
      _args: any,
      context: CommunicationGraphQLContext
    ): Promise<number> => {
      const user = requireAuth(context);
      
      try {
        return await context.messagingService.getUnreadCount(user.id);
      } catch (error) {
        throw new GraphQLError('Failed to fetch unread count', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get discussion threads for a course
     */
    discussionThreads: async (
      _parent: any,
      args: { 
        courseId: string; 
        filter?: ThreadFilter; 
        pagination?: PaginationInput 
      },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const pagination = convertPagination(args.pagination);
        const filter = args.filter || {};
        
        const result = await context.discussionService.getThreadsByCourse(
          args.courseId,
          user.id,
          filter,
          'lastActivityAt' as any, // Default sort by last activity
          'desc',
          pagination
        );
        
        return toConnection(result.items, result.totalCount, pagination);
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Must be enrolled in course to view discussions', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        throw new GraphQLError('Failed to fetch discussion threads', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get a specific discussion thread
     */
    discussionThread: async (
      _parent: any,
      args: { threadId: string },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        // Get posts to validate access and increment view count
        const result = await context.discussionService.getPostsByThread(
          args.threadId,
          user.id,
          { limit: 1, offset: 0 }
        );
        
        // If we can access posts, we can access the thread
        // In a real implementation, you'd have a separate method to get thread details
        return result.items[0]?.threadId || null;
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to discussion thread', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          return null;
        }
        
        throw new GraphQLError('Failed to fetch discussion thread', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get posts in a thread
     */
    threadPosts: async (
      _parent: any,
      args: { threadId: string; pagination?: PaginationInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const pagination = convertPagination(args.pagination);
        const result = await context.discussionService.getPostsByThread(
          args.threadId,
          user.id,
          pagination
        );
        
        return toConnection(result.items, result.totalCount, pagination);
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to discussion posts', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Discussion thread not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to fetch thread posts', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get announcements for a course
     */
    announcements: async (
      _parent: any,
      args: { 
        courseId: string; 
        filter?: AnnouncementFilter; 
        pagination?: PaginationInput 
      },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const pagination = convertPagination(args.pagination);
        const options = {
          includeScheduled: !args.filter?.publishedOnly,
          limit: pagination.limit,
          offset: pagination.offset
        };
        
        const announcements = await context.announcementService.getCourseAnnouncements(
          args.courseId,
          options
        );
        
        // Filter based on user role and filter options
        let filteredAnnouncements = announcements;
        
        if (args.filter?.publishedOnly) {
          filteredAnnouncements = announcements.filter(a => a.publishedAt);
        }
        
        if (args.filter?.scheduledOnly) {
          filteredAnnouncements = announcements.filter(a => a.scheduledFor && !a.publishedAt);
        }
        
        return toConnection(filteredAnnouncements, filteredAnnouncements.length, pagination);
      } catch (error) {
        throw new GraphQLError('Failed to fetch announcements', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get a specific announcement
     */
    announcement: async (
      _parent: any,
      args: { announcementId: string },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        return await context.announcementService.getAnnouncementById(
          args.announcementId,
          user.id
        );
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Access denied to announcement', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        throw new GraphQLError('Failed to fetch announcement', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Get course presence (online users)
     */
    coursePresence: async (
      _parent: any,
      args: { courseId: string },
      context: CommunicationGraphQLContext
    ): Promise<any[]> => {
      const user = requireAuth(context);
      
      try {
        if (!context.realtimeService) {
          return [];
        }
        
        const onlineUserIds = await context.realtimeService.getOnlineUsersInCourse(args.courseId);
        
        // Convert to presence updates format
        return onlineUserIds.map(userId => ({
          userId,
          user: { id: userId }, // This would be populated by field resolver
          status: 'ONLINE' as PresenceStatus,
          courseId: args.courseId,
          lastSeen: new Date().toISOString()
        }));
      } catch (error) {
        throw new GraphQLError('Failed to fetch course presence', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    }
  },

  Mutation: {
    /**
     * Send a message
     */
    sendMessage: async (
      _parent: any,
      args: { recipientId: string; input: MessageInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        // Validate input
        if (!args.input.content?.trim()) {
          throw new GraphQLError('Message content is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        const messageContent: MessageContent = {
          subject: args.input.subject,
          content: args.input.content.trim(),
          attachments: args.input.attachments?.map(att => ({
            id: '', // Will be generated by service
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            uploadedAt: new Date()
          })),
          parentMessageId: args.input.parentMessageId
        };
        
        const result: MessageResult = await context.messagingService.sendMessage(
          user.id,
          args.recipientId,
          messageContent
        );
        
        // Publish to subscriptions
        await publishEvent(SUBSCRIPTION_EVENTS.MESSAGE_RECEIVED, {
          messageReceived: result.message,
          userId: args.recipientId
        });
        
        return result.message;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to send message', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Mark message as read
     */
    markMessageAsRead: async (
      _parent: any,
      args: { messageId: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        await context.messagingService.markAsRead(args.messageId, user.id);
        return true;
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Cannot mark this message as read', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Message not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to mark message as read', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Mark conversation as read
     */
    markConversationAsRead: async (
      _parent: any,
      args: { conversationId: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        await context.messagingService.markConversationAsRead(args.conversationId, user.id);
        return true;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        throw new GraphQLError('Failed to mark conversation as read', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Delete message
     */
    deleteMessage: async (
      _parent: any,
      args: { messageId: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        await context.messagingService.deleteMessage(args.messageId, user.id);
        return true;
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Cannot delete this message', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Message not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to delete message', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Create discussion thread
     */
    createDiscussionThread: async (
      _parent: any,
      args: { courseId: string; input: CreateThreadInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        // Validate input
        if (!args.input.title?.trim()) {
          throw new GraphQLError('Thread title is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (!args.input.content?.trim()) {
          throw new GraphQLError('Thread content is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (!args.input.category?.trim()) {
          throw new GraphQLError('Thread category is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        const createData: CreateThreadDTO = {
          courseId: args.courseId,
          authorId: user.id,
          category: args.input.category.trim(),
          title: args.input.title.trim(),
          content: args.input.content.trim()
        };
        
        const result = await context.discussionService.createThread(createData);
        
        // Publish to subscriptions
        await publishEvent(SUBSCRIPTION_EVENTS.THREAD_UPDATED, {
          threadCreated: result.thread,
          courseId: args.courseId
        });
        
        return result.thread;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Must be enrolled in course to create discussions', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        throw new GraphQLError('Failed to create discussion thread', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Reply to thread
     */
    replyToThread: async (
      _parent: any,
      args: { threadId: string; input: ReplyToThreadInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        // Validate input
        if (!args.input.content?.trim()) {
          throw new GraphQLError('Reply content is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        const replyData: CreateReplyDTO = {
          threadId: args.threadId,
          authorId: user.id,
          content: args.input.content.trim(),
          parentPostId: args.input.parentPostId
        };
        
        const result = await context.discussionService.replyToThread(replyData);
        
        // Publish to subscriptions
        await publishEvent(SUBSCRIPTION_EVENTS.NEW_DISCUSSION_POST, {
          newDiscussionPost: result.post,
          threadId: args.threadId
        });
        
        return result.post;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Cannot reply to this thread', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Thread or parent post not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to create reply', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Vote on post
     */
    votePost: async (
      _parent: any,
      args: { postId: string; voteType: 'UPVOTE' | 'REMOVE_VOTE' },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireAuth(context);
      
      try {
        const voteData: VotePostDTO = {
          postId: args.postId,
          userId: user.id,
          voteType: args.voteType === 'UPVOTE' ? VoteType.UPVOTE : VoteType.REMOVE_VOTE
        };
        
        await context.discussionService.votePost(voteData);
        
        // For now, return a simple success response
        // In a real implementation, the service would return the updated post
        const mockUpdatedPost = {
          id: args.postId,
          upvoteCount: 1, // This would come from the service
          // ... other post fields
        };
        
        // Publish to subscriptions
        await publishEvent(SUBSCRIPTION_EVENTS.POST_VOTED, {
          postVoted: mockUpdatedPost,
          postId: args.postId
        });
        
        return mockUpdatedPost;
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Cannot vote on this post', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Post not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to vote on post', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Mark solution
     */
    markSolution: async (
      _parent: any,
      args: { postId: string },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireEducatorRole(context);
      
      try {
        const solutionData: MarkSolutionDTO = {
          postId: args.postId,
          educatorId: user.id,
          isSolution: true
        };
        
        const result = await context.discussionService.markSolution(solutionData);
        
        // Publish to subscriptions
        await publishEvent(SUBSCRIPTION_EVENTS.POST_VOTED, {
          solutionMarked: result.post,
          postId: args.postId
        });
        
        return result.post;
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw new GraphQLError('Only course instructors can mark solutions', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 }
            }
          });
        }
        
        if (error instanceof NotFoundError) {
          throw new GraphQLError('Post not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 }
            }
          });
        }
        
        throw new GraphQLError('Failed to mark solution', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Create announcement
     */
    createAnnouncement: async (
      _parent: any,
      args: { courseId: string; input: AnnouncementInput },
      context: CommunicationGraphQLContext
    ): Promise<any> => {
      const user = requireEducatorRole(context);
      
      try {
        // Validate input
        if (!args.input.title?.trim()) {
          throw new GraphQLError('Announcement title is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        if (!args.input.content?.trim()) {
          throw new GraphQLError('Announcement content is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        const announcementData = {
          title: args.input.title.trim(),
          content: args.input.content.trim(),
          scheduledFor: args.input.scheduledFor ? new Date(args.input.scheduledFor) : undefined
        };
        
        const result: AnnouncementCreationResult = await context.announcementService.createAnnouncement(
          args.courseId,
          user.id,
          announcementData
        );
        
        if (!result.success) {
          throw new GraphQLError(result.error || 'Failed to create announcement', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 }
            }
          });
        }
        
        // Publish to subscriptions if published immediately
        if (result.announcement && result.announcement.publishedAt) {
          await publishEvent(SUBSCRIPTION_EVENTS.ANNOUNCEMENT_PUBLISHED, {
            announcementPublished: result.announcement,
            courseId: args.courseId
          });
        }
        
        return result.announcement!;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        
        if (error instanceof ValidationError || error instanceof AuthorizationError) {
          throw new GraphQLError(error.message, {
            extensions: {
              code: error instanceof ValidationError ? 'BAD_USER_INPUT' : 'FORBIDDEN',
              http: { status: error instanceof ValidationError ? 400 : 403 }
            }
          });
        }
        
        throw new GraphQLError('Failed to create announcement', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Update presence
     */
    updatePresence: async (
      _parent: any,
      args: { status: 'ONLINE' | 'OFFLINE' | 'AWAY'; courseId?: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        if (!context.realtimeService) {
          return false;
        }
        
        const status: PresenceStatus = args.status.toLowerCase() as PresenceStatus;
        const courseIds = args.courseId ? [args.courseId] : undefined;
        
        await context.realtimeService.broadcastPresence(user.id, status, courseIds);
        
        // Publish to subscriptions
        if (args.courseId) {
          await publishEvent(SUBSCRIPTION_EVENTS.USER_PRESENCE, {
            userPresence: {
              userId: user.id,
              user: { id: user.id },
              status: args.status,
              courseId: args.courseId,
              lastSeen: new Date().toISOString()
            },
            courseId: args.courseId
          });
        }
        
        return true;
      } catch (error) {
        throw new GraphQLError('Failed to update presence', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 }
          }
        });
      }
    },

    /**
     * Start typing indicator
     */
    startTyping: async (
      _parent: any,
      args: { conversationId?: string; threadId?: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        // Simulate async operation
        await Promise.resolve();
        // Publish typing indicator
        const typingData = {
          userId: user.id,
          user: { id: user.id },
          conversationId: args.conversationId,
          threadId: args.threadId,
          isTyping: true
        };
        
        if (args.conversationId) {
          await publishEvent(SUBSCRIPTION_EVENTS.TYPING_INDICATOR, {
            typingIndicator: typingData,
            conversationId: args.conversationId
          });
        }
        
        if (args.threadId) {
          await publishEvent(SUBSCRIPTION_EVENTS.TYPING_INDICATOR, {
            typingIndicator: typingData,
            threadId: args.threadId
          });
        }
        
        return true;
      } catch (error) {
        return false;
      }
    },

    /**
     * Stop typing indicator
     */
    stopTyping: async (
      _parent: any,
      args: { conversationId?: string; threadId?: string },
      context: CommunicationGraphQLContext
    ): Promise<boolean> => {
      const user = requireAuth(context);
      
      try {
        // Simulate async operation
        await Promise.resolve();
        // Publish typing indicator
        const typingData = {
          userId: user.id,
          user: { id: user.id },
          conversationId: args.conversationId,
          threadId: args.threadId,
          isTyping: false
        };
        
        if (args.conversationId) {
          await publishEvent(SUBSCRIPTION_EVENTS.TYPING_INDICATOR, {
            typingIndicator: typingData,
            conversationId: args.conversationId
          });
        }
        
        if (args.threadId) {
          await publishEvent(SUBSCRIPTION_EVENTS.TYPING_INDICATOR, {
            typingIndicator: typingData,
            threadId: args.threadId
          });
        }
        
        return true;
      } catch (error) {
        return false;
      }
    }
  },

  Subscription: {
    /**
     * Message received subscription
     */
    messageReceived: {
      subscribe: withFilter(
        (_parent: any, _args: any, context: CommunicationGraphQLContext) => {
          // Require authentication for subscriptions
          requireSubscriptionAuth(context);
          return createAsyncIterator(SUBSCRIPTION_EVENTS.MESSAGE_RECEIVED);
        },
        (payload: any, variables: any, context: CommunicationGraphQLContext) => {
          // Users can only subscribe to their own messages
          const user = requireSubscriptionAuth(context);
          return payload.userId === variables.userId && payload.userId === user.id;
        }
      )
    },

    /**
     * New discussion post subscription
     */
    newDiscussionPost: {
      subscribe: withFilter(
        (_parent: any, _args: any, context: CommunicationGraphQLContext) => {
          // Require authentication for subscriptions
          requireSubscriptionAuth(context);
          return createAsyncIterator(SUBSCRIPTION_EVENTS.NEW_DISCUSSION_POST);
        },
        (payload: any, variables: any) => {
          return payload.threadId === variables.threadId;
        }
      )
    },

    /**
     * Announcement published subscription
     */
    announcementPublished: {
      subscribe: withFilter(
        (_parent: any, _args: any, context: CommunicationGraphQLContext) => {
          // Require authentication for subscriptions
          requireSubscriptionAuth(context);
          return createAsyncIterator(SUBSCRIPTION_EVENTS.ANNOUNCEMENT_PUBLISHED);
        },
        (payload: any, variables: any) => {
          return payload.courseId === variables.courseId;
        }
      )
    },

    /**
     * User presence subscription
     */
    userPresence: {
      subscribe: withFilter(
        (_parent: any, _args: any, context: CommunicationGraphQLContext) => {
          // Require authentication for subscriptions
          requireSubscriptionAuth(context);
          return createAsyncIterator(SUBSCRIPTION_EVENTS.USER_PRESENCE);
        },
        (payload: any, variables: any) => {
          return payload.courseId === variables.courseId;
        }
      )
    },

    /**
     * Typing indicator subscription
     */
    typingIndicator: {
      subscribe: withFilter(
        (_parent: any, _args: any, context: CommunicationGraphQLContext) => {
          // Require authentication for subscriptions
          requireSubscriptionAuth(context);
          return createAsyncIterator(SUBSCRIPTION_EVENTS.TYPING_INDICATOR);
        },
        (payload: any, variables: any) => {
          return (
            (variables.conversationId && payload.conversationId === variables.conversationId) ||
            (variables.threadId && payload.threadId === variables.threadId)
          );
        }
      )
    }
  }
};