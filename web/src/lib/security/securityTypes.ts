/**
 * Security Types
 * 
 * Type definitions for security-related functionality.
 */

// =============================================================================
// Token Security Types
// =============================================================================

export interface SecureTokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(accessToken: string, refreshToken: string): Promise<void>;
  clearTokens(): Promise<void>;
  isSecureStorageAvailable(): boolean;
}

export interface TokenEncryption {
  encrypt(data: string): Promise<string>;
  decrypt(encryptedData: string): Promise<string>;
  generateKey(): Promise<CryptoKey>;
}

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  payload?: any;
  error?: string;
}

// =============================================================================
// XSS Protection Types
// =============================================================================

export interface XSSProtectionOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  stripUnknownTags?: boolean;
  stripUnknownAttributes?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  removed: string[];
  warnings: string[];
}

export interface ContentSecurityPolicy {
  directives: Record<string, string[]>;
  reportOnly?: boolean;
}

// =============================================================================
// CSRF Protection Types
// =============================================================================

export interface CSRFTokenManager {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  validateToken(token: string): Promise<boolean>;
}

export interface CSRFRequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  requiresCSRF: boolean;
}

export interface CSRFError extends Error {
  code: 'CSRF_TOKEN_MISSING' | 'CSRF_TOKEN_INVALID' | 'CSRF_TOKEN_EXPIRED';
  retryable: boolean;
}

// =============================================================================
// File Security Types
// =============================================================================

export interface FileSecurityValidation {
  validateFileType(file: File): Promise<FileValidationResult>;
  validateFileContent(file: File): Promise<FileValidationResult>;
  scanForMalware(file: File): Promise<MalwareValidationResult>;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileType?: string;
  actualMimeType?: string;
}

export interface MalwareValidationResult {
  safe: boolean;
  threats: string[];
  confidence: number;
  scanTime: number;
}

export interface SecureUploadOptions {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  requireContentValidation: boolean;
  requireMalwareScan: boolean;
  customValidators?: FileValidator[];
}

export interface FileValidator {
  name: string;
  validate(file: File): Promise<FileValidationResult>;
}

// =============================================================================
// Security Configuration Types
// =============================================================================

export interface SecurityConfig {
  tokenStorage: {
    useEncryption: boolean;
    encryptionAlgorithm: string;
    storageType: 'httpOnly' | 'localStorage' | 'sessionStorage';
    tokenExpirationBuffer: number;
  };
  xssProtection: {
    enabled: boolean;
    strictMode: boolean;
    allowedTags: string[];
    allowedAttributes: Record<string, string[]>;
  };
  csrfProtection: {
    enabled: boolean;
    tokenHeader: string;
    cookieName: string;
    sameSite: 'strict' | 'lax' | 'none';
  };
  fileUpload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    requireContentValidation: boolean;
    requireMalwareScan: boolean;
  };
  contentSecurityPolicy: ContentSecurityPolicy;
}

// =============================================================================
// Security Event Types
// =============================================================================

export interface SecurityEvent {
  type: 'token_refresh' | 'xss_attempt' | 'csrf_violation' | 'malicious_file' | 'security_error';
  timestamp: Date;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  sessionId?: string;
}

export interface SecurityEventHandler {
  handleEvent(event: SecurityEvent): Promise<void>;
}

// =============================================================================
// Security Audit Types
// =============================================================================

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  event: SecurityEvent;
  context: SecurityAuditContext;
}

export interface SecurityAuditContext {
  userAgent: string;
  ipAddress?: string;
  referer?: string;
  requestId?: string;
  userId?: string;
}