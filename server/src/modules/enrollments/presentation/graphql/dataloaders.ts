/**
 * DataLoader implementations for Enrollments Module
 *
 * Provides efficient batching and caching for GraphQL field resolvers
 * to prevent N+1 query problems.
 *
 * Requirements: 21.5
 */

import DataLoader from 'dataloader';

import { Enrollment } from '../../../../infrastructure/database/schema/enrollments.schema.js';
import { IEnrollmentService, EnrollmentProgressSummary } from '../../application/services/IEnrollmentService.js';
import { IEnrollmentRepository } from '../../infrastructure/repositories/IEnrollmentRepository.js';

/**
 * DataLoader context interface for Enrollments module
 */
export interface EnrollmentDataLoaderContext {
  enrollmentRepository: IEnrollmentRepository;
  enrollmentService: IEnrollmentService;
}

/**
 * Enrollment DataLoaders for efficient data fetching
 */
export class EnrollmentDataLoaders {
  public readonly enrollmentById: DataLoader<string, Enrollment | null>;
  public readonly enrollmentsByStudentId: DataLoader<string, Enrollment[]>;
  public readonly enrollmentsByCourseId: DataLoader<string, Enrollment[]>;
  public readonly enrollmentProgressById: DataLoader<string, EnrollmentProgressSummary | null>;

