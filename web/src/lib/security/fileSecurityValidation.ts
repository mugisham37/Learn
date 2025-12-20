/**
 * File Security Validation Utilities
 * 
 * Comprehensive file security validation for upload operations.
 * Provides file type validation, content validation, and malware scanning.
 * 
 * Requirements: 13.4
 */

import type {
  FileSecurityValidation,
  FileValidationResult,
  MalwareValidationResult,
  SecureUploadOptions,
  SecurityEvent,
} from './securityTypes';
import { securityConfig, SECURITY_CONSTANTS, ENVIRONMENT_SECURITY } from './securityConfig';

/**
 * File type validation utilities
 */
export class FileTypeValidator {
  /**
   * Validate file type based on extension and MIME type
   */
  static validateFileType(file: File, allowedTypes?: string[]): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const allowedMimeTypes = allowedTypes || securityConfig.fileUpload.allowedMimeTypes;

    // Check file size
    if (file.size > securityConfig.fileUpload.maxFileSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${securityConfig.fileUpload.maxFileSize} bytes`);
    }

    // Check file name length
    if (file.name.length > SECURITY_CONSTANTS.MAX_FILE_NAME_LENGTH) {
      errors.push(`File name exceeds maximum length of ${SECURITY_CONSTANTS.MAX_FILE_NAME_LENGTH} characters`);
    }

    // Check for suspicious file extensions
    const extension = this.getFileExtension(file.name);
    const suspiciousExtensions = SECURITY_CONSTANTS.SUSPICIOUS_EXTENSIONS as readonly string[];
    if (suspiciousExtensions.includes(extension.toLowerCase())) {
      errors.push(`File extension '${extension}' is not allowed for security reasons`);
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`);
    }

    // Validate file name for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /[<>:"|?*]/,  // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Windows reserved names
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.name)) {
        errors.push(`File name contains suspicious patterns`);
        break;
      }
    }

    // Check for null bytes
    if (file.name.includes('\0')) {
      errors.push('File name contains null bytes');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileType: file.type,
      actualMimeType: file.type,
    };
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.slice(lastDotIndex + 1) : '';
  }

  /**
   * Detect actual MIME type from file content
   */
  static async detectMimeType(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          resolve(file.type);
          return;
        }

        const uint8Array = new Uint8Array(arrayBuffer);
        const mimeType = this.getMimeTypeFromSignature(uint8Array);
        resolve(mimeType || file.type);
      };

      reader.onerror = () => resolve(file.type);
      
      // Read first 512 bytes for signature detection
      const blob = file.slice(0, 512);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Get MIME type from file signature (magic numbers)
   */
  private static getMimeTypeFromSignature(bytes: Uint8Array): string | null {
    // Common file signatures
    const signatures: Array<{ signature: number[]; mimeType: string }> = [
      // Images
      { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg' },
      { signature: [0x89, 0x50, 0x4E, 0x47], mimeType: 'image/png' },
      { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif' },
      { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp' }, // RIFF (WebP container)
      
      // Videos
      { signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4' },
      { signature: [0x1A, 0x45, 0xDF, 0xA3], mimeType: 'video/webm' },
      
      // Documents
      { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf' },
      { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip' }, // Also used by Office docs
      { signature: [0xD0, 0xCF, 0x11, 0xE0], mimeType: 'application/msword' },
      
      // Archives
      { signature: [0x50, 0x4B, 0x05, 0x06], mimeType: 'application/zip' },
      { signature: [0x50, 0x4B, 0x07, 0x08], mimeType: 'application/zip' },
      { signature: [0x1F, 0x8B, 0x08], mimeType: 'application/gzip' },
      
      // Executables (dangerous)
      { signature: [0x4D, 0x5A], mimeType: 'application/x-msdownload' }, // PE executable
      { signature: [0x7F, 0x45, 0x4C, 0x46], mimeType: 'application/x-executable' }, // ELF
    ];

    for (const { signature, mimeType } of signatures) {
      if (this.matchesSignature(bytes, signature)) {
        return mimeType;
      }
    }

    return null;
  }

  /**
   * Check if bytes match a signature
   */
  private static matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
    if (bytes.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * File content validation utilities
 */
export class FileContentValidator {
  /**
   * Validate file content for security issues
   */
  static async validateContent(file: File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Detect actual MIME type
      const actualMimeType = await FileTypeValidator.detectMimeType(file);
      
      // Check if declared type matches actual type
      if (file.type !== actualMimeType && actualMimeType) {
        warnings.push(`Declared MIME type '${file.type}' doesn't match detected type '${actualMimeType}'`);
      }

      // Check for executable files disguised as other types
      if (this.isExecutableType(actualMimeType)) {
        errors.push('Executable files are not allowed');
      }

      // Validate specific file types
      if (file.type.startsWith('image/')) {
        const imageValidation = await this.validateImageContent(file);
        errors.push(...imageValidation.errors);
        warnings.push(...imageValidation.warnings);
      } else if (file.type.startsWith('text/')) {
        const textValidation = await this.validateTextContent(file);
        errors.push(...textValidation.errors);
        warnings.push(...textValidation.warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        fileType: file.type,
        actualMimeType,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
        fileType: file.type,
      };
    }
  }

  /**
   * Check if MIME type represents an executable file
   */
  private static isExecutableType(mimeType: string): boolean {
    const executableTypes = [
      'application/x-msdownload',
      'application/x-executable',
      'application/x-mach-binary',
      'application/x-dosexec',
      'application/java-archive',
      'application/x-java-archive',
    ];

    return executableTypes.includes(mimeType);
  }

  /**
   * Validate image file content
   */
  private static async validateImageContent(file: File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Create image element to validate
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Check image dimensions
          if (img.width > 10000 || img.height > 10000) {
            warnings.push('Image dimensions are very large');
          }

          // Check for suspicious aspect ratios (potential steganography)
          const aspectRatio = img.width / img.height;
          if (aspectRatio > 100 || aspectRatio < 0.01) {
            warnings.push('Unusual image aspect ratio detected');
          }

          URL.revokeObjectURL(url);
          resolve();
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Invalid image file'));
        };

        img.src = url;
      });

      // Check file size vs expected size for image type
      const expectedMinSize = this.getExpectedImageSize(file.type, img.width, img.height);
      if (file.size < expectedMinSize) {
        warnings.push('File size is smaller than expected for image dimensions');
      }

    } catch (error) {
      errors.push(`Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileType: file.type,
    };
  }

  /**
   * Get expected minimum size for image
   */
  private static getExpectedImageSize(mimeType: string, width: number, height: number): number {
    const pixels = width * height;
    
    switch (mimeType) {
      case 'image/png':
        return Math.max(pixels * 0.1, 100); // PNG can be very compressed
      case 'image/jpeg':
        return Math.max(pixels * 0.05, 100); // JPEG is highly compressed
      case 'image/gif':
        return Math.max(pixels * 0.2, 100); // GIF less compressed
      default:
        return 100; // Minimum reasonable size
    }
  }

  /**
   * Validate text file content
   */
  private static async validateTextContent(file: File): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const text = await this.readFileAsText(file);
      
      // Check for suspicious content patterns
      const suspiciousPatterns = [
        /<script[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /<iframe[\s\S]*?>/gi,
        /<object[\s\S]*?>/gi,
        /<embed[\s\S]*?>/gi,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(text)) {
          warnings.push('Text content contains potentially dangerous patterns');
          break;
        }
      }

      // Check for binary content in text files
      if (this.containsBinaryContent(text)) {
        errors.push('Text file contains binary content');
      }

      // Check for excessively long lines (potential buffer overflow attempts)
      const lines = text.split('\n');
      const maxLineLength = 10000;
      if (lines.some(line => line.length > maxLineLength)) {
        warnings.push('Text file contains very long lines');
      }

    } catch {
      errors.push('Text validation failed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileType: file.type,
    };
  }

  /**
   * Read file as text
   */
  private static async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target?.result as string || '');
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file as text'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Check if text contains binary content
   */
  private static containsBinaryContent(text: string): boolean {
    // Check for null bytes and other control characters
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      // Allow common control characters (tab, newline, carriage return)
      if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Malware scanning utilities (client-side heuristics)
 */
export class MalwareScanner {
  /**
   * Perform basic malware scanning using heuristics
   */
  static async scanFile(file: File): Promise<MalwareValidationResult> {
    const startTime = Date.now();
    const threats: string[] = [];
    let confidence = 0;

    try {
      // Check file extension
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const suspiciousExtensions = SECURITY_CONSTANTS.SUSPICIOUS_EXTENSIONS as readonly string[];
      if (suspiciousExtensions.includes(extension)) {
        threats.push(`Suspicious file extension: ${extension}`);
        confidence += 0.8;
      }

      // Check file size anomalies
      if (file.size === 0) {
        threats.push('Empty file detected');
        confidence += 0.3;
      } else if (file.size > 500 * 1024 * 1024) { // 500MB
        threats.push('Unusually large file size');
        confidence += 0.2;
      }

      // Check MIME type vs extension mismatch
      const actualMimeType = await FileTypeValidator.detectMimeType(file);
      const expectedMimeType = this.getExpectedMimeType(extension);
      if (expectedMimeType && actualMimeType && actualMimeType !== expectedMimeType && actualMimeType !== file.type) {
        threats.push('MIME type mismatch detected');
        confidence += 0.6;
      }

      // Scan file content for suspicious patterns
      const contentThreats = await this.scanFileContent(file);
      threats.push(...contentThreats.threats);
      confidence += contentThreats.confidence;

      // Normalize confidence score
      confidence = Math.min(confidence, 1.0);

      const scanTime = Date.now() - startTime;
      const safe = confidence < 0.5 && threats.length === 0;

      // Log scan results
      this.logScanResult(file, safe, threats, confidence, scanTime);

      return {
        safe,
        threats,
        confidence,
        scanTime,
      };
    } catch (error) {
      console.error('Malware scan failed:', error);
      return {
        safe: false,
        threats: ['Scan failed'],
        confidence: 1.0,
        scanTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get expected MIME type for file extension
   */
  private static getExpectedMimeType(extension: string): string | null {
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'zip': 'application/zip',
    };

    return mimeMap[extension] || null;
  }

  /**
   * Scan file content for suspicious patterns
   */
  private static async scanFileContent(file: File): Promise<{ threats: string[]; confidence: number }> {
    const threats: string[] = [];
    let confidence = 0;

    try {
      // Read first 1KB for pattern matching
      const blob = file.slice(0, 1024);
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Check for executable signatures
      const executableSignatures = [
        [0x4D, 0x5A], // PE executable
        [0x7F, 0x45, 0x4C, 0x46], // ELF
        [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O
        [0xFE, 0xED, 0xFA, 0xCE], // Mach-O
      ];

      for (const signature of executableSignatures) {
        if (this.bytesStartWith(bytes, signature)) {
          threats.push('Executable file signature detected');
          confidence += 0.9;
          break;
        }
      }

      // Check for script content in non-script files
      if (!file.type.includes('script') && !file.type.includes('javascript')) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const scriptPatterns = [
          /eval\s*\(/gi,
          /document\.write/gi,
          /window\.location/gi,
          /XMLHttpRequest/gi,
          /<script/gi,
        ];

        for (const pattern of scriptPatterns) {
          if (pattern.test(text)) {
            threats.push('Script content detected in non-script file');
            confidence += 0.4;
            break;
          }
        }
      }

      // Check for polyglot files (files that are valid in multiple formats)
      if (this.isPolyglotFile(bytes)) {
        threats.push('Polyglot file detected');
        confidence += 0.7;
      }

    } catch {
      // Ignore decoding errors for binary files
    }

    return { threats, confidence };
  }

  /**
   * Check if bytes start with a specific pattern
   */
  private static bytesStartWith(bytes: Uint8Array, pattern: number[]): boolean {
    if (bytes.length < pattern.length) {
      return false;
    }

    for (let i = 0; i < pattern.length; i++) {
      if (bytes[i] !== pattern[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if file appears to be a polyglot (valid in multiple formats)
   */
  private static isPolyglotFile(bytes: Uint8Array): boolean {
    // Simple heuristic: check if file starts with multiple format signatures
    const signatures = [
      [0xFF, 0xD8, 0xFF], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x25, 0x50, 0x44, 0x46], // PDF
      [0x50, 0x4B, 0x03, 0x04], // ZIP
    ];

    let matchCount = 0;
    for (const signature of signatures) {
      if (this.bytesStartWith(bytes, signature)) {
        matchCount++;
      }
    }

    return matchCount > 1;
  }

  /**
   * Log scan result
   */
  private static logScanResult(
    file: File,
    safe: boolean,
    threats: string[],
    confidence: number,
    scanTime: number
  ): void {
    const event: SecurityEvent = {
      type: 'malicious_file',
      timestamp: new Date(),
      details: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        safe,
        threats,
        confidence,
        scanTime,
      },
      severity: safe ? 'low' : 'high',
    };

    if (ENVIRONMENT_SECURITY.logSecurityEvents) {
      console.log('Malware Scan Result:', event);
    }

    if (!safe && ENVIRONMENT_SECURITY.enableSecurityLogging) {
      console.warn('Potential malware detected:', event);
    }
  }
}

/**
 * Comprehensive file security validation
 */
export class FileSecurityValidator implements FileSecurityValidation {
  private readonly options: SecureUploadOptions;

  constructor(options?: Partial<SecureUploadOptions>) {
    this.options = {
      maxFileSize: securityConfig.fileUpload.maxFileSize,
      allowedMimeTypes: securityConfig.fileUpload.allowedMimeTypes,
      allowedExtensions: [],
      requireContentValidation: securityConfig.fileUpload.requireContentValidation,
      requireMalwareScan: securityConfig.fileUpload.requireMalwareScan,
      customValidators: [],
      ...options,
    };
  }

  /**
   * Validate file type
   */
  async validateFileType(file: File): Promise<FileValidationResult> {
    return FileTypeValidator.validateFileType(file, this.options.allowedMimeTypes);
  }

  /**
   * Validate file content
   */
  async validateFileContent(file: File): Promise<FileValidationResult> {
    if (!this.options.requireContentValidation) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        fileType: file.type,
      };
    }

    const result = await FileContentValidator.validateContent(file);

    // Run custom validators
    for (const validator of this.options.customValidators || []) {
      const customResult = await validator.validate(file);
      result.errors.push(...customResult.errors);
      result.warnings.push(...customResult.warnings);
      result.valid = result.valid && customResult.valid;
    }

    return result;
  }

  /**
   * Scan for malware
   */
  async scanForMalware(file: File): Promise<MalwareValidationResult> {
    if (!this.options.requireMalwareScan) {
      return {
        safe: true,
        threats: [],
        confidence: 0,
        scanTime: 0,
      };
    }

    return await MalwareScanner.scanFile(file);
  }

  /**
   * Comprehensive file validation
   */
  async validateFile(file: File): Promise<{
    typeValidation: FileValidationResult;
    contentValidation: FileValidationResult;
    malwareScan: MalwareValidationResult;
    overallValid: boolean;
  }> {
    const [typeValidation, contentValidation, malwareScan] = await Promise.all([
      this.validateFileType(file),
      this.validateFileContent(file),
      this.scanForMalware(file),
    ]);

    const overallValid = typeValidation.valid && contentValidation.valid && malwareScan.safe;

    return {
      typeValidation,
      contentValidation,
      malwareScan,
      overallValid,
    };
  }
}

// Export singleton instances and utilities
export const fileTypeValidator = FileTypeValidator;
export const fileContentValidator = FileContentValidator;
export const malwareScanner = MalwareScanner;
export const fileSecurityValidator = new FileSecurityValidator();

// Convenience functions
export const validateFileType = FileTypeValidator.validateFileType;
export const validateFileContent = FileContentValidator.validateContent;
export const scanFileForMalware = MalwareScanner.scanFile;
export const createFileValidator = (options?: Partial<SecureUploadOptions>) => new FileSecurityValidator(options);