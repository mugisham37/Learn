/**
 * Messaging Service Implementation
 * 
 * Implements messaging operations with real-time delivery, notifications,
 * and S3 file attachment handling
 */

import { randomUUID } from 'node:crypto';

import type { Message } from '../../../../infrastructure/database/schema/communication.schema.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../../shared/errors/index.js';
import { sanitizeByContentType } from '../../../../shared/utils/sanitization.js';
import { IS3Service } from '../../../../shared/services/IS3Service.js';
import { 
  IMessagingRepository, 
  MessagePagination, 
  PaginatedResult, 
  CreateMessageDTO 
} from '../../infrastructure/repositories/IMessagingRepository.js';

import { 
  IMessagingService, 
  MessageContent, 
  MessageAttachment, 
  MessageResult, 
  ConversationResult 
} from './IMessagingService.js';

/**
 * Placeholder interfaces for services that will be implemented in later tasks
 * These will be replaced with actual implementations when those modules are ready
 */
interface IRealtimeService {
  emitToUser(userId: string, event: string, data: unknown): Promise<void>;
}

interface INotificationService {
  createNotification(recipientId: string, data: {
    type: string;
    title: string;
    content: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * MessagingService
 * 
 * Handles direct messaging between users with real-time delivery,
 * notification integration, and file attachment support
 * 
 * Requirements:
 * - 9.1: Direct messaging with real-time delivery and notifications
 */
export class MessagingService implements IMessagingService {
  constructor(
    private messagingRepository: IMessagingRepository,
    private s3Service: IS3Service,
    private realtimeService?: IRealtimeService,
    private notificationService?: INotificationService
  ) {}

  /**
   * Send a message with real-time delivery and notifications
   */
  async sendMessage(
    senderId: string, 
    recipientId: string, 
    content: MessageContent
  ): Promise<MessageResult> {
    // Validate input
    if (!senderId || !recipientId) {
      throw new ValidationError('Sender ID and recipient ID are required');
    }

    if (!content.content?.trim()) {
      throw new ValidationError('Message content cannot be empty');
    }

    if (senderId === recipientId) {
      throw new ValidationError('Cannot send message to yourself');
    }

    // Validate parent message if provided
    if (content.parentMessageId) {
      const parentMessage = await this.messagingRepository.findById(content.parentMessageId);
      if (!parentMessage) {
        throw new NotFoundError('Parent message not found');
      }

      // Ensure parent message is in the same conversation
      const conversationId = this.messagingRepository.getOrCreateConversationId(senderId, recipientId);
      if (parentMessage.conversationId !== conversationId) {
        throw new ValidationError('Parent message is not in the same conversation');
      }
    }

    // Create message data with sanitized content
    const messageData: CreateMessageDTO = {
      senderId,
      recipientId,
      subject: content.subject?.trim(),
      content: sanitizeByContentType(content.content.trim(), 'message.content'),
      attachments: content.attachments || [],
      parentMessageId: content.parentMessageId,
    };

    // Create the message
    const message = await this.messagingRepository.create(messageData);

    // Attempt real-time delivery
    let deliveredRealtime = false;
    if (this.realtimeService) {
      try {
        await this.realtimeService.emitToUser(recipientId, 'message:received', {
          messageId: message.id,
          senderId: message.senderId,
          conversationId: message.conversationId,
          content: message.content,
          subject: message.subject,
          attachments: message.attachments,
          createdAt: message.createdAt,
        });
        deliveredRealtime = true;
      } catch (error) {
        // Log error but don't fail the message send
        console.error('Failed to deliver message via real-time:', error);
      }
    }

    // Send notification
    let notificationSent = false;
    if (this.notificationService) {
      try {
        await this.notificationService.createNotification(recipientId, {
          type: 'new_message',
          title: 'New Message',
          content: content.subject 
            ? `${content.subject}: ${content.content.substring(0, 100)}${content.content.length > 100 ? '...' : ''}`
            : content.content.substring(0, 100) + (content.content.length > 100 ? '...' : ''),
          actionUrl: `/messages/${message.conversationId}`,
          metadata: {
            messageId: message.id,
            senderId: message.senderId,
            conversationId: message.conversationId,
          },
        });
        notificationSent = true;
      } catch (error) {
        // Log error but don't fail the message send
        console.error('Failed to send message notification:', error);
      }
    }

    return {
      message,
      deliveredRealtime,
      notificationSent,
    };
  }

  /**
   * Get conversations for a user with pagination
   */
  async getConversations(
    userId: string, 
    pagination: MessagePagination
  ): Promise<ConversationResult> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Get conversations
    const conversations = await this.messagingRepository.getConversations(userId, pagination);

    // Get total unread count
    const totalUnreadCount = await this.messagingRepository.getUnreadCount(userId);

    return {
      conversations,
      totalUnreadCount,
    };
  }

  /**
   * Mark a message as read by the recipient
   */
  async markAsRead(messageId: string, userId: string): Promise<void> {
    if (!messageId || !userId) {
      throw new ValidationError('Message ID and user ID are required');
    }

    // Verify the message exists and user is the recipient
    const message = await this.messagingRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.recipientId !== userId) {
      throw new AuthorizationError('You can only mark your own messages as read');
    }

    // Mark as read
    await this.messagingRepository.markAsRead(messageId, userId);

    // Emit real-time update if available
    if (this.realtimeService) {
      try {
        await this.realtimeService.emitToUser(message.senderId, 'message:read', {
          messageId: message.id,
          readBy: userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to emit message read status:', error);
      }
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    if (!conversationId || !userId) {
      throw new ValidationError('Conversation ID and user ID are required');
    }

    await this.messagingRepository.markConversationAsRead(conversationId, userId);

    // Emit real-time update if available
    if (this.realtimeService) {
      try {
        await this.realtimeService.emitToUser(userId, 'conversation:read', {
          conversationId,
          readBy: userId,
          readAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to emit conversation read status:', error);
      }
    }
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    pagination: MessagePagination
  ): Promise<PaginatedResult<Message>> {
    if (!conversationId || !userId) {
      throw new ValidationError('Conversation ID and user ID are required');
    }

    // Verify user has access to this conversation
    // A user has access if they are either the sender or recipient of any message in the conversation
    const messages = await this.messagingRepository.findByConversation(conversationId, userId, {
      limit: 1,
      offset: 0,
    });

    if (messages.totalCount === 0) {
      // Check if conversation exists but user doesn't have access
      // This is a simple check - in a real implementation you might want more sophisticated access control
      throw new AuthorizationError('You do not have access to this conversation');
    }

    return await this.messagingRepository.findByConversation(conversationId, userId, pagination);
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    return await this.messagingRepository.getUnreadCount(userId);
  }

  /**
   * Soft delete a message for a specific user
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!messageId || !userId) {
      throw new ValidationError('Message ID and user ID are required');
    }

    // Verify the message exists and user has permission to delete it
    const message = await this.messagingRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new AuthorizationError('You can only delete your own messages');
    }

    await this.messagingRepository.softDelete(messageId, userId);
  }

  /**
   * Upload and attach files to a message
   */
  async uploadAttachments(
    files: Array<{
      fileName: string;
      buffer: Buffer;
      mimeType: string;
    }>,
    userId: string
  ): Promise<MessageAttachment[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!files || files.length === 0) {
      return [];
    }

    // Validate file constraints
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 5;
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (files.length > maxFiles) {
      throw new ValidationError(`Maximum ${maxFiles} files allowed per message`);
    }

    for (const file of files) {
      if (file.buffer.length > maxFileSize) {
        throw new ValidationError(`File ${file.fileName} exceeds maximum size of 10MB`);
      }

      if (!allowedMimeTypes.includes(file.mimeType)) {
        throw new ValidationError(`File type ${file.mimeType} is not allowed`);
      }
    }

    // Upload files to S3
    const attachments: MessageAttachment[] = [];

    for (const file of files) {
      try {
        const fileId = randomUUID();
        const fileExtension = file.fileName.split('.').pop() || '';
        const s3Key = `messages/${userId}/${fileId}.${fileExtension}`;

        // Upload to S3
        await this.s3Service.uploadFile({
          key: s3Key,
          buffer: file.buffer,
          contentType: file.mimeType,
        });

        // Generate signed URL for access
        const fileUrl = await this.s3Service.generatePresignedUrl({
          key: s3Key,
          expiresIn: 3600, // 1 hour expiry
        });

        attachments.push({
          id: fileId,
          fileName: file.fileName,
          fileUrl,
          fileSize: file.buffer.length,
          mimeType: file.mimeType,
          uploadedAt: new Date(),
        });
      } catch (error) {
        console.error(`Failed to upload file ${file.fileName}:`, error);
        throw new ValidationError(`Failed to upload file ${file.fileName}`);
      }
    }

    return attachments;
  }
}