/**
 * User Profile Service Interface
 * 
 * Defines the contract for user profile management operations.
 * Handles profile updates, avatar uploads, and notification preferences.
 * 
 * Requirements: 10.7
 */

import { UserProfile, NotificationPreferences } from '../../domain/value-objects/UserProfile.js';

/**
 * Data Transfer Object for updating user profile
 */
export interface UpdateProfileDTO {
  fullName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

/**
 * Data Transfer Object for avatar upload
 */
export interface AvatarUploadDTO {
  fileName: string;
  fileType: string;
  fileSize: number;
  buffer: Buffer;
}

/**
 * Avatar upload result
 */
export interface AvatarUploadResult {
  avatarUrl: string;
  thumbnailUrl: string;
}

/**
 * User Profile Service Interface
 * 
 * Provides methods for managing user profiles, including avatar uploads
 * and notification preference management.
 */
export interface IUserProfileService {
  /**
   * Gets a user's profile by user ID
   * 
   * @param userId - User ID
   * @returns The user profile if found, null otherwise
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if database operation fails
   */
  getUserProfile(userId: string): Promise<UserProfile | null>;

  /**
   * Updates a user's profile information
   * 
   * @param userId - User ID
   * @param data - Profile update data
   * @returns The updated user profile
   * @throws NotFoundError if user doesn't exist
   * @throws ValidationError if data is invalid
   * @throws DatabaseError if database operation fails
   */
  updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserProfile>;

  /**
   * Uploads and processes a user's avatar image
   * Handles image optimization and thumbnail generation
   * 
   * @param userId - User ID
   * @param upload - Avatar upload data
   * @returns Avatar upload result with URLs
   * @throws NotFoundError if user doesn't exist
   * @throws ValidationError if file is invalid
   * @throws ExternalServiceError if S3 upload fails
   */
  uploadAvatar(userId: string, upload: AvatarUploadDTO): Promise<AvatarUploadResult>;

  /**
   * Updates a user's notification preferences
   * 
   * @param userId - User ID
   * @param preferences - New notification preferences
   * @returns The updated user profile
   * @throws NotFoundError if user doesn't exist
   * @throws ValidationError if preferences are invalid
   * @throws DatabaseError if database operation fails
   */
  updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<UserProfile>;
}