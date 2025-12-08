/**
 * Authentication Utilities
 * 
 * Provides JWT token generation/verification, password hashing,
 * and cryptographic token generation for authentication flows.
 * 
 * Requirements: 1.4, 1.6
 */

import crypto from 'crypto';

import { config } from '@config/index.js';
import bcrypt from 'bcrypt';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'student' | 'educator' | 'admin';
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Token generation result
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Token verification result
 */
export interface VerifiedToken {
  payload: JWTPayload;
  expired: boolean;
}

/**
 * Bcrypt cost factor for password hashing
 * Higher values = more secure but slower
 */
const BCRYPT_ROUNDS = 12;

/**
 * Generates a JWT access token with 15-minute expiration
 * 
 * @param userId - User's unique identifier
 * @param email - User's email address
 * @param role - User's role (student, educator, admin)
 * @returns JWT access token string
 */
export function generateAccessToken(
  userId: string,
  email: string,
  role: 'student' | 'educator' | 'admin'
): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'access',
  };

  const expiresIn = parseExpiry(config.jwt.accessTokenExpiry);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({ ...payload, iat, exp }));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`, config.jwt.secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generates a JWT refresh token with 30-day expiration
 * 
 * @param userId - User's unique identifier
 * @param email - User's email address
 * @param role - User's role (student, educator, admin)
 * @returns JWT refresh token string
 */
export function generateRefreshToken(
  userId: string,
  email: string,
  role: 'student' | 'educator' | 'admin'
): string {
  const payload: JWTPayload = {
    userId,
    email,
    role,
    type: 'refresh',
  };

  const expiresIn = parseExpiry(config.jwt.refreshTokenExpiry);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({ ...payload, iat, exp }));
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`, config.jwt.secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generates both access and refresh tokens
 * 
 * @param userId - User's unique identifier
 * @param email - User's email address
 * @param role - User's role (student, educator, admin)
 * @returns Object containing both access and refresh tokens
 */
export function generateTokenPair(
  userId: string,
  email: string,
  role: 'student' | 'educator' | 'admin'
): TokenPair {
  return {
    accessToken: generateAccessToken(userId, email, role),
    refreshToken: generateRefreshToken(userId, email, role),
  };
}

/**
 * Verifies and decodes a JWT token
 * 
 * @param token - JWT token string to verify
 * @returns Verified token with payload and expiration status
 * @throws Error if token is invalid or malformed
 */
export function verifyToken(token: string): VerifiedToken {
  const parts = token.split('.');
  
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  
  // Verify signature
  const expectedSignature = createSignature(
    `${encodedHeader}.${encodedPayload}`,
    config.jwt.secret
  );

  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  const expired = payload.exp !== undefined ? payload.exp < now : false;

  return {
    payload,
    expired,
  };
}

/**
 * Decodes a JWT token without verification (use with caution)
 * 
 * @param token - JWT token string to decode
 * @returns Decoded JWT payload
 * @throws Error if token is malformed
 */
export function decodeToken(token: string): JWTPayload {
  const parts = token.split('.');
  
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [, encodedPayload] = parts as [string, string, string];
  return JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;
}

/**
 * Checks if a token is expired
 * 
 * @param token - JWT token string to check
 * @returns True if token is expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  try {
    const { expired } = verifyToken(token);
    return expired;
  } catch {
    return true;
  }
}

/**
 * Hashes a password using bcrypt with cost factor 12
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a bcrypt hash
 * 
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a cryptographically secure random token
 * Used for email verification, password reset, etc.
 * 
 * @param length - Length of token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateVerificationToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generates a cryptographically secure random string
 * 
 * @param length - Length of string in bytes (default: 32)
 * @returns Base64-encoded random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Helper: Base64 URL-safe encoding
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Helper: Base64 URL-safe decoding
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Helper: Creates HMAC-SHA256 signature
 */
function createSignature(data: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
}

/**
 * Helper: Parses expiry string to seconds
 * Supports formats like '15m', '30d', '1h'
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Invalid expiry unit: ${unit}`);
  }
}
