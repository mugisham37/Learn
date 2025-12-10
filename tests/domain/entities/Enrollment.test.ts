/**
 * Enrollment Domain Entity Tests
 * 
 * Tests for the Enrollment domain entity including progress calculation,
 * completion detection, and certificate generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Enrollment, LessonProgress, Certificate } from '../../../src/modules/enrollments/domain/entities';

describe('Enrollment Entity', () => {
  let enrollment: Enrollment;
  const studentId = 'student-123';
  const courseId = 'course-456';

  beforeEach(() => {
    enrollment = Enrollment.create({
      studentId,
      courseId,
    });
  });

  describe('Creation', () => {
    it('should create enrollment with correct properties', () => {
      expect(enrollment.studentId).toBe(studentId);
      expect(enrollment.courseId).toBe(courseId);
      expect(enrollment.status).toBe('active');
      expect(enrollment.progressPercentage).toBe(0);
      expect(enrollment.enrolledAt).toBeInstanceOf(Date);
      expect(enrollment.domainEvents).toHaveLength(1);
      expect(enrollment.domainEvents[0].eventType).toBe('EnrollmentCreated');
    });

    it('should create enrollment with payment ID', () => {
      const paymentId = 'payment-789';
      const enrollmentWithPayment = Enrollment.create({
        studentId,
        courseId,
        paymentId,
      });

      expect(enrollmentWithPayment.paymentId).toBe(paymentId);
    });
  });

  describe('Lesson Progress Initialization', () => {
    it('should initialize lesson progress for all lessons', () => {
      const lessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];
      
      enrollment.initializeLessonProgress(lessonIds);
      
      expect(enrollment.lessonProgress).toHaveLength(3);
      expect(enrollment.lessonProgress.every(p => p.status === 'not_started')).toBe(true);
      expect(enrollment.lessonProgress.every(p => p.enrollmentId === enrollment.id)).toBe(true);
    });

    it('should throw error if progress already initialized', () => {
      const lessonIds = ['lesson-1', 'lesson-2'];
      
      enrollment.initializeLessonProgress(lessonIds);
      
      expect(() => enrollment.initializeLessonProgress(lessonIds)).toThrow(
        'Lesson progress already initialized'
      );
    });
  });

  describe('Progress Calculation', () => {
    beforeEach(() => {
      const lessonIds = ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'];
      enrollment.initializeLessonProgress(lessonIds);
    });

    it('should calculate progress percentage correctly', () => {
      // Complete 2 out of 4 lessons
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });
      enrollment.updateLessonProgress('lesson-2', (progress) => {
        progress.completeLesson();
      });

      expect(enrollment.progressPercentage).toBe(50);
    });

    it('should emit progress update events', () => {
      enrollment.clearDomainEvents(); // Clear creation event
      
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });

      const progressEvents = enrollment.domainEvents.filter(
        e => e.eventType === 'CourseProgressUpdated'
      );
      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].payload.newProgressPercentage).toBe(25);
    });

    it('should detect when all lessons are completed', () => {
      // Complete all lessons
      ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'].forEach(lessonId => {
        enrollment.updateLessonProgress(lessonId, (progress) => {
          progress.completeLesson();
        });
      });

      expect(enrollment.isAllLessonsCompleted()).toBe(true);
      expect(enrollment.progressPercentage).toBe(100);
    });
  });

  describe('Course Completion', () => {
    beforeEach(() => {
      const lessonIds = ['lesson-1', 'lesson-2'];
      enrollment.initializeLessonProgress(lessonIds);
    });

    it('should complete course when all lessons are completed', () => {
      enrollment.clearDomainEvents(); // Clear creation event
      
      // Complete all lessons
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });
      enrollment.updateLessonProgress('lesson-2', (progress) => {
        progress.completeLesson();
      });

      expect(enrollment.status).toBe('completed');
      expect(enrollment.completedAt).toBeInstanceOf(Date);
      
      const completionEvents = enrollment.domainEvents.filter(
        e => e.eventType === 'CourseCompleted'
      );
      expect(completionEvents).toHaveLength(1);
    });

    it('should not complete course if not all lessons are completed', () => {
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });

      expect(enrollment.status).toBe('active');
      expect(enrollment.completedAt).toBeUndefined();
    });
  });

  describe('Certificate Generation', () => {
    beforeEach(() => {
      const lessonIds = ['lesson-1', 'lesson-2'];
      enrollment.initializeLessonProgress(lessonIds);
      
      // Complete all lessons to make enrollment completed
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });
      enrollment.updateLessonProgress('lesson-2', (progress) => {
        progress.completeLesson();
      });
    });

    it('should generate certificate for completed course', () => {
      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Introduction to Programming',
        instructorName: 'Jane Smith',
        grade: 'A',
        creditsEarned: 3,
      };

      const certificate = enrollment.generateCertificate(certificateData);

      expect(certificate).toBeInstanceOf(Certificate);
      expect(certificate.getStudentName()).toBe('John Doe');
      expect(certificate.getCourseTitle()).toBe('Introduction to Programming');
      expect(certificate.getInstructorName()).toBe('Jane Smith');
      expect(enrollment.certificateId).toBe(certificate.id);
    });

    it('should throw error if course not completed', () => {
      // Create new enrollment that's not completed
      const incompleteEnrollment = Enrollment.create({
        studentId: 'student-456',
        courseId: 'course-789',
      });

      expect(() => incompleteEnrollment.generateCertificate({
        studentName: 'John Doe',
        courseTitle: 'Test Course',
        instructorName: 'Jane Smith',
      })).toThrow('Cannot generate certificate: course not completed');
    });

    it('should throw error if certificate already generated', () => {
      const certificateData = {
        studentName: 'John Doe',
        courseTitle: 'Introduction to Programming',
        instructorName: 'Jane Smith',
      };

      enrollment.generateCertificate(certificateData);

      expect(() => enrollment.generateCertificate(certificateData)).toThrow(
        'Certificate already generated for this enrollment'
      );
    });
  });

  describe('Withdrawal', () => {
    it('should withdraw from active enrollment', () => {
      enrollment.clearDomainEvents(); // Clear creation event
      
      enrollment.withdraw('Changed my mind');

      expect(enrollment.status).toBe('dropped');
      
      const withdrawalEvents = enrollment.domainEvents.filter(
        e => e.eventType === 'EnrollmentWithdrawn'
      );
      expect(withdrawalEvents).toHaveLength(1);
      expect(withdrawalEvents[0].payload.reason).toBe('Changed my mind');
    });

    it('should throw error when withdrawing from completed course', () => {
      const lessonIds = ['lesson-1'];
      enrollment.initializeLessonProgress(lessonIds);
      
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });

      expect(() => enrollment.withdraw()).toThrow(
        'Cannot withdraw from completed course'
      );
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const lessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];
      enrollment.initializeLessonProgress(lessonIds);
    });

    it('should calculate total time spent', () => {
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.addTimeSpent(300); // 5 minutes
      });
      enrollment.updateLessonProgress('lesson-2', (progress) => {
        progress.addTimeSpent(600); // 10 minutes
      });

      expect(enrollment.getTotalTimeSpentSeconds()).toBe(900); // 15 minutes
    });

    it('should calculate average quiz score', () => {
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.recordQuizScore(85);
      });
      enrollment.updateLessonProgress('lesson-2', (progress) => {
        progress.recordQuizScore(95);
      });

      expect(enrollment.getAverageQuizScore()).toBe(90);
    });

    it('should return undefined for average quiz score when no quizzes', () => {
      expect(enrollment.getAverageQuizScore()).toBeUndefined();
    });

    it('should get next lesson to complete', () => {
      enrollment.updateLessonProgress('lesson-1', (progress) => {
        progress.completeLesson();
      });

      const nextLesson = enrollment.getNextLesson();
      expect(nextLesson?.lessonId).toBe('lesson-2');
    });
  });
});