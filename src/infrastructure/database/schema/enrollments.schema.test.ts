/**
 * Enrollments Schema Tests
 * 
 * Basic tests to verify the enrollments schema is properly defined
 */

import { describe, it, expect } from 'vitest';
import { 
  enrollments, 
  lessonProgress, 
  certificates,
  enrollmentStatusEnum,
  progressStatusEnum,
  type Enrollment,
  type LessonProgress,
  type Certificate
} from './enrollments.schema';

describe('Enrollments Schema', () => {
  it('should export enrollments table with all required fields', () => {
    expect(enrollments).toBeDefined();
    expect(enrollments).toHaveProperty('id');
    expect(enrollments).toHaveProperty('studentId');
    expect(enrollments).toHaveProperty('courseId');
    expect(enrollments).toHaveProperty('enrolledAt');
    expect(enrollments).toHaveProperty('completedAt');
    expect(enrollments).toHaveProperty('progressPercentage');
    expect(enrollments).toHaveProperty('lastAccessedAt');
    expect(enrollments).toHaveProperty('paymentId');
    expect(enrollments).toHaveProperty('certificateId');
    expect(enrollments).toHaveProperty('status');
  });

  it('should export lessonProgress table with all required fields', () => {
    expect(lessonProgress).toBeDefined();
    expect(lessonProgress).toHaveProperty('id');
    expect(lessonProgress).toHaveProperty('enrollmentId');
    expect(lessonProgress).toHaveProperty('lessonId');
    expect(lessonProgress).toHaveProperty('status');
    expect(lessonProgress).toHaveProperty('timeSpentSeconds');
    expect(lessonProgress).toHaveProperty('completedAt');
    expect(lessonProgress).toHaveProperty('quizScore');
    expect(lessonProgress).toHaveProperty('attemptsCount');
  });

  it('should export certificates table with all required fields', () => {
    expect(certificates).toBeDefined();
    expect(certificates).toHaveProperty('id');
    expect(certificates).toHaveProperty('enrollmentId');
    expect(certificates).toHaveProperty('certificateId');
    expect(certificates).toHaveProperty('pdfUrl');
    expect(certificates).toHaveProperty('issuedAt');
    expect(certificates).toHaveProperty('verificationUrl');
    expect(certificates).toHaveProperty('metadata');
  });

  it('should export enrollment status enum', () => {
    expect(enrollmentStatusEnum).toBeDefined();
  });

  it('should export progress status enum', () => {
    expect(progressStatusEnum).toBeDefined();
  });

  it('should have proper type exports', () => {
    // This test verifies that the types can be used
    const enrollment: Partial<Enrollment> = {
      progressPercentage: '50.00',
      status: 'active'
    };
    
    const progress: Partial<LessonProgress> = {
      status: 'in_progress',
      timeSpentSeconds: 300
    };
    
    const certificate: Partial<Certificate> = {
      certificateId: 'CERT-12345',
      pdfUrl: 'https://example.com/cert.pdf'
    };

    expect(enrollment).toBeDefined();
    expect(progress).toBeDefined();
    expect(certificate).toBeDefined();
  });
});
