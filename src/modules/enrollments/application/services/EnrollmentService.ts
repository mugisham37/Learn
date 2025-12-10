/**
 * Enrollment Service Implementation
 * 
 * Implements enrollment business operations including student enrollment,
 * progress tracking, course completion, and certificate generation.
 * 
 * Requirements: 5.1, 5.3, 5.4, 5.5, 5.7
 */

import {
  ConflictError,
  NotFoundError,
  ValidationError
} from '../../../../shared/errors/index.js';
import { ICourseRepository } from '../../../courses/infrastructure/repositories/ICourseRepository.js';
import { ILessonRepository } from '../../../courses/infrastructure/repositories/ILessonRepository.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';
import { Certificate } from '../../domain/entities/Certificate.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';
import { LessonProgress } from '../../domain/entities/LessonProgress.js';
import {
  ICertificateRepository,
  CreateCertificateDTO
} from '../../infrastructure/repositories/ICertificateRepository.js';
import {
  IEnrollmentRepository,
  CreateEnrollmentDTO,
  UpdateEnrollmentDTO
} from '../../infrastructure/repositories/IEnrollmentRepository.js';
import {
  ILessonProgressRepository,
  CreateLessonProgressDTO,
  UpdateLessonProgressDTO as UpdateProgressDTO
} from '../../infrastructure/repositories/ILessonProgressRepository.js';

import {
  IEnrollmentService,
  EnrollStudentDTO,
  UpdateLessonProgressDTO,
  CompleteCourseDTO,
  WithdrawEnrollmentDTO,
  EnrollmentProgressSummary
} from './IEnrollmentService.js';

/**
 * Enrollment Service Implementation
 * 
 * Orchestrates enrollment operations between domain entities and infrastructure.
 * Handles business rules, validation, and cross-module interactions.
 */
export class EnrollmentService implements IEnrollmentService {
  constructor(
    private readonly enrollmentRepository: IEnrollmentRepository,
    private readonly lessonProgressRepository: ILessonProgressRepository,
    private readonly certificateRepository: ICertificateRepository,
    private readonly courseRepository: ICourseRepository,
    private readonly lessonRepository: ILessonRepository,
    private readonly userRepository: IUserRepository
  ) {}

