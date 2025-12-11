/**
 * File Upload Security Service Tests
 * 
 * Tests for comprehensive file upload security validation including
 * type validation, size validation, content validation, and malware scanning.
 * 
 * Requirements: 13.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileUploadSecurityService } from '../FileUploadSecurityService.js';

describe('FileUploadSecurityService', () => {
  let service: FileUploadSecurityService;

  beforeEach(() => {
    service = new FileUploadSecurityService();
  });

  describe('validateFileUpload', () => {
    it('should validate a valid image file', async () => {
      // Create a simple PNG buffer (minimal PNG header)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, etc.
        0x90, 0x77, 0x53, 0xDE, // CRC
      ]);

      const result = await service.validateFileUpload({
        fileName: 'test.png',
        fileBuffer: pngBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.detectedMimeType).toBe('image/png');
      expect(result.sanitizedFileName).toBe('test.png');
      expect(result.uniqueFileName).toMatch(/^test_\d+_[a-f0-9]{8}_[a-f0-9]{8}\.png$/);
      expect(result.fileHash).toBeDefined();
    });

    it('should reject file with invalid type', async () => {
      const textBuffer = Buffer.from('This is a text file');

      const result = await service.validateFileUpload({
        fileName: 'test.txt',
        fileBuffer: textBuffer,
        declaredMimeType: 'text/plain',
        context: 'avatar', // Avatar only allows images
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "File type 'text/plain' is not allowed. Allowed types: image/jpeg, image/jpg, image/png, image/gif, image/webp"
      );
    });

    it('should reject file that is too large', async () => {
      // Create a buffer larger than avatar limit (5MB)
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const result = await service.validateFileUpload({
        fileName: 'large.png',
        fileBuffer: largeBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should reject empty file', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const result = await service.validateFileUpload({
        fileName: 'empty.png',
        fileBuffer: emptyBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File cannot be empty');
    });

    it('should sanitize dangerous file names', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x90, 0x77, 0x53, 0xDE,
      ]);

      const result = await service.validateFileUpload({
        fileName: '../../../etc/passwd<script>alert("xss")</script>.png',
        fileBuffer: pngBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(result.valid).toBe(true);
      // The sanitization should remove dangerous characters and path traversal
      expect(result.sanitizedFileName).toBe('script_.png');
      expect(result.uniqueFileName).toMatch(/^script__\d+_[a-f0-9]{8}_[a-f0-9]{8}\.png$/);
    });

    it('should detect MIME type mismatch', async () => {
      // Create a text buffer but declare it as PNG
      const textBuffer = Buffer.from('This is actually a text file, not a PNG');

      const result = await service.validateFileUpload({
        fileName: 'fake.png',
        fileBuffer: textBuffer,
        declaredMimeType: 'image/png',
        context: 'document', // Document allows both text and images
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.detectedMimeType).toBe('text/plain');
      expect(result.errors.some(error => 
        error.includes('File content does not match declared type')
      )).toBe(true);
    });

    it('should handle different upload contexts', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n'); // Simple PDF header

      // Should work for document context
      const documentResult = await service.validateFileUpload({
        fileName: 'test.pdf',
        fileBuffer: pdfBuffer,
        declaredMimeType: 'application/pdf',
        context: 'document',
        userId: 'user-123',
      });

      expect(documentResult.valid).toBe(true);

      // Should fail for avatar context (only allows images)
      const avatarResult = await service.validateFileUpload({
        fileName: 'test.pdf',
        fileBuffer: pdfBuffer,
        declaredMimeType: 'application/pdf',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(avatarResult.valid).toBe(false);
    });

    it('should generate unique file names', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x90, 0x77, 0x53, 0xDE,
      ]);

      const result1 = await service.validateFileUpload({
        fileName: 'test.png',
        fileBuffer: pngBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      const result2 = await service.validateFileUpload({
        fileName: 'test.png',
        fileBuffer: pngBuffer,
        declaredMimeType: 'image/png',
        context: 'avatar',
        userId: 'user-123',
      });

      expect(result1.uniqueFileName).not.toBe(result2.uniqueFileName);
      expect(result1.uniqueFileName).toMatch(/^test_\d+_[a-f0-9]{8}_[a-f0-9]{8}\.png$/);
      expect(result2.uniqueFileName).toMatch(/^test_\d+_[a-f0-9]{8}_[a-f0-9]{8}\.png$/);
    });

    it('should detect EICAR test malware signature', async () => {
      const eicarBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      const result = await service.validateFileUpload({
        fileName: 'eicar.txt',
        fileBuffer: eicarBuffer,
        declaredMimeType: 'text/plain',
        context: 'document',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Malware detected'))).toBe(true);
    });

    it('should detect suspicious executable patterns', async () => {
      // Create a buffer that looks like a PE executable
      const peBuffer = Buffer.alloc(128);
      peBuffer.write('MZ', 0); // DOS header
      peBuffer.writeUInt32LE(64, 60); // PE offset
      peBuffer.write('PE', 64); // PE header

      const result = await service.validateFileUpload({
        fileName: 'innocent.txt',
        fileBuffer: peBuffer,
        declaredMimeType: 'text/plain',
        context: 'document',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Malware detected'))).toBe(true);
    });

    it('should detect script injection patterns', async () => {
      const scriptBuffer = Buffer.from('<script>alert("xss")</script>');

      const result = await service.validateFileUpload({
        fileName: 'innocent.txt',
        fileBuffer: scriptBuffer,
        declaredMimeType: 'text/plain',
        context: 'document',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Malware detected'))).toBe(true);
    });

    it('should detect suspicious file size patterns', async () => {
      const tinyBuffer = Buffer.alloc(5); // Very small file

      const result = await service.validateFileUpload({
        fileName: 'tiny.txt',
        fileBuffer: tinyBuffer,
        declaredMimeType: 'text/plain',
        context: 'document',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Malware detected'))).toBe(true);
    });

    it('should detect excessive null byte padding', async () => {
      const paddedBuffer = Buffer.alloc(2048);
      paddedBuffer.fill(0); // Fill with null bytes
      paddedBuffer.write('some content', 0); // Add minimal content

      const result = await service.validateFileUpload({
        fileName: 'padded.txt',
        fileBuffer: paddedBuffer,
        declaredMimeType: 'text/plain',
        context: 'document',
        userId: 'user-123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Malware detected'))).toBe(true);
    });
  });

  describe('getAllowedFileTypes', () => {
    it('should return correct allowed types for each context', () => {
      expect(service.getAllowedFileTypes('avatar')).toEqual([
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
      ]);

      expect(service.getAllowedFileTypes('video_content')).toEqual([
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'
      ]);

      expect(service.getAllowedFileTypes('document')).toContain('application/pdf');
    });
  });

  describe('getMaxFileSize', () => {
    it('should return correct max sizes for each context', () => {
      expect(service.getMaxFileSize('avatar')).toBe(5 * 1024 * 1024); // 5MB
      expect(service.getMaxFileSize('video_content')).toBe(500 * 1024 * 1024); // 500MB
      expect(service.getMaxFileSize('assignment_submission')).toBe(25 * 1024 * 1024); // 25MB
    });
  });
});