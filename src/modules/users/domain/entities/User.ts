/**
 * User Entity
 * 
 * Core domain entity representing a user in the system.
 * Encapsulates user identity, authentication, and role information.
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { Email } from '../value-objects/Email.js';

/**
 * User role enumeration
 */
export type UserRole = 'student' | 'educator' | 'admin';

/**
 * User entity properties
 */
export interface UserProps {
  id: string;
  email: Email;
  passwordHash: string;
  role: UserRole;
  emailVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * User entity
 * 
 * Represents a user in the system with identity, authentication, and role.
 * Enforces business rules and validation at the domain level.
 */
export class User {
  private readonly _id: string;
  private _email: Email;
  private _passwordHash: string;
  private _role: UserRole;
  private _emailVerified: boolean;
  private _verificationToken?: string;
  private _passwordResetToken?: string;
  private _passwordResetExpires?: Date;
  private _lastLogin?: Date;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt?: Date;

  /**
   * Creates a new User entity
   * 
   * @param props - User properties
   */
  private constructor(props: UserProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._role = props.role;
    this._emailVerified = props.emailVerified;
    this._verificationToken = props.verificationToken;
    this._passwordResetToken = props.passwordResetToken;
    this._passwordResetExpires = props.passwordResetExpires;
    this._lastLogin = props.lastLogin;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._deletedAt = props.deletedAt;
  }

  /**
   * Factory method to create a new User entity
   * 
   * @param props - User properties
   * @returns User entity
   * @throws Error if validation fails
   */
  static create(props: UserProps): User {
    // Validate ID
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('User ID is required');
    }

    // Validate password hash
    if (!props.passwordHash || props.passwordHash.trim().length === 0) {
      throw new Error('Password hash is required');
    }

    // Validate role
    const validRoles: UserRole[] = ['student', 'educator', 'admin'];
    if (!validRoles.includes(props.role)) {
      throw new Error(`Invalid role: ${props.role}. Must be one of: ${validRoles.join(', ')}`);
    }

    // Validate dates
    if (!(props.createdAt instanceof Date) || isNaN(props.createdAt.getTime())) {
      throw new Error('Invalid createdAt date');
    }

    if (!(props.updatedAt instanceof Date) || isNaN(props.updatedAt.getTime())) {
      throw new Error('Invalid updatedAt date');
    }

    // Validate password reset expiration if token exists
    if (props.passwordResetToken && !props.passwordResetExpires) {
      throw new Error('Password reset expiration is required when reset token is present');
    }

    if (props.passwordResetExpires && !(props.passwordResetExpires instanceof Date)) {
      throw new Error('Invalid passwordResetExpires date');
    }

    return new User(props);
  }

