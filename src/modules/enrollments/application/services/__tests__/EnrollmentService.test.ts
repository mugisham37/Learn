/**
 * Enrollment Service Tests
 * 
 * Basic tests to verify the enrollment service implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrollmentService } from '../EnrollmentService.js';
import { IEnrollmentRepository } from '../../infrastructure/repositories/IEnrollmentRepository.js';
import { ILessonProgressRepository } from '../../infrastructure/repositories/ILessonProgressRepository.js';
import { ICertificateRepository } from '../../infrastructure/repositories/ICertificateRepository.js';
import { ICourseRepository } from '../../../courses/infrastructure/repositories/ICourseRepository.js';
import { ILessonRepository } from '../../../courses/infrastructure/repositories/ILessonRepository.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';

// Mock repositories
const mockEnrollmentRepository: Partial<IEnrollmentRepository> = {
  findByStudentAndCourse: vi.fn(),
  create: vi.fn(),
  getActiveEnrollmentCount: vi.fn(),
  invalidateCacheByStudent: vi.fn(),
  invalidateCacheByCourse: vi.fn(),
};

const mockLessonProgressRepository: Partial<ILessonProgressRepository> = {
  createMany: vi.fn(),
  invalidateCacheByEnrollment: vi.fn(),
};

const mockCertificateRepository: Partial<ICertificateRepository> = {};

const mockCourseRepository: Partial<ICourseRepository> = {
  findById: vi.fn(),
};

const mockLessonRepository: Partial<ILessonRepository> = {
  findByCourse: vi.fn(),
};

const mockUserRepository: Partial<IUserRepository> = {
  findById: vi.fn(),
};

describe('EnrollmentService', () => {
  let enrollmentService: EnrollmentService;

  beforeEach(() => {
    enrollmentService = new EnrollmentService(
      mockEnrollmentRepository as IEnrollmentRepository,
      mockLessonProgressRepository as ILessonProgressRepository,
      mockCertificateRepository as ICertificateRepository,
      mockCourseRepository as ICourseRepository,
      mockLessonRepository as ILessonRepository,
      mockUserRepository as IUserRepository
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('checkEnrollmentEligibility', () => {
    it('should return eligible true for valid student and course', async () => {
      // Mock student exists and is a student
      (mockUserRepository.findById as any).mockResolvedValue({
        id: 'student-1',
        email: 'student@example.com',
        role: 'student'
      });

      // Mock course exists and is published
      (mockCourseRepository.findById as any).mockResolvedValue({
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        price: '0'
      });

      // Mock no existing enrollment
      (mockEnrollmentRepository.findByStudentAndCourse as any).mockResolvedValue(null);

      const result = await enrollmentService.checkEnrollmentEligibility('student-1', 'course-1');

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.requiresPayment).toBe(false);
    });

    it('should return eligible false for non-existent student', async () => {
      // Mock student does not exist
      (mockUserRepository.findById as any).mockResolvedValue(null);

      const result = await enrollmentService.checkEnrollmentEligibility('invalid-student', 'course-1');

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Student not found');
    });

    it('should return eligible false for already enrolled student', async () => {
      // Mock student exists and is a student
      (mockUserRepository.findById as any).mockResolvedValue({
        id: 'student-1',
        email: 'student@example.com',
        role: 'student'
      });

      // Mock course exists and is published
      (mockCourseRepository.findById as any).mockResolvedValue({
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        price: '0'
      });

      // Mock existing enrollment
      (mockEnrollmentRepository.findByStudentAndCourse as any).mockResolvedValue({
        id: 'enrollment-1',
        studentId: 'student-1',
        courseId: 'course-1'
      });

      const result = await enrollmentService.checkEnrollmentEligibility('student-1', 'course-1');

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('Already enrolled in this course');
    });

    it('should detect payment requirements for paid courses', async () => {
      // Mock student exists and is a student
      (mockUserRepository.findById as any).mockResolvedValue({
        id: 'student-1',
        email: 'student@example.com',
        role: 'student'
      });

      // Mock paid course
      (mockCourseRepository.findById as any).mockResolvedValue({
        id: 'course-1',
        title: 'Test Course',
        status: 'published',
        price: '99.99'
      });

      // Mock no existing enrollment
      (mockEnrollmentRepository.findByStudentAndCourse as any).mockResolvedValue(null);

      const result = await enrollmentService.checkEnrollmentEligibility('student-1', 'course-1');

      expect(result.eligible).toBe(true);
      expect(result.requiresPayment).toBe(true);
      expect(result.paymentAmount).toBe(99.99);
    });
  });

  describe('generateCertificateId', () => {
    it('should generate unique certificate IDs', () => {
      const service = enrollmentService as any;
      const id1 = service.generateCertificateId();
      const id2 = service.generateCertificateId();

      expect(id1).toMatch(/^CERT-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(id2).toMatch(/^CERT-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateVerificationUrl', () => {
    it('should generate verification URL with enrollment ID', () => {
      const service = enrollmentService as any;
      const url = service.generateVerificationUrl('enrollment-123');

      expect(url).toContain('enrollment-123');
      expect(url).toMatch(/^https?:\/\/.+\/certificates\/verify\/enrollment-123$/);
    });
  });
});