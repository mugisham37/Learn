/**
 * User Entity Tests
 * 
 * Tests for the User entity to ensure proper validation,
 * business logic, and state management.
 */

import { describe, it, expect } from 'vitest';
import { User } from '../../../src/modules/users/domain/entities/User.js';
import { Email } from '../../../src/modules/users/domain/value-objects/Email.js';

describe('User Entity', () => {
  const createValidUserProps = (): {
    id: string;
    email: Email;
    passwordHash: string;
    role: 'student' | 'educator' | 'admin';
    emailVerified: boolean;
    verificationToken?: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  } => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: Email.create('test@example.com'),
    passwordHash: '$2b$12$hashedpassword',
    role: 'student',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('create', () => {
    it('should create user with valid properties', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      expect(user.id).toBe(props.id);
      expect(user.email.value).toBe('test@example.com');
      expect(user.role).toBe('student');
      expect(user.emailVerified).toBe(false);
    });

    it('should reject empty user ID', () => {
      const props = createValidUserProps();
      props.id = '';

      expect(() => User.create(props)).toThrow('User ID is required');
    });

    it('should reject empty password hash', () => {
      const props = createValidUserProps();
      props.passwordHash = '';

      expect(() => User.create(props)).toThrow('Password hash is required');
    });

    it('should reject invalid role', () => {
      const props = createValidUserProps();
      (props as any).role = 'invalid';

      expect(() => User.create(props)).toThrow('Invalid role');
    });

    it('should reject invalid createdAt date', () => {
      const props = createValidUserProps();
      (props as any).createdAt = 'not-a-date';

      expect(() => User.create(props)).toThrow('Invalid createdAt date');
    });

    it('should reject password reset token without expiration', () => {
      const props = createValidUserProps();
      props.passwordResetToken = 'token123';

      expect(() => User.create(props)).toThrow('Password reset expiration is required');
    });
  });

  describe('role checking methods', () => {
    it('should correctly identify student role', () => {
      const props = createValidUserProps();
      props.role = 'student';
      const user = User.create(props);

      expect(user.isStudent()).toBe(true);
      expect(user.isEducator()).toBe(false);
      expect(user.isAdmin()).toBe(false);
      expect(user.hasRole('student')).toBe(true);
    });

    it('should correctly identify educator role', () => {
      const props = createValidUserProps();
      props.role = 'educator';
      const user = User.create(props);

      expect(user.isEducator()).toBe(true);
      expect(user.isStudent()).toBe(false);
      expect(user.isAdmin()).toBe(false);
      expect(user.hasRole('educator')).toBe(true);
    });

    it('should correctly identify admin role', () => {
      const props = createValidUserProps();
      props.role = 'admin';
      const user = User.create(props);

      expect(user.isAdmin()).toBe(true);
      expect(user.isStudent()).toBe(false);
      expect(user.isEducator()).toBe(false);
      expect(user.hasRole('admin')).toBe(true);
    });

    it('should check multiple roles', () => {
      const props = createValidUserProps();
      props.role = 'student';
      const user = User.create(props);

      expect(user.hasAnyRole(['student', 'educator'])).toBe(true);
      expect(user.hasAnyRole(['educator', 'admin'])).toBe(false);
    });
  });

  describe('status checking methods', () => {
    it('should identify deleted user', () => {
      const props = createValidUserProps();
      props.deletedAt = new Date();
      const user = User.create(props);

      expect(user.isDeleted()).toBe(true);
    });

    it('should identify non-deleted user', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      expect(user.isDeleted()).toBe(false);
    });

    it('should identify active user', () => {
      const props = createValidUserProps();
      props.emailVerified = true;
      const user = User.create(props);

      expect(user.isActive()).toBe(true);
    });

    it('should identify inactive user (not verified)', () => {
      const props = createValidUserProps();
      props.emailVerified = false;
      const user = User.create(props);

      expect(user.isActive()).toBe(false);
    });

    it('should identify inactive user (deleted)', () => {
      const props = createValidUserProps();
      props.emailVerified = true;
      props.deletedAt = new Date();
      const user = User.create(props);

      expect(user.isActive()).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and clear verification token', () => {
      const props = createValidUserProps();
      props.verificationToken = 'token123';
      const user = User.create(props);

      user.verifyEmail();

      expect(user.emailVerified).toBe(true);
      expect(user.verificationToken).toBeUndefined();
    });

    it('should throw error if email already verified', () => {
      const props = createValidUserProps();
      props.emailVerified = true;
      const user = User.create(props);

      expect(() => user.verifyEmail()).toThrow('already verified');
    });
  });

  describe('updateEmail', () => {
    it('should update email and reset verification', () => {
      const props = createValidUserProps();
      props.emailVerified = true;
      const user = User.create(props);

      const newEmail = Email.create('newemail@example.com');
      user.updateEmail(newEmail);

      expect(user.email.value).toBe('newemail@example.com');
      expect(user.emailVerified).toBe(false);
    });

    it('should not change anything if email is the same', () => {
      const props = createValidUserProps();
      props.emailVerified = true;
      const user = User.create(props);

      const sameEmail = Email.create('test@example.com');
      user.updateEmail(sameEmail);

      expect(user.emailVerified).toBe(true);
    });
  });

  describe('updatePasswordHash', () => {
    it('should update password hash and clear reset tokens', () => {
      const props = createValidUserProps();
      props.passwordResetToken = 'token123';
      props.passwordResetExpires = new Date(Date.now() + 3600000);
      const user = User.create(props);

      user.updatePasswordHash('$2b$12$newhashedpassword');

      expect(user.passwordHash).toBe('$2b$12$newhashedpassword');
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
    });

    it('should reject empty password hash', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      expect(() => user.updatePasswordHash('')).toThrow('Password hash is required');
    });
  });

  describe('updateRole', () => {
    it('should update user role', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      user.updateRole('educator');

      expect(user.role).toBe('educator');
    });

    it('should reject invalid role', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      expect(() => user.updateRole('invalid' as any)).toThrow('Invalid role');
    });
  });

  describe('password reset token management', () => {
    it('should set password reset token with expiration', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const expiresAt = new Date(Date.now() + 3600000);
      user.setPasswordResetToken('token123', expiresAt);

      expect(user.passwordResetToken).toBe('token123');
      expect(user.passwordResetExpires).toEqual(expiresAt);
    });

    it('should reject empty token', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const expiresAt = new Date(Date.now() + 3600000);
      expect(() => user.setPasswordResetToken('', expiresAt)).toThrow('token is required');
    });

    it('should reject expiration in the past', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const expiresAt = new Date(Date.now() - 3600000);
      expect(() => user.setPasswordResetToken('token123', expiresAt)).toThrow('must be in the future');
    });

    it('should validate token expiration', () => {
      const props = createValidUserProps();
      props.passwordResetToken = 'token123';
      props.passwordResetExpires = new Date(Date.now() + 3600000);
      const user = User.create(props);

      expect(user.isPasswordResetTokenValid()).toBe(true);
    });

    it('should invalidate expired token', () => {
      const props = createValidUserProps();
      props.passwordResetToken = 'token123';
      props.passwordResetExpires = new Date(Date.now() - 1000);
      const user = User.create(props);

      expect(user.isPasswordResetTokenValid()).toBe(false);
    });

    it('should clear password reset token', () => {
      const props = createValidUserProps();
      props.passwordResetToken = 'token123';
      props.passwordResetExpires = new Date(Date.now() + 3600000);
      const user = User.create(props);

      user.clearPasswordResetToken();

      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
    });
  });

  describe('recordLogin', () => {
    it('should record login timestamp', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const beforeLogin = new Date();
      user.recordLogin();
      const afterLogin = new Date();

      expect(user.lastLogin).toBeDefined();
      expect(user.lastLogin!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
      expect(user.lastLogin!.getTime()).toBeLessThanOrEqual(afterLogin.getTime());
    });
  });

  describe('soft delete and restore', () => {
    it('should soft delete user', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      user.softDelete();

      expect(user.isDeleted()).toBe(true);
      expect(user.deletedAt).toBeDefined();
    });

    it('should throw error when deleting already deleted user', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      user.softDelete();

      expect(() => user.softDelete()).toThrow('already deleted');
    });

    it('should restore deleted user', () => {
      const props = createValidUserProps();
      props.deletedAt = new Date();
      const user = User.create(props);

      user.restore();

      expect(user.isDeleted()).toBe(false);
      expect(user.deletedAt).toBeUndefined();
    });

    it('should throw error when restoring non-deleted user', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      expect(() => user.restore()).toThrow('not deleted');
    });
  });

  describe('toPersistence', () => {
    it('should convert to persistence format', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const persistence = user.toPersistence();

      expect(persistence.id).toBe(props.id);
      expect(persistence.email).toBe('test@example.com');
      expect(persistence.passwordHash).toBe(props.passwordHash);
      expect(persistence.role).toBe('student');
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON without sensitive data', () => {
      const props = createValidUserProps();
      const user = User.create(props);

      const json = user.toJSON();

      expect(json.id).toBe(props.id);
      expect(json.email).toBe('test@example.com');
      expect(json.role).toBe('student');
      expect((json as any).passwordHash).toBeUndefined();
      expect((json as any).verificationToken).toBeUndefined();
      expect((json as any).passwordResetToken).toBeUndefined();
    });
  });
});