  /**
   * Factory method to reconstitute a User entity from persistence
   * 
   * @param props - User properties from database
   * @returns User entity
   */
  static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): UserRole {
    return this._role;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get verificationToken(): string | undefined {
    return this._verificationToken;
  }

  get passwordResetToken(): string | undefined {
    return this._passwordResetToken;
  }

  get passwordResetExpires(): Date | undefined {
    return this._passwordResetExpires;
  }

  get lastLogin(): Date | undefined {
    return this._lastLogin;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this._deletedAt;
  }

  // Business logic methods

  /**
   * Checks if the user is deleted (soft delete)
   * 
   * @returns True if user is deleted
   */
  isDeleted(): boolean {
    return this._deletedAt !== undefined;
  }

  /**
   * Checks if the user is active (not deleted and email verified)
   * 
   * @returns True if user is active
   */
  isActive(): boolean {
    return !this.isDeleted() && this._emailVerified;
  }

  /**
   * Checks if the user has a specific role
   * 
   * @param role - Role to check
   * @returns True if user has the role
   */
  hasRole(role: UserRole): boolean {
    return this._role === role;
  }

  /**
   * Checks if the user has any of the specified roles
   * 
   * @param roles - Roles to check
   * @returns True if user has any of the roles
   */
  hasAnyRole(roles: UserRole[]): boolean {
    return roles.includes(this._role);
  }

  /**
   * Checks if the user is a student
   * 
   * @returns True if user is a student
   */
  isStudent(): boolean {
    return this._role === 'student';
  }

  /**
   * Checks if the user is an educator
   * 
   * @returns True if user is an educator
   */
  isEducator(): boolean {
    return this._role === 'educator';
  }

  /**
   * Checks if the user is an admin
   * 
   * @returns True if user is an admin
   */
  isAdmin(): boolean {
    return this._role === 'admin';
  }

  /**
   * Checks if password reset token is valid (not expired)
   * 
   * @returns True if token is valid
   */
  isPasswordResetTokenValid(): boolean {
    if (!this._passwordResetToken || !this._passwordResetExpires) {
      return false;
    }

    return this._passwordResetExpires > new Date();
  }

  /**
   * Verifies the user's email
   */
  verifyEmail(): void {
    if (this._emailVerified) {
      throw new Error('Email is already verified');
    }

    this._emailVerified = true;
    this._verificationToken = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Updates the user's email
   * 
   * @param email - New email
   */
  updateEmail(email: Email): void {
    if (this._email.equals(email)) {
      return; // No change
    }

    this._email = email;
    this._emailVerified = false; // Require re-verification
    this._updatedAt = new Date();
  }

  /**
   * Updates the user's password hash
   * 
   * @param passwordHash - New password hash
   */
  updatePasswordHash(passwordHash: string): void {
    if (!passwordHash || passwordHash.trim().length === 0) {
      throw new Error('Password hash is required');
    }

    this._passwordHash = passwordHash;
    this._passwordResetToken = undefined;
    this._passwordResetExpires = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Updates the user's role
   * 
   * @param role - New role
   */
  updateRole(role: UserRole): void {
    const validRoles: UserRole[] = ['student', 'educator', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    this._role = role;
    this._updatedAt = new Date();
  }

  /**
   * Sets the verification token
   * 
   * @param token - Verification token
   */
  setVerificationToken(token: string): void {
    if (!token || token.trim().length === 0) {
      throw new Error('Verification token is required');
    }

    this._verificationToken = token;
    this._updatedAt = new Date();
  }

  /**
   * Sets the password reset token and expiration
   * 
   * @param token - Password reset token
   * @param expiresAt - Expiration date
   */
  setPasswordResetToken(token: string, expiresAt: Date): void {
    if (!token || token.trim().length === 0) {
      throw new Error('Password reset token is required');
    }

    if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
      throw new Error('Invalid expiration date');
    }

    if (expiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    this._passwordResetToken = token;
    this._passwordResetExpires = expiresAt;
    this._updatedAt = new Date();
  }

  /**
   * Clears the password reset token
   */
  clearPasswordResetToken(): void {
    this._passwordResetToken = undefined;
    this._passwordResetExpires = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Records a login event
   */
  recordLogin(): void {
    this._lastLogin = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Soft deletes the user
   */
  softDelete(): void {
    if (this.isDeleted()) {
      throw new Error('User is already deleted');
    }

    this._deletedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Restores a soft-deleted user
   */
  restore(): void {
    if (!this.isDeleted()) {
      throw new Error('User is not deleted');
    }

    this._deletedAt = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Converts the entity to a plain object for persistence
   * 
   * @returns Plain object representation
   */
  toPersistence(): {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    emailVerified: boolean;
    verificationToken?: string;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  } {
    return {
      id: this._id,
      email: this._email.value,
      passwordHash: this._passwordHash,
      role: this._role,
      emailVerified: this._emailVerified,
      verificationToken: this._verificationToken,
      passwordResetToken: this._passwordResetToken,
      passwordResetExpires: this._passwordResetExpires,
      lastLogin: this._lastLogin,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt,
    };
  }

  /**
   * Returns JSON representation (excludes sensitive data)
   * 
   * @returns JSON object
   */
  toJSON(): {
    id: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id,
      email: this._email.value,
      role: this._role,
      emailVerified: this._emailVerified,
      lastLogin: this._lastLogin,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
