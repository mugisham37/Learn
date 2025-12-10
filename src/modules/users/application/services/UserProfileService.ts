/**
 * User Profile Service Implementation
 * 
 * Implements user profile management operations including profile updates,
 * avatar uploads with S3 integration, and notification preference management.
 * 
 * Requirements: 10.7
 */

import { randomUUID } from 'crypto';

import { ValidationError, NotFoundError, ExternalServiceError } from '../../../../shared/errors/index.js';
import { logger } from '../../../../shared/utils/logger.js';
import { IS3Service } from '../../../../shared/services/IS3Service.js';
import { IImageProcessingService } from '../../../../shared/services/IImageProcessingService.js';
import { UserProfile as UserProfileEntity, NotificationPreferences, PrivacySettings } from '../../domain/value-objects/UserProfile.js';
import { IUserProfileRepository } from '../../infrastructure/repositories/IUserProfileRepository.js';
import { IUserRepository } from '../../infrastructure/repositories/IUserRepository.js';
import {
  IUserProfileService,
  UpdateProfileDTO,
  AvatarUploadDTO,
  AvatarUploadResult,
} from './IUserProfileService.js';

/**
 * User Profile Service Implementation
 * 
 * Provides user profile management with:
 * - Profile CRUD operations
 * - Avatar upload and processing
 * - Notification preference management
 * - S3 integration for file storage
 * - Image optimization and thumbnail generation
 */
