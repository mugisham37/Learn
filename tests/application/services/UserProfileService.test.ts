/**
 * UserProfileService Tests
 * 
 * Tests for user profile management operations including profile updates,
 * avatar uploads, and notification preference management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserProfileService } from '../../../src/modules/users/application/services/UserProfileService.js';
import { UserProfile, NotificationPreferences } from '../../../src/modules/users/domain/value-objects/UserProfile.js';
import { User } from '../../../src/modules/users/domain/entities/User.js';
import { ValidationError, NotFoundError } from '../../../src/shared/errors/index.js';

// Mock dependencies
const mockUserRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  findByEmail: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

const mockUserProfileRepository = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  invalidateCache: vi.fn(),
};

const mockS3Service = {
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  generatePresignedUrl: vi.fn(),
  fileExists: vi.fn(),
  getPublicUrl: vi.fn(),
};

const mockImageProcessingService = {
  processImage: vi.fn(),
  isValidImage: vi.fn(),
  getImageMetadata: vi.fn(),
  createAvatar: vi.fn(),
  createThumbnail: vi.fn(),
};

describe('UserProfileService', () => {
  let userProfileService: UserProfileService;
  let mockUser: User;

  beforeEach(() => {
    vi.clearAllMocks();
    
    userProfileService = new UserProfileService(
      mockUserRepository as any,
      mockUserProfileRepository as any,
      mockS3Service as any,
      mockImageProcessingService as any
    );

    // Create mock user
    mockUser = User.create({
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      role: 'student',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      // Arrange
      const mockProfileData = {
        userId: 'user-123',
        fullName: 'John Doe',
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockProfileData);

      // Act
      const result = await userProfileService.getUserProfile('user-123');

      // Assert
      expect(result).toBeInstanceOf(UserProfile);
      expect(result?.fullName).toBe('John Doe');
      expect(result?.bio).toBe('Test bio');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockUserProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should return null when profile not found', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserProfileRepository.findByUserId.mockResolvedValue(null);

      // Act
      const result = await userProfileService.getUserProfile('user-123');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userProfileService.getUserProfile('user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', async () => {
      // Arrange
      const updateData = {
        fullName: 'Jane Doe',
        bio: 'Updated bio',
      };

      const existingProfileData = {
        userId: 'user-123',
        fullName: 'John Doe',
        bio: 'Old bio',
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      };

      const updatedProfileData = {
        ...existingProfileData,
        ...updateData,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserProfileRepository.findByUserId.mockResolvedValue(existingProfileData);
      mockUserProfileRepository.update.mockResolvedValue(updatedProfileData);

      // Act
      const result = await userProfileService.updateProfile('user-123', updateData);

      // Assert
      expect(result).toBeInstanceOf(UserProfile);
      expect(result.fullName).toBe('Jane Doe');
      expect(result.bio).toBe('Updated bio');
      expect(mockUserProfileRepository.update).toHaveBeenCalledWith('user-123', updateData);
    });

    it('should create new profile if none exists', async () => {
      // Arrange
      const updateData = {
        fullName: 'Jane Doe',
        bio: 'New bio',
      };

      const newProfileData = {
        userId: 'user-123',
        fullName: 'Jane Doe',
        bio: 'New bio',
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserProfileRepository.findByUserId.mockResolvedValue(null);
      mockUserProfileRepository.create.mockResolvedValue(newProfileData);

      // Act
      const result = await userProfileService.updateProfile('user-123', updateData);

      // Assert
      expect(result).toBeInstanceOf(UserProfile);
      expect(result.fullName).toBe('Jane Doe');
      expect(mockUserProfileRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        fullName: 'Jane Doe',
        bio: 'New bio',
        timezone: 'UTC',
        language: 'en',
      });
    });

    it('should validate update data', async () => {
      // Arrange
      const invalidData = {
        fullName: '', // Empty name should be rejected
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userProfileService.updateProfile('user-123', invalidData))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('uploadAvatar', () => {
    it('should upload and process avatar successfully', async () => {
      // Arrange
      const imageBuffer = Buffer.alloc(1024, 'fake-image-data');
      const uploadData = {
        fileName: 'avatar.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        buffer: imageBuffer,
      };

      const processedAvatar = {
        buffer: Buffer.from('processed-avatar'),
        format: 'jpeg',
        width: 256,
        height: 256,
        size: 512,
      };

      const processedThumbnail = {
        buffer: Buffer.from('processed-thumbnail'),
        format: 'jpeg',
        width: 64,
        height: 64,
        size: 128,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockImageProcessingService.isValidImage.mockResolvedValue(true);
      mockImageProcessingService.createAvatar.mockResolvedValue(processedAvatar);
      mockImageProcessingService.createThumbnail.mockResolvedValue(processedThumbnail);
      mockS3Service.uploadFile
        .mockResolvedValueOnce({
          key: 'avatars/user-123/avatar.jpg',
          url: 'https://example.com/avatar.jpg',
          etag: 'etag123',
        })
        .mockResolvedValueOnce({
          key: 'avatars/user-123/thumbnail.jpg',
          url: 'https://example.com/thumbnail.jpg',
          etag: 'etag456',
        });
      mockUserProfileRepository.update.mockResolvedValue({});

      // Act
      const result = await userProfileService.uploadAvatar('user-123', uploadData);

      // Assert
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.thumbnailUrl).toBe('https://example.com/thumbnail.jpg');
      expect(mockImageProcessingService.isValidImage).toHaveBeenCalledWith(uploadData.buffer);
      expect(mockImageProcessingService.createAvatar).toHaveBeenCalledWith(uploadData.buffer);
      expect(mockImageProcessingService.createThumbnail).toHaveBeenCalledWith(uploadData.buffer);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should validate file type and size', async () => {
      // Arrange
      const invalidUpload = {
        fileName: 'document.pdf',
        fileType: 'application/pdf', // Invalid type
        fileSize: 1024,
        buffer: Buffer.from('fake-data'),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userProfileService.uploadAvatar('user-123', invalidUpload))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        email: {
          newMessage: true,
          assignmentDue: false,
        },
        push: {
          newMessage: false,
          assignmentDue: true,
        },
      };

      const existingProfileData = {
        userId: 'user-123',
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      };

      const updatedProfileData = {
        ...existingProfileData,
        notificationPreferences: preferences,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserProfileRepository.findByUserId.mockResolvedValue(existingProfileData);
      mockUserProfileRepository.update.mockResolvedValue(updatedProfileData);

      // Act
      const result = await userProfileService.updateNotificationPreferences('user-123', preferences);

      // Assert
      expect(result).toBeInstanceOf(UserProfile);
      expect(result.notificationPreferences).toEqual(preferences);
      expect(mockUserProfileRepository.update).toHaveBeenCalledWith('user-123', {
        notificationPreferences: preferences,
      });
    });

    it('should validate notification preferences structure', async () => {
      // Arrange
      const invalidPreferences = {
        invalidChannel: { // Invalid channel name
          newMessage: true,
        },
      } as any;

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(userProfileService.updateNotificationPreferences('user-123', invalidPreferences))
        .rejects.toThrow(ValidationError);
    });
  });
});