  /**
   * Enrolls a student in a course
   * 
   * Requirements: 5.1 - Student enrollment with duplicate check and limit validation
   */
  async enrollStudent(data: EnrollStudentDTO): Promise<Enrollment> {
    // Validate student exists
    const student = await this.userRepository.findById(data.studentId);
    if (!student) {
      throw new NotFoundError('Student not found');
    }

    if (student.role !== 'student') {
      throw new ValidationError('User must have student role to enroll in courses', [
        { field: 'studentId', message: 'User is not a student' }
      ]);
    }

    // Validate course exists and is published
    const course = await this.courseRepository.findById(data.courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    if (course.status !== 'published') {
      throw new ValidationError('Cannot enroll in unpublished course', [
        { field: 'courseId', message: 'Course is not published' }
      ]);
    }

    // Check for duplicate enrollment
    const existingEnrollment = await this.enrollmentRepository.findByStudentAndCourse(
      data.studentId,
      data.courseId
    );

    if (existingEnrollment) {
      throw new ConflictError('Student is already enrolled in this course');
    }

    // Check enrollment limit if set
    if (course.enrollmentLimit && course.enrollmentLimit > 0) {
      const currentEnrollmentCount = await this.enrollmentRepository.getActiveEnrollmentCount(data.courseId);
      
      if (currentEnrollmentCount >= course.enrollmentLimit) {
        throw new ValidationError('Course enrollment limit reached', [
          { field: 'courseId', message: `Course is full (${course.enrollmentLimit} students maximum)` }
        ]);
      }
    }

    // Validate payment if course requires payment
    if (course.price && parseFloat(course.price) > 0) {
      if (!data.paymentInfo) {
        throw new ValidationError('Payment information required for paid course', [
          { field: 'paymentInfo', message: 'Payment information is required' }
        ]);
      }

      const expectedAmount = parseFloat(course.price);
      if (data.paymentInfo.amount !== expectedAmount) {
        throw new ValidationError('Payment amount does not match course price', [
          { field: 'paymentInfo', message: `Expected ${expectedAmount}, received ${data.paymentInfo.amount}` }
        ]);
      }
    }

    // Create enrollment
    const enrollmentData: CreateEnrollmentDTO = {
      studentId: data.studentId,
      courseId: data.courseId,
      paymentId: data.paymentInfo?.paymentId,
      status: 'active'
    };

    const enrollmentRecord = await this.enrollmentRepository.create(enrollmentData);

    // Convert to domain entity
    const enrollment = Enrollment.fromDatabase({
      id: enrollmentRecord.id,
      studentId: enrollmentRecord.studentId,
      courseId: enrollmentRecord.courseId,
      enrolledAt: enrollmentRecord.enrolledAt,
      completedAt: enrollmentRecord.completedAt || undefined,
      progressPercentage: parseFloat(enrollmentRecord.progressPercentage),
      lastAccessedAt: enrollmentRecord.lastAccessedAt || undefined,
      paymentId: enrollmentRecord.paymentId || undefined,
      certificateId: enrollmentRecord.certificateId || undefined,
      status: enrollmentRecord.status,
      createdAt: enrollmentRecord.createdAt,
      updatedAt: enrollmentRecord.updatedAt
    });

    // Initialize lesson progress records
    await this.initializeLessonProgress(enrollment.id, data.courseId);

    // Invalidate relevant caches
    await this.enrollmentRepository.invalidateCacheByStudent(data.studentId);
    await this.enrollmentRepository.invalidateCacheByCourse(data.courseId);

    return enrollment;
  }

  /**
   * Updates lesson progress for a student
   * 
   * Requirements: 5.3, 5.4 - Progress tracking and calculation
   */
  async updateLessonProgress(data: UpdateLessonProgressDTO): Promise<LessonProgress> {
    // Validate enrollment exists
    const enrollmentRecord = await this.enrollmentRepository.findById(data.enrollmentId);
    if (!enrollmentRecord) {
      throw new NotFoundError('Enrollment not found');
    }

    if (enrollmentRecord.status !== 'active') {
      throw new ValidationError('Cannot update progress for inactive enrollment', [
        { field: 'enrollmentId', message: 'Enrollment is not active' }
      ]);
    }

    // Validate lesson exists and belongs to the course
    const lesson = await this.lessonRepository.findById(data.lessonId);
    if (!lesson) {
      throw new NotFoundError('Lesson not found');
    }

    // Verify lesson belongs to the enrolled course
    const courseLessons = await this.lessonRepository.findByCourse(enrollmentRecord.courseId);
    const lessonBelongsToCourse = courseLessons.some(l => l.id === data.lessonId);
    
    if (!lessonBelongsToCourse) {
      throw new ValidationError('Lesson does not belong to the enrolled course', [
        { field: 'lessonId', message: 'Lesson is not part of this course' }
      ]);
    }

    // Find existing progress record
    const existingProgressRecord = await this.lessonProgressRepository.findByEnrollmentAndLesson(
      data.enrollmentId,
      data.lessonId
    );

    if (!existingProgressRecord) {
      throw new NotFoundError('Lesson progress record not found');
    }

    // Update progress
    const updateData: UpdateProgressDTO = {};

    if (data.progressUpdate.status) {
      updateData.status = data.progressUpdate.status;
      if (data.progressUpdate.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    if (data.progressUpdate.timeSpentSeconds !== undefined) {
      updateData.timeSpentSeconds = (existingProgressRecord.timeSpentSeconds || 0) + data.progressUpdate.timeSpentSeconds;
    }

    if (data.progressUpdate.quizScore !== undefined) {
      updateData.quizScore = data.progressUpdate.quizScore;
    }

    if (data.progressUpdate.attemptsCount !== undefined) {
      updateData.attemptsCount = data.progressUpdate.attemptsCount;
    }

    updateData.lastAccessedAt = new Date();

    const updatedProgressRecord = await this.lessonProgressRepository.updateByEnrollmentAndLesson(
      data.enrollmentId,
      data.lessonId,
      updateData
    );

    // Convert to domain entity
    const updatedProgress = LessonProgress.fromDatabase({
      id: updatedProgressRecord.id,
      enrollmentId: updatedProgressRecord.enrollmentId,
      lessonId: updatedProgressRecord.lessonId,
      status: updatedProgressRecord.status,
      timeSpentSeconds: updatedProgressRecord.timeSpentSeconds,
      completedAt: updatedProgressRecord.completedAt || undefined,
      quizScore: updatedProgressRecord.quizScore || undefined,
      attemptsCount: updatedProgressRecord.attemptsCount,
      lastAccessedAt: updatedProgressRecord.lastAccessedAt || undefined,
      createdAt: updatedProgressRecord.createdAt,
      updatedAt: updatedProgressRecord.updatedAt
    });

    // Recalculate enrollment progress
    await this.recalculateEnrollmentProgress(data.enrollmentId);

    // Invalidate caches
    await this.lessonProgressRepository.invalidateCacheByEnrollment(data.enrollmentId);
    await this.enrollmentRepository.invalidateCache(data.enrollmentId);

    return updatedProgress;
  }

  /**
   * Completes a course and generates certificate
   * 
   * Requirements: 5.5, 5.6 - Course completion and certificate generation
   */
  async completeCourse(data: CompleteCourseDTO): Promise<Certificate> {
    // Validate enrollment exists
    const enrollmentRecord = await this.enrollmentRepository.findById(data.enrollmentId);
    if (!enrollmentRecord) {
      throw new NotFoundError('Enrollment not found');
    }

    if (enrollmentRecord.status === 'completed') {
      throw new ConflictError('Course is already completed');
    }

    if (enrollmentRecord.status !== 'active') {
      throw new ValidationError('Cannot complete inactive enrollment', [
        { field: 'enrollmentId', message: 'Enrollment is not active' }
      ]);
    }

    // Check if certificate already exists
    const existingCertificate = await this.certificateRepository.findByEnrollment(data.enrollmentId);
    if (existingCertificate) {
      throw new ConflictError('Certificate already exists for this enrollment');
    }

    // Verify all lessons are completed
    const allCompleted = await this.lessonProgressRepository.areAllLessonsCompleted(data.enrollmentId);
    if (!allCompleted) {
      throw new ValidationError('Cannot complete course: not all lessons are completed', [
        { field: 'enrollmentId', message: 'All lessons must be completed before course completion' }
      ]);
    }

    // Update enrollment to completed status
    const completionDate = new Date();
    const enrollmentUpdate: UpdateEnrollmentDTO = {
      status: 'completed',
      completedAt: completionDate,
      progressPercentage: '100.00'
    };

    await this.enrollmentRepository.update(data.enrollmentId, enrollmentUpdate);

    // Generate certificate
    const certificateData: CreateCertificateDTO = {
      enrollmentId: data.enrollmentId,
      certificateId: this.generateCertificateId(),
      pdfUrl: '', // Will be set after PDF generation
      verificationUrl: this.generateVerificationUrl(data.enrollmentId),
      metadata: {
        studentName: data.certificateData.studentName,
        courseTitle: data.certificateData.courseTitle,
        instructorName: data.certificateData.instructorName,
        completionDate,
        grade: data.certificateData.grade,
        creditsEarned: data.certificateData.creditsEarned
      }
    };

    const certificateRecord = await this.certificateRepository.create(certificateData);

    // Convert to domain entity
    const certificate = Certificate.fromDatabase({
      id: certificateRecord.id,
      enrollmentId: certificateRecord.enrollmentId,
      certificateId: certificateRecord.certificateId,
      pdfUrl: certificateRecord.pdfUrl,
      issuedAt: certificateRecord.issuedAt,
      verificationUrl: certificateRecord.verificationUrl,
      metadata: certificateRecord.metadata as {
        studentName: string;
        courseTitle: string;
        instructorName: string;
        completionDate: Date;
        grade?: string;
        creditsEarned?: number;
        [key: string]: unknown;
      },
      createdAt: certificateRecord.createdAt
    });

    // Update enrollment with certificate ID
    await this.enrollmentRepository.update(data.enrollmentId, {
      certificateId: certificateRecord.id
    });

    // Invalidate caches
    await this.enrollmentRepository.invalidateCache(data.enrollmentId);
    await this.enrollmentRepository.invalidateCacheByStudent(enrollmentRecord.studentId);
    await this.enrollmentRepository.invalidateCacheByCourse(enrollmentRecord.courseId);

    return certificate;
  }

  /**
   * Withdraws a student from a course
   * 
   * Requirements: 5.7 - Enrollment withdrawal
   */
  async withdrawEnrollment(data: WithdrawEnrollmentDTO): Promise<void> {
    // Validate enrollment exists
    const enrollmentRecord = await this.enrollmentRepository.findById(data.enrollmentId);
    if (!enrollmentRecord) {
      throw new NotFoundError('Enrollment not found');
    }

    if (enrollmentRecord.status === 'dropped') {
      return; // Already withdrawn, no-op
    }

    if (enrollmentRecord.status === 'completed') {
      throw new ValidationError('Cannot withdraw from completed course', [
        { field: 'enrollmentId', message: 'Course is already completed' }
      ]);
    }

    // Update enrollment status to dropped
    const updateData: UpdateEnrollmentDTO = {
      status: 'dropped'
    };

    await this.enrollmentRepository.update(data.enrollmentId, updateData);

    // Invalidate caches
    await this.enrollmentRepository.invalidateCache(data.enrollmentId);
    await this.enrollmentRepository.invalidateCacheByStudent(enrollmentRecord.studentId);
    await this.enrollmentRepository.invalidateCacheByCourse(enrollmentRecord.courseId);
  }

  /**
   * Gets comprehensive progress summary for an enrollment
   * 
   * Requirements: 5.4 - Progress tracking and reporting
   */
  async getEnrollmentProgress(enrollmentId: string): Promise<EnrollmentProgressSummary> {
    // Validate enrollment exists
    const enrollmentRecord = await this.enrollmentRepository.findById(enrollmentId);
    if (!enrollmentRecord) {
      throw new NotFoundError('Enrollment not found');
    }

    // Convert to domain entity
    const enrollment = Enrollment.fromDatabase({
      id: enrollmentRecord.id,
      studentId: enrollmentRecord.studentId,
      courseId: enrollmentRecord.courseId,
      enrolledAt: enrollmentRecord.enrolledAt,
      completedAt: enrollmentRecord.completedAt || undefined,
      progressPercentage: parseFloat(enrollmentRecord.progressPercentage),
      lastAccessedAt: enrollmentRecord.lastAccessedAt || undefined,
      paymentId: enrollmentRecord.paymentId || undefined,
      certificateId: enrollmentRecord.certificateId || undefined,
      status: enrollmentRecord.status,
      createdAt: enrollmentRecord.createdAt,
      updatedAt: enrollmentRecord.updatedAt
    });

    // Get progress summary from repository
    const progressSummary = await this.lessonProgressRepository.getProgressSummary(enrollmentId);

    // Get next recommended lesson
    const nextLessonRecord = await this.lessonProgressRepository.getNextLesson(enrollmentId);
    let nextRecommendedLesson;

    if (nextLessonRecord) {
      const lesson = await this.lessonRepository.findById(nextLessonRecord.lessonId);
      if (lesson) {
        // For now, we'll use a simple approach to get module title
        // In a full implementation, we'd need to query the course modules
        nextRecommendedLesson = {
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          moduleTitle: 'Module' // Simplified for now
        };
      }
    }

    // Calculate struggling areas
    const strugglingAreas = await this.identifyStrugglingAreas(enrollmentId);

    // Calculate estimated time remaining
    const estimatedTimeRemaining = await this.calculateEstimatedTimeRemaining(enrollmentId);

    return {
      enrollment,
      totalLessons: progressSummary.totalLessons,
      completedLessons: progressSummary.completedLessons,
      inProgressLessons: progressSummary.inProgressLessons,
      notStartedLessons: progressSummary.notStartedLessons,
      progressPercentage: progressSummary.progressPercentage,
      totalTimeSpentSeconds: progressSummary.totalTimeSpentSeconds,
      averageQuizScore: progressSummary.averageQuizScore,
      nextRecommendedLesson,
      strugglingAreas,
      estimatedTimeRemaining
    };
  }

  /**
   * Initializes lesson progress records for all lessons in a course
   * 
   * Requirements: 5.3 - Progress record initialization
   */
  async initializeLessonProgress(enrollmentId: string, courseId: string): Promise<LessonProgress[]> {
    // Get all lessons for the course
    const lessons = await this.lessonRepository.findByCourse(courseId);

    if (lessons.length === 0) {
      throw new ValidationError('Course has no lessons', [
        { field: 'courseId', message: 'Course must have at least one lesson' }
      ]);
    }

    // Create progress records for all lessons
    const progressRecords: CreateLessonProgressDTO[] = lessons.map(lesson => ({
      enrollmentId,
      lessonId: lesson.id,
      status: 'not_started',
      timeSpentSeconds: 0,
      attemptsCount: 0
    }));

    const createdProgressRecords = await this.lessonProgressRepository.createMany(progressRecords);

    // Convert to domain entities
    const createdProgress = createdProgressRecords.map(record => 
      LessonProgress.fromDatabase({
        id: record.id,
        enrollmentId: record.enrollmentId,
        lessonId: record.lessonId,
        status: record.status,
        timeSpentSeconds: record.timeSpentSeconds,
        completedAt: record.completedAt || undefined,
        quizScore: record.quizScore || undefined,
        attemptsCount: record.attemptsCount,
        lastAccessedAt: record.lastAccessedAt || undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );

    // Invalidate cache
    await this.lessonProgressRepository.invalidateCacheByEnrollment(enrollmentId);

    return createdProgress;
  }

  /**
   * Checks if a student can enroll in a course
   */
  async checkEnrollmentEligibility(studentId: string, courseId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    requiresPayment: boolean;
    paymentAmount?: number;
    enrollmentLimit?: number;
    currentEnrollments?: number;
  }> {
    const reasons: string[] = [];
    let eligible = true;

    // Check if student exists
    const student = await this.userRepository.findById(studentId);
    if (!student) {
      eligible = false;
      reasons.push('Student not found');
    } else if (student.role !== 'student') {
      eligible = false;
      reasons.push('User must have student role');
    }

    // Check if course exists and is published
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      eligible = false;
      reasons.push('Course not found');
    } else if (course.status !== 'published') {
      eligible = false;
      reasons.push('Course is not published');
    }

    // Check for existing enrollment
    const existingEnrollment = await this.enrollmentRepository.findByStudentAndCourse(studentId, courseId);
    if (existingEnrollment) {
      eligible = false;
      reasons.push('Already enrolled in this course');
    }

    let currentEnrollments = 0;
    let enrollmentLimit;

    // Check enrollment limit
    if (course && course.enrollmentLimit && course.enrollmentLimit > 0) {
      currentEnrollments = await this.enrollmentRepository.getActiveEnrollmentCount(courseId);
      enrollmentLimit = course.enrollmentLimit;
      
      if (currentEnrollments >= course.enrollmentLimit) {
        eligible = false;
        reasons.push(`Course is full (${course.enrollmentLimit} students maximum)`);
      }
    }

    // Check payment requirements
    const requiresPayment = course ? parseFloat(course.price || '0') > 0 : false;
    const paymentAmount = course ? parseFloat(course.price || '0') : undefined;

    return {
      eligible,
      reasons,
      requiresPayment,
      paymentAmount,
      enrollmentLimit,
      currentEnrollments
    };
  }

  /**
   * Gets all enrollments for a student
   */
  async getStudentEnrollments(
    studentId: string,
    filters?: {
      status?: 'active' | 'completed' | 'dropped';
      courseId?: string;
    }
  ): Promise<Enrollment[]> {
    const result = await this.enrollmentRepository.findByStudent(studentId, filters);
    
    // Convert to domain entities
    return result.enrollments.map(record => 
      Enrollment.fromDatabase({
        id: record.id,
        studentId: record.studentId,
        courseId: record.courseId,
        enrolledAt: record.enrolledAt,
        completedAt: record.completedAt || undefined,
        progressPercentage: parseFloat(record.progressPercentage),
        lastAccessedAt: record.lastAccessedAt || undefined,
        paymentId: record.paymentId || undefined,
        certificateId: record.certificateId || undefined,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );
  }

  /**
   * Gets all enrollments for a course
   */
  async getCourseEnrollments(
    courseId: string,
    filters?: {
      status?: 'active' | 'completed' | 'dropped';
      studentId?: string;
    }
  ): Promise<Enrollment[]> {
    const result = await this.enrollmentRepository.findByCourse(courseId, filters);
    
    // Convert to domain entities
    return result.enrollments.map(record => 
      Enrollment.fromDatabase({
        id: record.id,
        studentId: record.studentId,
        courseId: record.courseId,
        enrolledAt: record.enrolledAt,
        completedAt: record.completedAt || undefined,
        progressPercentage: parseFloat(record.progressPercentage),
        lastAccessedAt: record.lastAccessedAt || undefined,
        paymentId: record.paymentId || undefined,
        certificateId: record.certificateId || undefined,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })
    );
  }

  /**
   * Processes enrollment completion for eligible enrollments
   */
  async processEligibleCompletions(limit = 50): Promise<number> {
    const eligibleEnrollmentRecords = await this.enrollmentRepository.findEligibleForCompletion(limit);
    let processedCount = 0;

    for (const enrollmentRecord of eligibleEnrollmentRecords) {
      try {
        // Get course and student information for certificate
        const course = await this.courseRepository.findById(enrollmentRecord.courseId);
        const student = await this.userRepository.findById(enrollmentRecord.studentId);

        if (course && student) {
          await this.completeCourse({
            enrollmentId: enrollmentRecord.id,
            certificateData: {
              studentName: student.email, // Simplified - would need user profile service
              courseTitle: course.title,
              instructorName: 'Instructor', // Simplified - would need instructor lookup
            }
          });
          processedCount++;
        }
      } catch (error) {
        // Log error but continue processing other enrollments
        console.error(`Failed to complete enrollment ${enrollmentRecord.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Calculates estimated time remaining for course completion
   */
  async calculateEstimatedTimeRemaining(enrollmentId: string): Promise<number> {
    const progressSummary = await this.lessonProgressRepository.getProgressSummary(enrollmentId);
    
    if (progressSummary.completedLessons === 0) {
      // No lessons completed, can't estimate
      return 0;
    }

    const averageTimePerLesson = progressSummary.totalTimeSpentSeconds / progressSummary.completedLessons;
    const remainingLessons = progressSummary.totalLessons - progressSummary.completedLessons;
    
    // Convert to minutes
    return Math.round((averageTimePerLesson * remainingLessons) / 60);
  }

  /**
   * Identifies struggling areas for a student based on progress patterns
   */
  async identifyStrugglingAreas(enrollmentId: string): Promise<string[]> {
    const strugglingAreas: string[] = [];
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollmentId);

    // Analyze quiz performance
    const quizScores = progressRecords
      .filter(p => p.quizScore !== undefined)
      .map(p => p.quizScore!);

    if (quizScores.length > 0) {
      const averageScore = quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length;
      if (averageScore < 70) {
        strugglingAreas.push('Quiz performance below average');
      }
    }

    // Analyze time spent patterns
    const timeSpentRecords = progressRecords.filter(p => p.timeSpentSeconds > 0);
    if (timeSpentRecords.length > 0) {
      const averageTime = timeSpentRecords.reduce((sum, p) => sum + p.timeSpentSeconds, 0) / timeSpentRecords.length;
      const highTimeRecords = timeSpentRecords.filter(p => p.timeSpentSeconds > averageTime * 2);
      
      if (highTimeRecords.length > timeSpentRecords.length * 0.3) {
        strugglingAreas.push('Taking longer than average on lessons');
      }
    }

    // Analyze attempt patterns
    const highAttemptRecords = progressRecords.filter(p => p.attemptsCount > 3);
    if (highAttemptRecords.length > progressRecords.length * 0.2) {
      strugglingAreas.push('Multiple attempts required on lessons');
    }

    // Analyze completion patterns
    const inProgressRecords = progressRecords.filter(p => p.status === 'in_progress');
    if (inProgressRecords.length > progressRecords.length * 0.3) {
      strugglingAreas.push('Many lessons started but not completed');
    }

    return strugglingAreas;
  }

  /**
   * Recalculates enrollment progress percentage
   */
  private async recalculateEnrollmentProgress(enrollmentId: string): Promise<void> {
    const progressSummary = await this.lessonProgressRepository.getProgressSummary(enrollmentId);
    
    const updateData: UpdateEnrollmentDTO = {
      progressPercentage: progressSummary.progressPercentage.toString(),
      lastAccessedAt: new Date()
    };

    await this.enrollmentRepository.update(enrollmentId, updateData);
  }

  /**
   * Generates unique certificate ID
   */
  private generateCertificateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `CERT-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
  }

  /**
   * Generates verification URL for certificate
   */
  private generateVerificationUrl(enrollmentId: string): string {
    const baseUrl = process.env['APP_BASE_URL'] || 'https://platform.example.com';
    return `${baseUrl}/certificates/verify/${enrollmentId}`;
  }
}