  constructor(private readonly context: EnrollmentDataLoaderContext) {
    // Enrollment by ID loader
    this.enrollmentById = new DataLoader<string, Enrollment | null>(
      async (enrollmentIds: readonly string[]) => {
        const enrollments = await this.batchLoadEnrollmentsByIds([...enrollmentIds]);
        return enrollmentIds.map((id) => enrollments.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback: () => void): void => {
          setTimeout(callback, 10);
        },
      }
    );

    // Enrollments by student ID loader
    this.enrollmentsByStudentId = new DataLoader<string, Enrollment[]>(
      async (studentIds: readonly string[]) => {
        const enrollmentsMap = await this.batchLoadEnrollmentsByStudentIds([...studentIds]);
        return studentIds.map((id) => enrollmentsMap.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 50,
        batchScheduleFn: (callback: () => void): void => {
          setTimeout(callback, 10);
        },
      }
    );

    // Enrollments by course ID loader
    this.enrollmentsByCourseId = new DataLoader<string, Enrollment[]>(
      async (courseIds: readonly string[]) => {
        const enrollmentsMap = await this.batchLoadEnrollmentsByCourseIds([...courseIds]);
        return courseIds.map((id) => enrollmentsMap.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 50,
        batchScheduleFn: (callback: () => void): void => {
          setTimeout(callback, 10);
        },
      }
    );

    // Enrollment progress by enrollment ID loader
    this.enrollmentProgressById = new DataLoader<string, EnrollmentProgressSummary | null>(
      async (enrollmentIds: readonly string[]) => {
        const progressMap = await this.batchLoadEnrollmentProgress([...enrollmentIds]);
        return enrollmentIds.map((id) => progressMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback: () => void): void => {
          setTimeout(callback, 10);
        },
      }
    );
  }

  /**
   * Batch load enrollments by IDs
   */
  private async batchLoadEnrollmentsByIds(
    enrollmentIds: string[]
  ): Promise<Map<string, Enrollment>> {
    const enrollmentsMap = new Map<string, Enrollment>();

    // Load enrollments individually (can be optimized later with batch repository method)
    const enrollmentPromises = enrollmentIds.map(async (id) => {
      try {
        const enrollment = await this.context.enrollmentRepository.findById(id);
        return { id, enrollment };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load enrollment ${id}:`, error);
        return { id, enrollment: null };
      }
    });

    const results = await Promise.all(enrollmentPromises);

    for (const { id, enrollment } of results) {
      if (enrollment) {
        enrollmentsMap.set(id, enrollment);
      }
    }

    return enrollmentsMap;
  }

  /**
   * Batch load enrollments by student IDs
   */
  private async batchLoadEnrollmentsByStudentIds(
    studentIds: string[]
  ): Promise<Map<string, Enrollment[]>> {
    const enrollmentsMap = new Map<string, Enrollment[]>();

    // Initialize empty arrays for all student IDs
    for (const studentId of studentIds) {
      enrollmentsMap.set(studentId, []);
    }

    // Load enrollments for each student individually
    const enrollmentPromises = studentIds.map(async (studentId) => {
      try {
        const result = await this.context.enrollmentRepository.findByStudent(
          studentId,
          undefined, // no filters
          { limit: 100, offset: 0 } // Load first 100 enrollments per student
        );
        return { studentId, enrollments: result.enrollments };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load enrollments for student ${studentId}:`, error);
        return { studentId, enrollments: [] };
      }
    });

    const results = await Promise.all(enrollmentPromises);

    for (const { studentId, enrollments } of results) {
      enrollmentsMap.set(studentId, enrollments);
    }

    return enrollmentsMap;
  }

  /**
   * Batch load enrollments by course IDs
   */
  private async batchLoadEnrollmentsByCourseIds(
    courseIds: string[]
  ): Promise<Map<string, Enrollment[]>> {
    const enrollmentsMap = new Map<string, Enrollment[]>();

    // Initialize empty arrays for all course IDs
    for (const courseId of courseIds) {
      enrollmentsMap.set(courseId, []);
    }

    // Load enrollments for each course individually
    const enrollmentPromises = courseIds.map(async (courseId) => {
      try {
        const result = await this.context.enrollmentRepository.findByCourse(
          courseId,
          undefined, // no filters
          { limit: 100, offset: 0 } // Load first 100 enrollments per course
        );
        return { courseId, enrollments: result.enrollments };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load enrollments for course ${courseId}:`, error);
        return { courseId, enrollments: [] };
      }
    });

    const results = await Promise.all(enrollmentPromises);

    for (const { courseId, enrollments } of results) {
      enrollmentsMap.set(courseId, enrollments);
    }

    return enrollmentsMap;
  }

  /**
   * Batch load enrollment progress by enrollment IDs
   */
  private async batchLoadEnrollmentProgress(
    enrollmentIds: string[]
  ): Promise<Map<string, EnrollmentProgressSummary>> {
    const progressMap = new Map<string, EnrollmentProgressSummary>();

    // Load progress for each enrollment individually using the service
    const progressPromises = enrollmentIds.map(async (enrollmentId) => {
      try {
        const progress = await this.context.enrollmentService.getEnrollmentProgress(enrollmentId);
        return { enrollmentId, progress };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load enrollment progress ${enrollmentId}:`, error);
        return { enrollmentId, progress: null };
      }
    });

    const results = await Promise.all(progressPromises);

    for (const { enrollmentId, progress } of results) {
      if (progress) {
        progressMap.set(enrollmentId, progress);
      }
    }

    return progressMap;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.enrollmentById.clearAll();
    this.enrollmentsByStudentId.clearAll();
    this.enrollmentsByCourseId.clearAll();
    this.enrollmentProgressById.clearAll();
  }

  /**
   * Prime cache with enrollment data
   */
  primeEnrollment(enrollment: Enrollment): void {
    this.enrollmentById.prime(enrollment.id, enrollment);
  }

  /**
   * Prime cache with enrollment progress data
   */
  primeEnrollmentProgress(enrollmentId: string, progress: EnrollmentProgressSummary): void {
    this.enrollmentProgressById.prime(enrollmentId, progress);
  }
}

/**
 * Factory function to create Enrollment DataLoaders
 */
export function createEnrollmentDataLoaders(
  context: EnrollmentDataLoaderContext
): EnrollmentDataLoaders {
  return new EnrollmentDataLoaders(context);
}