export class UserProfileService implements IUserProfileService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly s3Service: IS3Service,
    private readonly imageProcessingService: IImageProcessingService
  ) {}

  /**
   * Gets a user's profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfileEntity | null> {
    try {
      logger.info('Getting user profile', { userId });

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Get profile from database
      const profileData = await this.userProfileRepository.findByUserId(userId);
      if (!profileData) {
        return null;
      }

      // Convert to domain entity
      const profile = UserProfileEntity.create({
        fullName: profileData.fullName,
        bio: profileData.bio || undefined,
        avatarUrl: profileData.avatarUrl || undefined,
        timezone: profileData.timezone,
        language: profileData.language,
        notificationPreferences: profileData.notificationPreferences as NotificationPreferences,
        privacySettings: profileData.privacySettings as PrivacySettings,
      });

      logger.info('User profile retrieved successfully', { userId });
      return profile;
    } catch (error) {
      logger.error('Failed to get user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates a user's profile information
   */
  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserProfileEntity> {
    try {
      logger.info('Updating user profile', { userId, fields: Object.keys(data) });

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Validate update data
      this.validateUpdateData(data);

      // Check if profile exists, create if not
      let profileData = await this.userProfileRepository.findByUserId(userId);
      
      if (!profileData) {
        // Create new profile with default values
        profileData = await this.userProfileRepository.create({
          userId,
          fullName: data.fullName || 'Unknown User',
          bio: data.bio,
          timezone: data.timezone || 'UTC',
          language: data.language || 'en',
        });
      } else {
        // Update existing profile
        profileData = await this.userProfileRepository.update(userId, data);
      }

      // Convert to domain entity
      const profile = UserProfileEntity.create({
        fullName: profileData.fullName,
        bio: profileData.bio || undefined,
        avatarUrl: profileData.avatarUrl || undefined,
        timezone: profileData.timezone,
        language: profileData.language,
        notificationPreferences: profileData.notificationPreferences as NotificationPreferences,
        privacySettings: profileData.privacySettings as PrivacySettings,
      });

      logger.info('User profile updated successfully', { userId });
      return profile;
    } catch (error) {
      logger.error('Failed to update user profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Uploads and processes a user's avatar image
   */
  async uploadAvatar(userId: string, upload: AvatarUploadDTO): Promise<AvatarUploadResult> {
    try {
      logger.info('Uploading user avatar', {
        userId,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        fileType: upload.fileType,
      });

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Validate file
      this.validateAvatarFile(upload);

      // Validate image
      const isValidImage = await this.imageProcessingService.isValidImage(upload.buffer);
      if (!isValidImage) {
        throw new ValidationError('Invalid image file');
      }

      // Process images
      const [avatar, thumbnail] = await Promise.all([
        this.imageProcessingService.createAvatar(upload.buffer),
        this.imageProcessingService.createThumbnail(upload.buffer),
      ]);

      // Generate unique file keys
      const fileId = randomUUID();
      const avatarKey = `avatars/${userId}/${fileId}/avatar.jpg`;
      const thumbnailKey = `avatars/${userId}/${fileId}/thumbnail.jpg`;

      // Upload to S3
      const [avatarResult, thumbnailResult] = await Promise.all([
        this.s3Service.uploadFile({
          key: avatarKey,
          buffer: avatar.buffer,
          contentType: 'image/jpeg',
          metadata: {
            userId,
            type: 'avatar',
            originalFileName: upload.fileName,
          },
        }),
        this.s3Service.uploadFile({
          key: thumbnailKey,
          buffer: thumbnail.buffer,
          contentType: 'image/jpeg',
          metadata: {
            userId,
            type: 'thumbnail',
            originalFileName: upload.fileName,
          },
        }),
      ]);

      // Update user profile with new avatar URL
      await this.userProfileRepository.update(userId, {
        avatarUrl: avatarResult.url,
      });

      const result: AvatarUploadResult = {
        avatarUrl: avatarResult.url,
        thumbnailUrl: thumbnailResult.url,
      };

      logger.info('Avatar uploaded successfully', {
        userId,
        avatarUrl: result.avatarUrl,
        thumbnailUrl: result.thumbnailUrl,
      });

      return result;
    } catch (error) {
      logger.error('Failed to upload avatar', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof ExternalServiceError
      ) {
        throw error;
      }

      throw new Error(`Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Updates a user's notification preferences
   */
  async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<UserProfileEntity> {
    try {
      logger.info('Updating notification preferences', { userId });

      // Verify user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Validate preferences
      this.validateNotificationPreferences(preferences);

      // Get existing profile or create if not exists
      let profileData = await this.userProfileRepository.findByUserId(userId);
      
      if (!profileData) {
        // Create new profile with default values
        profileData = await this.userProfileRepository.create({
          userId,
          fullName: 'Unknown User',
          notificationPreferences: preferences,
        });
      } else {
        // Update existing profile
        profileData = await this.userProfileRepository.update(userId, {
          notificationPreferences: preferences,
        });
      }

      // Convert to domain entity
      const profile = UserProfileEntity.create({
        fullName: profileData.fullName,
        bio: profileData.bio || undefined,
        avatarUrl: profileData.avatarUrl || undefined,
        timezone: profileData.timezone,
        language: profileData.language,
        notificationPreferences: profileData.notificationPreferences as NotificationPreferences,
        privacySettings: profileData.privacySettings as PrivacySettings,
      });

      logger.info('Notification preferences updated successfully', { userId });
      return profile;
    } catch (error) {
      logger.error('Failed to update notification preferences', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      throw new Error(`Failed to update notification preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates update profile data
   */
  private validateUpdateData(data: UpdateProfileDTO): void {
    if (data.fullName !== undefined) {
      if (!data.fullName || data.fullName.trim().length === 0) {
        throw new ValidationError('Full name cannot be empty');
      }
      if (data.fullName.length > 255) {
        throw new ValidationError('Full name cannot exceed 255 characters');
      }
    }

    if (data.bio !== undefined && data.bio !== null) {
      if (data.bio.length > 5000) {
        throw new ValidationError('Bio cannot exceed 5000 characters');
      }
    }

    if (data.timezone !== undefined) {
      if (!data.timezone || data.timezone.trim().length === 0) {
        throw new ValidationError('Timezone cannot be empty');
      }
    }

    if (data.language !== undefined) {
      if (!data.language || data.language.trim().length === 0) {
        throw new ValidationError('Language cannot be empty');
      }
      if (data.language.length > 10) {
        throw new ValidationError('Language code cannot exceed 10 characters');
      }
    }
  }

  /**
   * Validates avatar file upload
   */
  private validateAvatarFile(upload: AvatarUploadDTO): void {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (upload.fileSize > maxSize) {
      throw new ValidationError(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(upload.fileType.toLowerCase())) {
      throw new ValidationError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check buffer
    if (!upload.buffer || upload.buffer.length === 0) {
      throw new ValidationError('File buffer is empty');
    }

    if (upload.buffer.length !== upload.fileSize) {
      throw new ValidationError('File size mismatch');
    }
  }

  /**
   * Validates notification preferences
   */
  private validateNotificationPreferences(preferences: NotificationPreferences): void {
    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Notification preferences must be an object');
    }

    // Validate structure - each channel should be an object with boolean values
    const validChannels = ['email', 'push', 'inApp'];
    const validTypes = [
      'newMessage',
      'assignmentDue',
      'gradePosted',
      'courseUpdate',
      'announcement',
      'discussionReply',
    ];

    for (const [channel, settings] of Object.entries(preferences)) {
      if (!validChannels.includes(channel)) {
        throw new ValidationError(`Invalid notification channel: ${channel}`);
      }

      if (settings && typeof settings === 'object') {
        for (const [type, enabled] of Object.entries(settings)) {
          if (!validTypes.includes(type)) {
            throw new ValidationError(`Invalid notification type: ${type}`);
          }
          if (typeof enabled !== 'boolean') {
            throw new ValidationError(`Notification preference value must be boolean: ${channel}.${type}`);
          }
        }
      }
    }
  }
}