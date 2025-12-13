/**
 * Messaging Service Interface
 *
 * Defines application-level messaging operations including real-time delivery,
 * conversation management, and notification integration
 */

import type { Message } from '../../../../infrastructure/database/schema/communication.schema.js';
import type {
  ConversationSummary,
  MessagePagination,
  PaginatedResult,
} from '../../infrastructure/repositories/IMessagingRepository.js';

/**
 * Message content with optional attachments
 */
export interface MessageContent {
  subject?: string;
  content: string;
  attachments?: MessageAttachment[];
  parentMessageId?: string;
}

/**
 * Message attachment metadata
 */
export interface MessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

/**
 * Message creation result with delivery status
 */
export interface MessageResult {
  message: Message;
  deliveredRealtime: boolean;
  notificationSent: boolean;
}

/**
 * Conversation with pagination metadata
 */
export interface ConversationResult {
  conversations: PaginatedResult<ConversationSummary>;
  totalUnreadCount: number;
}

/**
 * Messaging Service Interface
 *
 * Requirements:
 * - 9.1: Direct messaging with real-time delivery and notifications
 */
export interface IMessagingService {
  /**
   * Send a message with real-time delivery and notifications
   *
   * @param senderId - ID of the user sending the message
   * @param recipientId - ID of the user receiving the message
   * @param content - Message content and attachments
   * @returns Message with delivery status
   */
  sendMessage(
    senderId: string,
    recipientId: string,
    content: MessageContent
  ): Promise<MessageResult>;

  /**
   * Get conversations for a user with pagination
   *
   * @param userId - ID of the user requesting conversations
   * @param pagination - Pagination parameters
   * @returns Paginated conversations with unread count
   */
  getConversations(userId: string, pagination: MessagePagination): Promise<ConversationResult>;

  /**
   * Mark a message as read by the recipient
   *
   * @param messageId - ID of the message to mark as read
   * @param userId - ID of the user marking the message as read
   */
  markAsRead(messageId: string, userId: string): Promise<void>;

  /**
   * Mark all messages in a conversation as read
   *
   * @param conversationId - ID of the conversation
   * @param userId - ID of the user marking messages as read
   */
  markConversationAsRead(conversationId: string, userId: string): Promise<void>;

  /**
   * Get messages in a conversation with pagination
   *
   * @param conversationId - ID of the conversation
   * @param userId - ID of the user requesting messages (for access control)
   * @param pagination - Pagination parameters
   * @returns Paginated messages in the conversation
   */
  getConversationMessages(
    conversationId: string,
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<Message>>;

  /**
   * Get unread message count for a user
   *
   * @param userId - ID of the user
   * @returns Number of unread messages
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Soft delete a message for a specific user
   *
   * @param messageId - ID of the message to delete
   * @param userId - ID of the user deleting the message
   */
  deleteMessage(messageId: string, userId: string): Promise<void>;

  /**
   * Upload and attach files to a message
   *
   * @param files - Array of file data to upload
   * @param userId - ID of the user uploading files
   * @returns Array of attachment metadata
   */
  uploadAttachments(
    files: Array<{
      fileName: string;
      buffer: Buffer;
      mimeType: string;
    }>,
    userId: string
  ): Promise<MessageAttachment[]>;
}
