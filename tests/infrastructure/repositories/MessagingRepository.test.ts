/**
 * Messaging Repository Tests
 * 
 * Basic tests to verify messaging repository implementation compiles
 * and basic functionality works correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database functions
vi.mock('../../../src/infrastructure/database/index.js', () => ({
  getWriteDb: vi.fn(),
  getReadDb: vi.fn(),
}));

import { MessagingRepository } from '../../../src/modules/communication/infrastructure/repositories/MessagingRepository.js';
import { CreateMessageDTO } from '../../../src/modules/communication/infrastructure/repositories/IMessagingRepository.js';

describe('MessagingRepository', () => {
  let messagingRepository: MessagingRepository;

  // Mock database objects
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    messagingRepository = new MessagingRepository(mockDb as any);
  });

  describe('create', () => {
    it('should create message successfully', async () => {
      // Arrange
      const createData: CreateMessageDTO = {
        senderId: 'user-1',
        recipientId: 'user-2',
        content: 'Hello, this is a test message',
        subject: 'Test Subject',
      };

      const mockCreatedMessage = {
        id: 'message-123',
        conversationId: 'conv_user-1_user-2',
        ...createData,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([mockCreatedMessage]);

      // Act
      const result = await messagingRepository.create(createData);

      // Assert
      expect(result).toEqual(mockCreatedMessage);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });
  });

  describe('getOrCreateConversationId', () => {
    it('should generate consistent conversation ID regardless of user order', () => {
      // Act
      const conversationId1 = messagingRepository.getOrCreateConversationId('user-1', 'user-2');
      const conversationId2 = messagingRepository.getOrCreateConversationId('user-2', 'user-1');

      // Assert
      expect(conversationId1).toBe(conversationId2);
      expect(conversationId1).toBe('conv_user-1_user-2');
    });

    it('should generate different conversation IDs for different user pairs', () => {
      // Act
      const conversationId1 = messagingRepository.getOrCreateConversationId('user-1', 'user-2');
      const conversationId2 = messagingRepository.getOrCreateConversationId('user-1', 'user-3');

      // Assert
      expect(conversationId1).not.toBe(conversationId2);
    });
  });

  describe('findById', () => {
    it('should return message when found', async () => {
      // Arrange
      const messageId = 'message-123';
      const mockMessage = {
        id: messageId,
        senderId: 'user-1',
        recipientId: 'user-2',
        content: 'Test message',
      };

      mockDb.limit.mockResolvedValue([mockMessage]);

      // Act
      const result = await messagingRepository.findById(messageId);

      // Assert
      expect(result).toEqual(mockMessage);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when message not found', async () => {
      // Arrange
      const messageId = 'nonexistent-message';
      mockDb.limit.mockResolvedValue([]);

      // Act
      const result = await messagingRepository.findById(messageId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read successfully', async () => {
      // Arrange
      const messageId = 'message-123';
      const userId = 'user-2';

      // Act
      await messagingRepository.markAsRead(messageId, userId);

      // Assert
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count', async () => {
      // Arrange
      const userId = 'user-2';
      const mockCount = { unreadCount: 5 };
      
      // Mock the full chain
      mockDb.where.mockResolvedValue([mockCount]);

      // Act
      const result = await messagingRepository.getUnreadCount(userId);

      // Assert
      expect(result).toBe(5);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});