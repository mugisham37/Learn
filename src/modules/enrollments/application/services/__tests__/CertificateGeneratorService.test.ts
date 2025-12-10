/**
 * Certificate Generator Service Tests
 * 
 * Tests for certificate generation functionality including PDF creation,
 * S3 upload, and verification URL generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CertificateGeneratorService } from '../CertificateGeneratorService.js';
import { IS3Service } from '../../../../../shared/services/IS3Service.js';
import { Certificate } from '../../../domain/entities/Certificate.js';
import { Enrollment } from '../../../domain/entities/Enrollment.js';
import { ValidationError, ExternalServiceError } from '../../../../../shared/errors/index.js';

describe('CertificateGeneratorService', () => {
  let certificateGeneratorService: CertificateGeneratorService;
  let mockS3Service: IS3Service;

  beforeEach(() => {
    vi.clearAllMocks();

    mockS3Service = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      generatePresignedUrl: vi.fn(),
      fileExists: vi.fn(),
      getPublicUrl: vi.fn(),
    };

    certificateGeneratorService = new CertificateGeneratorService(mockS3Service);
  });

  describe('generateCertificate', () => {
    it('should generate certificate successfully for completed enrollment', async () => {
      // Arrange
      const enrollment = Enrollment.fromDatabase({
        id: 'enrollment-123',
        studentId: 'student-123',
        courseId: 'course-123',
        enrolledAt: new Date('2024-01-01'),
        completedAt: new Date('2024-02-01'),
        progressPercentage: 100,
        lastAccessedAt: new Date('2024-02-01'),
        paymentId: undefined,
        certificateId: undefined,
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01')
      });

      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Advanced TypeScript',
        instructorName: 'Jane Smith',
        completionDate: new Date('2024-02-01'),
        grade: 'A',
        creditsEarned: 3
      };

      const mockUploadResult = {
        key: 'certificates/CERT-123.pdf',
        url: 'https://s3.amazonaws.com/bucket/certificates/CERT-123.pdf',
        etag: 'mock-etag'
      };

      vi.mocked(mockS3Service.uploadFile).mockResolvedValue(mockUploadResult);

      // Act
      const result = await certificateGeneratorService.generateCertificate(enrollment, certificateData);

      // Assert
      expect(result).toBeInstanceOf(Certificate);
      expect(result.enrollmentId).toBe(enrollment.id);
      expect(result.getStudentName()).toBe(certificateData.studentName);
      expect(result.getCourseTitle()).toBe(certificateData.courseTitle);
      expect(result.getInstructorName()).toBe(certificateData.instructorName);
      expect(result.getGrade()).toBe(certificateData.grade);
      expect(result.getCreditsEarned()).toBe(certificateData.creditsEarned);
      expect(result.pdfUrl).toBe(mockUploadResult.url);
      expect(result.isReadyForDelivery()).toBe(true);

      expect(mockS3Service.uploadFile).toHaveBeenCalledWith({
        key: expect.stringMatching(/^certificates\/CERT-.*\.pdf$/),
        buffer: expect.any(Buffer),
        contentType: 'application/pdf',
        metadata: {
          certificateId: result.certificateId,
          uploadedAt: expect.any(String),
          contentType: 'certificate'
        }
      });
    });

    it('should throw ValidationError for non-completed enrollment', async () => {
      // Arrange
      const enrollment = Enrollment.fromDatabase({
        id: 'enrollment-123',
        studentId: 'student-123',
        courseId: 'course-123',
        enrolledAt: new Date('2024-01-01'),
        completedAt: undefined,
        progressPercentage: 80,
        lastAccessedAt: new Date('2024-01-15'),
        paymentId: undefined,
        certificateId: undefined,
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      });

      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Advanced TypeScript',
        instructorName: 'Jane Smith',
        completionDate: new Date('2024-02-01')
      };

      // Act & Assert
      await expect(
        certificateGeneratorService.generateCertificate(enrollment, certificateData)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for enrollment with less than 100% progress', async () => {
      // Arrange
      const enrollment = Enrollment.fromDatabase({
        id: 'enrollment-123',
        studentId: 'student-123',
        courseId: 'course-123',
        enrolledAt: new Date('2024-01-01'),
        completedAt: new Date('2024-02-01'),
        progressPercentage: 95,
        lastAccessedAt: new Date('2024-02-01'),
        paymentId: undefined,
        certificateId: undefined,
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01')
      });

      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Advanced TypeScript',
        instructorName: 'Jane Smith',
        completionDate: new Date('2024-02-01')
      };

      // Act & Assert
      await expect(
        certificateGeneratorService.generateCertificate(enrollment, certificateData)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ExternalServiceError when S3 upload fails', async () => {
      // Arrange
      const enrollment = Enrollment.fromDatabase({
        id: 'enrollment-123',
        studentId: 'student-123',
        courseId: 'course-123',
        enrolledAt: new Date('2024-01-01'),
        completedAt: new Date('2024-02-01'),
        progressPercentage: 100,
        lastAccessedAt: new Date('2024-02-01'),
        paymentId: undefined,
        certificateId: undefined,
        status: 'completed',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-02-01')
      });

      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Advanced TypeScript',
        instructorName: 'Jane Smith',
        completionDate: new Date('2024-02-01')
      };

      vi.mocked(mockS3Service.uploadFile).mockRejectedValue(
        new Error('S3 upload failed')
      );

      // Act & Assert
      await expect(
        certificateGeneratorService.generateCertificate(enrollment, certificateData)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('createPDF', () => {
    it('should create PDF buffer for certificate', async () => {
      // Arrange
      const certificate = Certificate.create({
        enrollmentId: 'enrollment-123',
        studentId: 'student-123',
        courseId: 'course-123',
        studentName: 'John Doe',
        courseTitle: 'Advanced TypeScript',
        instructorName: 'Jane Smith',
        completionDate: new Date('2024-02-01'),
        grade: 'A',
        creditsEarned: 3
      });

      // Act
      const result = await certificateGeneratorService.createPDF(certificate);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that it's a valid PDF by checking PDF header
      const pdfHeader = result.subarray(0, 4).toString();
      expect(pdfHeader).toBe('%PDF');
    });
  });

  describe('uploadToS3', () => {
    it('should upload PDF to S3 successfully', async () => {
      // Arrange
      const pdfBuffer = Buffer.from('mock-pdf-content');
      const certificateId = 'CERT-123';
      const mockUploadResult = {
        key: 'certificates/CERT-123.pdf',
        url: 'https://s3.amazonaws.com/bucket/certificates/CERT-123.pdf',
        etag: 'mock-etag'
      };

      vi.mocked(mockS3Service.uploadFile).mockResolvedValue(mockUploadResult);

      // Act
      const result = await certificateGeneratorService.uploadToS3(pdfBuffer, certificateId);

      // Assert
      expect(result).toBe(mockUploadResult.url);
      expect(mockS3Service.uploadFile).toHaveBeenCalledWith({
        key: 'certificates/CERT-123.pdf',
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        metadata: {
          certificateId,
          uploadedAt: expect.any(String),
          contentType: 'certificate'
        }
      });
    });

    it('should throw ExternalServiceError when S3 upload fails', async () => {
      // Arrange
      const pdfBuffer = Buffer.from('mock-pdf-content');
      const certificateId = 'CERT-123';

      vi.mocked(mockS3Service.uploadFile).mockRejectedValue(
        new Error('S3 upload failed')
      );

      // Act & Assert
      await expect(
        certificateGeneratorService.uploadToS3(pdfBuffer, certificateId)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('generateVerificationUrl', () => {
    it('should generate verification URL with certificate ID', () => {
      // Arrange
      const certificateId = 'CERT-123';

      // Act
      const result = certificateGeneratorService.generateVerificationUrl(certificateId);

      // Assert
      expect(result).toBe('https://platform.example.com/certificates/verify/CERT-123');
    });

    it('should use custom base URL from environment', () => {
      // Arrange
      const originalBaseUrl = process.env['APP_BASE_URL'];
      process.env['APP_BASE_URL'] = 'https://custom.example.com';
      
      const service = new CertificateGeneratorService(mockS3Service);
      const certificateId = 'CERT-123';

      // Act
      const result = service.generateVerificationUrl(certificateId);

      // Assert
      expect(result).toBe('https://custom.example.com/certificates/verify/CERT-123');

      // Cleanup
      if (originalBaseUrl) {
        process.env['APP_BASE_URL'] = originalBaseUrl;
      } else {
        delete process.env['APP_BASE_URL'];
      }
    });
  });
});