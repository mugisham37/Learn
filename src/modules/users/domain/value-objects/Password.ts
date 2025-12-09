/**
 * Password Value Object
 * 
 * Immutable value object representing a validated password.
 * Ensures password strength validation at construction time.
 * 
 * Requirements: 1.3
 */

import { validatePasswordStrength } from '../../../../shared/utils/validation.js';

/**
 * Password value object
 * 
 * Represents a validated password. Once created, the password is guaranteed
 * to meet strength requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export class Password {
  private readonly _value: string;
  private readonly _strength: 'weak' | 'medium' | 'strong';

  /**
   * Creates a new Password value object
   * 
   * @param value - Password string
   * @param strength - Password strength rating
   */
  private constructor(value: string, strength: 'weak' | 'medium' | 'strong') {
    this._value = value;
    this._strength = strength;
  }

  /**
   * Factory method to create a Password value object
   * 
   * @param value - Password string
   * @returns Password value object
   * @throws Error if password doesn't meet strength requirements
   */
  static create(value: string): Password {
    const validation = validatePasswordStrength(value);
    
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    return new Password(value, validation.strength);
  }

  /**
   * Gets the password value
   * 
   * @returns Password string
   */
  get value(): string {
    return this._value;
  }

  /**
   * Gets the password strength rating
   * 
   * @returns Strength rating: 'weak', 'medium', or 'strong'
   */
  get strength(): 'weak' | 'medium' | 'strong' {
    return this._strength;
  }

  /**
   * Checks if password is strong
   * 
   * @returns True if password strength is 'strong'
   */
  isStrong(): boolean {
    return this._strength === 'strong';
  }

  /**
   * Checks equality with another Password value object
   * Note: This compares the actual password values, not hashes
   * 
   * @param other - Another Password value object
   * @returns True if passwords are equal
   */
  equals(other: Password): boolean {
    return this._value === other._value;
  }

  /**
   * Returns string representation (masked for security)
   * 
   * @returns Masked password string
   */
  toString(): string {
    return '********';
  }

  /**
   * Returns JSON representation (masked for security)
   * 
   * @returns Masked password string
   */
  toJSON(): string {
    return '********';
  }
}
