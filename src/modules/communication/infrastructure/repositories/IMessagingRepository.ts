/**
 * Messaging Repository Interface
 *
 * Defines data access methods for messaging functionality
 * Supports direct messages, conversations, and read status tracking
 */

import type {
  Message,
  NewMessage,
} from '../../../../infrastructure/database/schema/communication.schema.js';

/**
 * Conversation summary for listing user conversations
 */
export interface ConversationSummary {
  conversationId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl?: string;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
    isRead: boolean;
  };
  unreadCount: number;
  totalMessages: number;
}

/**
 * Pagination parameters for message queries
 */
export interface MessagePagination {
  limit: number;
  offset: number;
  cursor?: string; // For cursor-based pagination
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Message creation data transfer object
 */
export interface CreateMessageDTO {
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  attachments?: any[];
  parentMessageId?: string;
}

/**
 * Message update data transfer object
 */
export interface UpdateMessageDTO {
  isRead?: boolean;
  readAt?: Date;
  deletedBySender?: Date;
  deletedByRecipient?: Date;
}

/**
 * Messaging Repository Interface
 *
 * Requirements:
 * - 9.1: Direct messaging with real-time delivery and notifications
 */
export interface IMessagingRepository {
  /**
   * Create a new message
   * Generates conversation ID if not provided
   */
  create(data: CreateMessageDTO): Promise<Message>;

  /**
   * Find message by ID
   */
  findById(id: string): Promise<Message | null>;

  /**
   * Find messages in a conversation between two users
   * Supports pagination and excludes soft-deleted messages
   */
  findByConversation(
    conversationId: string,
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<Message>>;

  /**
   * Get all conversations for a user
   * Returns conversation summaries with last message and unread count
   */
  getConversations(
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<ConversationSummary>>;

  /**
   * Update message (typically for read status or soft delete)
   */
  update(id: string, data: UpdateMessageDTO): Promise<Message>;

  /**
   * Mark message as read by recipient
   */
  markAsRead(messageId: string, userId: string): Promise<void>;

  /**
   * Mark all messages in a conversation as read by user
   */
  markConversationAsRead(conversationId: string, userId: string): Promise<void>;

  /**
   * Get unread message count for a user
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Soft delete message for a specific user
   */
  softDelete(messageId: string, userId: string): Promise<void>;

  /**
   * Generate or retrieve conversation ID between two users
   * Ensures consistent conversation ID regardless of who initiates
   */
  getOrCreateConversationId(userId1: string, userId2: string): string;

  /**
   * Find messages by recipient with unread filter
   * Used for real-time notifications
   */
  findUnreadByRecipient(recipientId: string): Promise<Message[]>;
}
