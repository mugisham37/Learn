/**
 * Messaging Repository Implementation
 *
 * Implements messaging data access using Drizzle ORM
 * Handles conversation grouping, read status tracking, and pagination
 */

import { eq, and, or, desc, count, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  messages,
  Message,
  NewMessage,
} from '../../../../infrastructure/database/schema/communication.schema.js';
import { users } from '../../../../infrastructure/database/schema/users.schema.js';

import {
  IMessagingRepository,
  ConversationSummary,
  MessagePagination,
  PaginatedResult,
  CreateMessageDTO,
  UpdateMessageDTO,
} from './IMessagingRepository.js';

/**
 * MessagingRepository
 *
 * Provides data access methods for messaging functionality
 * Implements conversation grouping logic and read status tracking
 *
 * Requirements:
 * - 9.1: Direct messaging with real-time delivery and notifications
 */
export class MessagingRepository implements IMessagingRepository {
  constructor(private db: NodePgDatabase) {}

  /**
   * Create a new message
   * Generates conversation ID if not provided using deterministic algorithm
   */
  async create(data: CreateMessageDTO): Promise<Message> {
    const conversationId = this.getOrCreateConversationId(data.senderId, data.recipientId);

    const messageData: NewMessage = {
      senderId: data.senderId,
      recipientId: data.recipientId,
      conversationId,
      subject: data.subject,
      content: data.content,
      attachments: data.attachments || [],
      parentMessageId: data.parentMessageId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.db.insert(messages).values(messageData).returning();
    
    if (!result[0]) {
      throw new Error('Failed to create message');
    }

    return result[0];
  }

  /**
   * Find message by ID
   */
  async findById(id: string): Promise<Message | null> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    
    return result[0] || null;
  }

