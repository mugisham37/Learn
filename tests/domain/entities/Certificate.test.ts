/**
 * Certificate Domain Entity Tests
 * 
 * Tests for the Certificate domain entity including certificate generation,
 * metadata management, and verification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Certificate } from '../../../src/modules/enrollments/domain/entities';

describe('Certificate Entity', () => {
  let certificate: Certificate;
  const enrollmentId = 'enrollment-123';
  const studentId = 'student-456';
  const courseId = 'course-789';

  beforeEach(() => {
    certificate = Certificate.create({
      enrollmentId,
      studentId,
      courseId,
      studentName: 'John Doe',
      courseTitle: 'Introduction to Programming',
      instructorName: 'Jane Smith',
      completionDate: new Date('2024-01-15'),
      grade: 'A',
      creditsEarned: 3,
    });
  });

  describe('Creation', () => {
    it('should create certificate with correct properties', () => {
      expect(certificate.enrollmentId).toBe(enrollmentId);
      expect(certificate.certificateId).toMatch(/^CERT-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(certificate.issuedAt).toBeInstanceOf(Date);
      expect(certificate.verificationUrl).toContain(certificate.certificateId);
      expect(certificate.domainEvents).toHaveLength(1);
      expect(certificate.domainEvents[0].eventType).toBe('CertificateGenerated');
    });

    it('should generate unique certificate IDs', () => {
      const certificate2 = Certificate.create({
        enrollmentId: 'enrollment-456',
        studentId: 'student-789',
        courseId: 'course-123',
        studentName: 'Jane Doe',
        courseTitle: 'Advanced Programming',
        instructorName: 'John Smith',
        completionDate: new Date('2024-01-16'),
      });

      expect(certificate.certificateId).not.toBe(certificate2.certificateId);
    });

    it('should create certificate without optional fields', () => {
      const simpleCertificate = Certificate.create({
        enrollmentId: 'enrollment-789',
        studentId: 'student-123',
        courseId: 'course-456',
        studentName: 'Bob Johnson',
        courseTitle: 'Basic Math',
        instructorName: 'Alice Brown',
        completionDate: new Date('2024-01-17'),
      });

      expect(simpleCertificate.getGrade()).toBeUndefined();
      expect(simpleCertificate.getCreditsEarned()).toBeUndefined();
    });
  });

  describe('Metadata Access', () => {
    it('should return correct student name', () => {
      expect(certificate.getStudentName()).toBe('John Doe');
    });

    it('should return correct course title', () => {
      expect(certificate.getCourseTitle()).toBe('Introduction to Programming');
    });

    it('should return correct instructor name', () => {
      expect(certificate.getInstructorName()).toBe('Jane Smith');
    });

    it('should return correct completion date', () => {
      expect(certificate.getCompletionDate()).toEqual(new Date('2024-01-15'));
    });

    it('should return correct grade', () => {
      expect(certificate.getGrade()).toBe('A');
    });

    it('should return correct credits earned', () => {
      expect(certificate.getCreditsEarned()).toBe(3);
    });

    it('should return default values for missing metadata', () => {
      const certificateWithoutMetadata = Certificate.fromDatabase({
        id: 'cert-123',
        enrollmentId: 'enrollment-123',
        certificateId: 'CERT-123',
        pdfUrl: 'https://example.com/cert.pdf',
        issuedAt: new Date(),
        verificationUrl: 'https://example.com/verify/CERT-123',
        createdAt: new Date(),
      });

      expect(certificateWithoutMetadata.getStudentName()).toBe('Unknown Student');
      expect(certificateWithoutMetadata.getCourseTitle()).toBe('Unknown Course');
      expect(certificateWithoutMetadata.getInstructorName()).toBe('Unknown Instructor');
    });
  });

  describe('PDF Management', () => {
    it('should not be ready for delivery initially', () => {
      expect(certificate.isReadyForDelivery()).toBe(false);
    });

    it('should be ready for delivery after setting PDF URL', () => {
      certificate.setPdfUrl('https://example.com/certificates/cert-123.pdf');

      expect(certificate.isReadyForDelivery()).toBe(true);
      expect(certificate.pdfUrl).toBe('https://example.com/certificates/cert-123.pdf');
    });

    it('should throw error for empty PDF URL', () => {
      expect(() => certificate.setPdfUrl('')).toThrow('PDF URL is required');
      expect(() => certificate.setPdfUrl('   ')).toThrow('PDF URL is required');
    });
  });

  describe('Metadata Updates', () => {
    it('should update metadata', () => {
      certificate.updateMetadata({
        grade: 'A+',
        creditsEarned: 4,
        additionalInfo: 'Graduated with honors',
      });

      expect(certificate.getGrade()).toBe('A+');
      expect(certificate.getCreditsEarned()).toBe(4);
      expect(certificate.metadata?.additionalInfo).toBe('Graduated with honors');
    });

    it('should preserve existing metadata when updating', () => {
      certificate.updateMetadata({
        grade: 'A+',
      });

      expect(certificate.getGrade()).toBe('A+');
      expect(certificate.getStudentName()).toBe('John Doe'); // Should be preserved
      expect(certificate.getCourseTitle()).toBe('Introduction to Programming'); // Should be preserved
    });
  });

  describe('Verification', () => {
    it('should generate QR code data with verification URL', () => {
      const qrData = certificate.getQRCodeData();
      expect(qrData).toBe(certificate.verificationUrl);
      expect(qrData).toContain(certificate.certificateId);
    });

    it('should not be expired by default', () => {
      expect(certificate.isExpired()).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should throw error for missing enrollment ID', () => {
      expect(() => Certificate.fromDatabase({
        id: 'cert-123',
        enrollmentId: '',
        certificateId: 'CERT-123',
        pdfUrl: 'https://example.com/cert.pdf',
        issuedAt: new Date(),
        verificationUrl: 'https://example.com/verify/CERT-123',
        createdAt: new Date(),
      })).toThrow('Enrollment ID is required');
    });

    it('should throw error for missing certificate ID', () => {
      expect(() => Certificate.fromDatabase({
        id: 'cert-123',
        enrollmentId: 'enrollment-123',
        certificateId: '',
        pdfUrl: 'https://example.com/cert.pdf',
        issuedAt: new Date(),
        verificationUrl: 'https://example.com/verify/CERT-123',
        createdAt: new Date(),
      })).toThrow('Certificate ID is required');
    });

    it('should throw error for missing verification URL', () => {
      expect(() => Certificate.fromDatabase({
        id: 'cert-123',
        enrollmentId: 'enrollment-123',
        certificateId: 'CERT-123',
        pdfUrl: 'https://example.com/cert.pdf',
        issuedAt: new Date(),
        verificationUrl: '',
        createdAt: new Date(),
      })).toThrow('Verification URL is required');
    });

    it('should throw error for future issued date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      expect(() => Certificate.fromDatabase({
        id: 'cert-123',
        enrollmentId: 'enrollment-123',
        certificateId: 'CERT-123',
        pdfUrl: 'https://example.com/cert.pdf',
        issuedAt: futureDate,
        verificationUrl: 'https://example.com/verify/CERT-123',
        createdAt: new Date(),
      })).toThrow('Issued date cannot be in the future');
    });
  });

  describe('Database Conversion', () => {
    it('should convert to database format', () => {
      const dbFormat = certificate.toDatabase();

      expect(dbFormat.enrollmentId).toBe(enrollmentId);
      expect(dbFormat.certificateId).toBe(certificate.certificateId);
      expect(dbFormat.issuedAt).toBe(certificate.issuedAt);
      expect(dbFormat.verificationUrl).toBe(certificate.verificationUrl);
      expect(dbFormat.metadata).toBeDefined();
      expect(dbFormat.createdAt).toBe(certificate.createdAt);
      expect(dbFormat).not.toHaveProperty('id'); // Should be omitted
    });
  });
});