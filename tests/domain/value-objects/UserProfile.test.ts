/**
 * UserProfile Value Object Tests
 * 
 * Tests for the UserProfile value object to ensure proper validation
 * and immutability.
 */

import { describe, it, expect } from 'vitest';
import { UserProfile } from '../../../src/modules/users/domain/value-objects/UserProfile.js';

describe('UserProfile Value Object', () => {
  describe('create', () => {
    it('should create profile with valid data', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      expect(profile.fullName).toBe('John Doe');
      expect(profile.timezone).toBe('UTC');
      expect(profile.language).toBe('en');
    });

    it('should create profile with optional fields', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        bio: 'Software developer',
        avatarUrl: 'https://example.com/avatar.jpg',
        timezone: 'America/New_York',
        language: 'en',
      });

      expect(profile.bio).toBe('Software developer');
      expect(profile.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should reject empty full name', () => {
      expect(() =>
        UserProfile.create({
          fullName: '',
          timezone: 'UTC',
          language: 'en',
        })
      ).toThrow('Full name is required');
    });

    it('should reject full name exceeding 255 characters', () => {
      expect(() =>
        UserProfile.create({
          fullName: 'a'.repeat(256),
          timezone: 'UTC',
          language: 'en',
        })
      ).toThrow('cannot exceed 255 characters');
    });

    it('should reject bio exceeding 5000 characters', () => {
      expect(() =>
        UserProfile.create({
          fullName: 'John Doe',
          bio: 'a'.repeat(5001),
          timezone: 'UTC',
          language: 'en',
        })
      ).toThrow('Bio cannot exceed 5000 characters');
    });

    it('should reject invalid avatar URL', () => {
      expect(() =>
        UserProfile.create({
          fullName: 'John Doe',
          avatarUrl: 'not-a-valid-url',
          timezone: 'UTC',
          language: 'en',
        })
      ).toThrow('must be a valid URL');
    });

    it('should reject empty timezone', () => {
      expect(() =>
        UserProfile.create({
          fullName: 'John Doe',
          timezone: '',
          language: 'en',
        })
      ).toThrow('Timezone is required');
    });

    it('should reject empty language', () => {
      expect(() =>
        UserProfile.create({
          fullName: 'John Doe',
          timezone: 'UTC',
          language: '',
        })
      ).toThrow('Language is required');
    });
  });

  describe('update methods', () => {
    it('should create new instance with updated full name', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const updated = profile.updateFullName('Jane Doe');

      expect(updated.fullName).toBe('Jane Doe');
      expect(profile.fullName).toBe('John Doe'); // Original unchanged
    });

    it('should create new instance with updated bio', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const updated = profile.updateBio('New bio');

      expect(updated.bio).toBe('New bio');
      expect(profile.bio).toBeUndefined(); // Original unchanged
    });

    it('should create new instance with updated avatar URL', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const updated = profile.updateAvatarUrl('https://example.com/new-avatar.jpg');

      expect(updated.avatarUrl).toBe('https://example.com/new-avatar.jpg');
      expect(profile.avatarUrl).toBeUndefined(); // Original unchanged
    });

    it('should create new instance with updated notification preferences', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const preferences = {
        email: { newMessage: true, gradePosted: false },
      };

      const updated = profile.updateNotificationPreferences(preferences);

      expect(updated.notificationPreferences).toEqual(preferences);
      expect(profile.notificationPreferences).toEqual({}); // Original unchanged
    });

    it('should create new instance with updated privacy settings', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const settings = {
        profileVisibility: 'private' as const,
        showEmail: false,
      };

      const updated = profile.updatePrivacySettings(settings);

      expect(updated.privacySettings).toEqual(settings);
      expect(profile.privacySettings).toEqual({}); // Original unchanged
    });
  });

  describe('toObject', () => {
    it('should convert to plain object', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        bio: 'Developer',
        timezone: 'UTC',
        language: 'en',
      });

      const obj = profile.toObject();

      expect(obj).toEqual({
        fullName: 'John Doe',
        bio: 'Developer',
        avatarUrl: undefined,
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      });
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const profile = UserProfile.create({
        fullName: 'John Doe',
        timezone: 'UTC',
        language: 'en',
      });

      const json = profile.toJSON();

      expect(json).toEqual({
        fullName: 'John Doe',
        bio: undefined,
        avatarUrl: undefined,
        timezone: 'UTC',
        language: 'en',
        notificationPreferences: {},
        privacySettings: {},
      });
    });
  });
});
