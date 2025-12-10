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
import { ICourseModuleRepository } from '../../../courses/infrastructure/repositories/ICourseModuleRepository.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';

// Mock repositories
const mockEnrollmentRepository: Partial<IEnrollmentRepository> = {
  findByStudentAndCourse: vi.fn(),
  create: vi.fn(),
  getActiveEnrollmentCount: vi.fn(),
  invalidateCacheByStudent: vi.fn(),
  invalidateCacheByCourse: vi.fn(),
  findById: vi.fn(),
};

const mockLessonProgressRepository: Partial<ILessonProgressRepository> = {
  createMany: vi.fn(),
  invalidateCacheByEnrollment: vi.fn(),
  findByEnrollmentAndLesson: vi.fn(),
};

const mockCertificateRepository: Partial<ICertificateRepository> = {};

const mockCourseRepository: Partial<ICourseRepository> = {
  findById: vi.fn(),
};

const mockLessonRepository: Partial<ILessonRepository> = {
  findByCourse: vi.fn(),
  findById: vi.fn(),
  findByModule: vi.fn(),
};

const mockCourseModuleRepository: Partial<ICourseModuleRepository> = {
  findById: vi.fn(),
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
      mockCourseModuleRepository as ICourseModuleRepository,
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

  describe('checkLessonAccess', () => {
    it('should allow access to lesson without prerequisites', async () => {
      // Mock active enrollment
      (mockEnrollmentRepository.findById as any).mockResolvedValue({
        id: 'enrollment-1',
        studentId: 'student-1',
        courseId: 'course-1',
        status: 'active'
      });

      // Mock lesson exists
      (mockLessonRepository.findById as any).mockResolvedValue({
        id: 'lesson-1',
        moduleId: 'module-1',
        title: 'Test Lesson'
      });

      // Mock module without prerequisites
      (mockCourseModuleRepository.findById as any).mockResolvedValue({
        id: 'module-1',
        courseId: 'course-1',
        title: 'Test Module',
        prerequisiteModuleId: null
      });

      // Mock lesson belongs to course
      (mockLessonRepository.findByCourse as any).mockResolvedValue([
        { id: 'lesson-1', moduleId: 'module-1' }
      ]);

      const result = await enrollmentService.checkLessonAccess('enrollment-1', 'lesson-1');

      expect(result.canAccess).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should deny access to lesson with unmet prerequisites', async () => {
      // Mock active enrollment
      (mockEnrollmentRepository.findById as any).mockResolvedValue({
        id: 'enrollment-1',
        studentId: 'student-1',
        courseId: 'course-1',
        status: 'active'
      });

      // Mock lesson exists
      (mockLessonRepository.findById as any).mockResolvedValue({
        id: 'lesson-2',
        moduleId: 'module-2',
        title: 'Advanced Lesson'
      });

      // Mock module with prerequisites
      (mockCourseModuleRepository.findById as any)
        .mockResolvedValueOnce({
          id: 'module-2',
          courseId: 'course-1',
          title: 'Advanced Module',
          prerequisiteModuleId: 'module-1'
        })
        .mockResolvedValueOnce({
          id: 'module-1',
          courseId: 'course-1',
          title: 'Basic Module',
          prerequisiteModuleId: null
        });

      // Mock lesson belongs to course
      (mockLessonRepository.findByCourse as any).mockResolvedValue([
        { id: 'lesson-2', moduleId: 'module-2' }
      ]);

      // Mock prerequisite module lessons
      (mockLessonRepository.findByModule as any).mockResolvedValue([
        { id: 'lesson-1', moduleId: 'module-1' }
      ]);

      // Mock prerequisite lesson not completed
      (mockLessonProgressRepository.findByEnrollmentAndLesson as any).mockResolvedValue({
        id: 'progress-1',
        enrollmentId: 'enrollment-1',
        lessonId: 'lesson-1',
        status: 'in_progress'
      });

      const result = await enrollmentService.checkLessonAccess('enrollment-1', 'lesson-2');

      expect(result.canAccess).toBe(false);
      expect(result.reasons).toContain('Prerequisite module "Basic Module" must be completed first');
      expect(result.prerequisiteModules).toHaveLength(1);
      expect(result.prerequisiteModules![0].isCompleted).toBe(false);
    });

    it('should allow access to lesson with completed prerequisites', async () => {
      // Mock active enrollment
      (mockEnrollmentRepository.findById as any).mockResolvedValue({
        id: 'enrollment-1',
        studentId: 'student-1',
        courseId: 'course-1',
        status: 'active'
      });

      // Mock lesson exists
      (mockLessonRepository.findById as any).mockResolvedValue({
        id: 'lesson-2',
        moduleId: 'module-2',
        title: 'Advanced Lesson'
      });

      // Mock module with prerequisites
      (mockCourseModuleRepository.findById as any)
        .mockResolvedValueOnce({
          id: 'module-2',
          courseId: 'course-1',
          title: 'Advanced Module',
          prerequisiteModuleId: 'module-1'
        })
        .mockResolvedValueOnce({
          id: 'module-1',
          courseId: 'course-1',
          title: 'Basic Module',
          prerequisiteModuleId: null
        });

      // Mock lesson belongs to course
      (mockLessonRepository.findByCourse as any).mockResolvedValue([
        { id: 'lesson-2', moduleId: 'module-2' }
      ]);

      // Mock prerequisite module lessons
      (mockLessonRepository.findByModule as any).mockResolvedValue([
        { id: 'lesson-1', moduleId: 'module-1' }
      ]);

      // Mock prerequisite lesson completed
      (mockLessonProgressRepository.findByEnrollmentAndLesson as any).mockResolvedValue({
        id: 'progress-1',
        enrollmentId: 'enrollment-1',
        lessonId: 'lesson-1',
        status: 'completed'
      });

      const result = await enrollmentService.checkLessonAccess('enrollment-1', 'lesson-2');

      expect(result.canAccess).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.prerequisiteModules).toHaveLength(1);
      expect(result.prerequisiteModules![0].isCompleted).toBe(true);
    });

    it('should deny access for inactive enrollment', async () => {
      // Mock inactive enrollment
      (mockEnrollmentRepository.findById as any).mockResolvedValue({
        id: 'enrollment-1',
        studentId: 'student-1',
        courseId: 'course-1',
        status: 'completed'
      });

      const result = await enrollmentService.checkLessonAccess('enrollment-1', 'lesson-1');

      expect(result.canAccess).toBe(false);
      expect(result.reasons).toContain('Enrollment is not active');
    });
  });
});