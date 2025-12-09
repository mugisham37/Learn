/**
 * Email Value Object
 * 
 * Immutable value object representing a validated email address.
 * Ensures email format validation at construction time.
 * 
 * Requirements: 1.1
 */

import { validateEmail } from '../../../../shared/utils/validation.js';

/**
 * Email value object
 * 
 * Represents a validated email address. Once created, the email is guaranteed
 * to be in a valid format according to standard email regex patterns.
 */
export class Email {
  private readonly _value: string;

  /**
   * Creates a new Email value object
   * 
   * @param value - Email address string
   * @throws Error if email format is invalid
   */
  private constructor(value: string) {
    this._value = value.trim().toLowerCase();
  }

  /**
   * Factory method to create an Email value object
   * 
   * @param value - Email address string
   * @returns Email value object
   * @throws Error if email format is invalid
   */
  static create(value: string): Email {
    const validation = validateEmail(value);
    
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid email format');
    }

    return new Email(value);
  }

  /**
   * Gets the email address value
   * 
   * @returns Email address string (normalized to lowercase)
   */
  get value(): string {
    return this._value;
  }

  /**
   * Checks equality with another Email value object
   * 
   * @param other - Another Email value object
   * @returns True if emails are equal (case-insensitive)
   */
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  /**
   * Returns string representation of the email
   * 
   * @returns Email address string
   */
  toString(): string {
    return this._value;
  }

  /**
   * Returns JSON representation of the email
   * 
   * @returns Email address string
   */
  toJSON(): string {
    return this._value;
  }
}