  /**
   * Find messages in a conversation between two users
   * Excludes messages that have been soft-deleted by the requesting user
   */
  async findByConversation(
    conversationId: string,
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<Message>> {
    // Build the where condition to exclude soft-deleted messages for this user
    const whereCondition = and(
      eq(messages.conversationId, conversationId),
      or(
        // Message not deleted by sender (if user is sender)
        and(eq(messages.senderId, userId), isNull(messages.deletedBySender)),
        // Message not deleted by recipient (if user is recipient)
        and(eq(messages.recipientId, userId), isNull(messages.deletedByRecipient)),
        // User is neither sender nor recipient (shouldn't happen, but safe fallback)
        and(eq(messages.senderId, userId), eq(messages.recipientId, userId))
      )
    );

    // Get total count
    const totalCountResult = await this.db
      .select({ totalCount: count() })
      .from(messages)
      .where(whereCondition);
    
    const totalCount = totalCountResult[0]?.totalCount || 0;

    // Get messages with pagination (newest first)
    const messageList = await this.db
      .select()
      .from(messages)
      .where(whereCondition)
      .orderBy(desc(messages.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return {
      items: messageList,
      totalCount: Number(totalCount),
      hasMore: pagination.offset + messageList.length < Number(totalCount),
      nextCursor: messageList.length > 0 ? messageList[messageList.length - 1]?.id : undefined,
    };
  }

  /**
   * Get all conversations for a user
   * Returns conversation summaries with last message and unread count
   */
  async getConversations(
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<ConversationSummary>> {
    // This is a complex query that groups messages by conversation
    // and gets the latest message for each conversation along with unread count

    // First, get all conversation IDs for the user
    const conversationQuery = this.db
      .selectDistinct({ conversationId: messages.conversationId })
      .from(messages)
      .where(
        and(
          or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
          // Exclude conversations where all messages are soft-deleted by this user
          or(
            and(eq(messages.senderId, userId), isNull(messages.deletedBySender)),
            and(eq(messages.recipientId, userId), isNull(messages.deletedByRecipient))
          )
        )
      );

    const conversations = await conversationQuery;

    // For each conversation, get the summary data
    const conversationSummaries: ConversationSummary[] = [];

    for (const { conversationId } of conversations) {
      // Get the latest message in this conversation
      const [latestMessage] = await this.db
        .select({
          id: messages.id,
          content: messages.content,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          createdAt: messages.createdAt,
          isRead: messages.isRead,
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            or(
              and(eq(messages.senderId, userId), isNull(messages.deletedBySender)),
              and(eq(messages.recipientId, userId), isNull(messages.deletedByRecipient))
            )
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (!latestMessage) continue;

      // Determine the other user in the conversation
      const otherUserId =
        latestMessage.senderId === userId ? latestMessage.recipientId : latestMessage.senderId;

      // Get other user's profile information
      const [otherUser] = await this.db
        .select({
          id: users.id,
          email: users.email,
          fullName: sql<string>`COALESCE((SELECT full_name FROM user_profiles WHERE user_id = users.id), users.email)`,
          avatarUrl: sql<
            string | null
          >`(SELECT avatar_url FROM user_profiles WHERE user_id = users.id)`,
        })
        .from(users)
        .where(eq(users.id, otherUserId))
        .limit(1);

      if (!otherUser) continue;

      // Get unread count for this conversation (messages sent to this user that are unread)
      const unreadCountResult = await this.db
        .select({ unreadCount: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.recipientId, userId),
            eq(messages.isRead, false),
            isNull(messages.deletedByRecipient)
          )
        );
      
      const unreadCount = unreadCountResult[0]?.unreadCount || 0;

      // Get total message count for this conversation
      const totalMessagesResult = await this.db
        .select({ totalMessages: count() })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            or(
              and(eq(messages.senderId, userId), isNull(messages.deletedBySender)),
              and(eq(messages.recipientId, userId), isNull(messages.deletedByRecipient))
            )
          )
        );
      
      const totalMessages = totalMessagesResult[0]?.totalMessages || 0;

      conversationSummaries.push({
        conversationId,
        otherUserId,
        otherUserName: otherUser.fullName,
        otherUserAvatarUrl: otherUser.avatarUrl || undefined,
        lastMessage: {
          id: latestMessage.id,
          content: latestMessage.content,
          senderId: latestMessage.senderId,
          createdAt: latestMessage.createdAt,
          isRead: latestMessage.isRead,
        },
        unreadCount: Number(unreadCount),
        totalMessages: Number(totalMessages),
      });
    }

    // Sort by last message timestamp (newest first)
    conversationSummaries.sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
    );

    // Apply pagination
    const paginatedSummaries = conversationSummaries.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );

    return {
      items: paginatedSummaries,
      totalCount: conversationSummaries.length,
      hasMore: pagination.offset + paginatedSummaries.length < conversationSummaries.length,
      nextCursor:
        paginatedSummaries.length > 0
          ? paginatedSummaries[paginatedSummaries.length - 1]?.conversationId
          : undefined,
    };
  }

  /**
   * Update message (typically for read status or soft delete)
   */
  async update(id: string, data: UpdateMessageDTO): Promise<Message> {
    const updateData: Partial<NewMessage> = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.db
      .update(messages)
      .set(updateData)
      .where(eq(messages.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to update message');
    }

    return result[0];
  }

  /**
   * Mark message as read by recipient
   */
  async markAsRead(messageId: string, userId: string): Promise<void> {
    await this.db
      .update(messages)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(messages.id, messageId), eq(messages.recipientId, userId)));
  }

  /**
   * Mark all messages in a conversation as read by user
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await this.db
      .update(messages)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const unreadCountResult = await this.db
      .select({ unreadCount: count() })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false),
          isNull(messages.deletedByRecipient)
        )
      );

    return Number(unreadCountResult[0]?.unreadCount || 0);
  }

  /**
   * Soft delete message for a specific user
   */
  async softDelete(messageId: string, userId: string): Promise<void> {
    const message = await this.findById(messageId);
    if (!message) return;

    const now = new Date();
    const updateData: Partial<NewMessage> = { updatedAt: now };

    if (message.senderId === userId) {
      updateData.deletedBySender = now;
    } else if (message.recipientId === userId) {
      updateData.deletedByRecipient = now;
    }

    await this.db.update(messages).set(updateData).where(eq(messages.id, messageId));
  }

  /**
   * Generate or retrieve conversation ID between two users
   * Uses deterministic algorithm to ensure same ID regardless of who initiates
   */
  getOrCreateConversationId(userId1: string, userId2: string): string {
    // Sort user IDs to ensure consistent conversation ID
    const sortedIds = [userId1, userId2].sort();
    return `conv_${sortedIds[0]}_${sortedIds[1]}`;
  }

  /**
   * Find messages by recipient with unread filter
   * Used for real-time notifications
   */
  async findUnreadByRecipient(recipientId: string): Promise<Message[]> {
    return await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, recipientId),
          eq(messages.isRead, false),
          isNull(messages.deletedByRecipient)
        )
      )
      .orderBy(desc(messages.createdAt));
  }
}
