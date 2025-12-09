/**
 * Users Domain Module
 * 
 * Exports all domain entities, value objects, and types for the users module.
 * This is the public API of the domain layer.
 * 
 * Requirements: 1.1, 1.3
 */

// Entities
export { User, type UserRole, type UserProps } from './entities/User.js';

// Value Objects
export { Email } from './value-objects/Email.js';
export { Password } from './value-objects/Password.js';
export { 
  UserProfile, 
  type UserProfileProps, 
  type NotificationPreferences, 
  type PrivacySettings 
} from './value-objects/UserProfile.js';
