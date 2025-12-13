/**
 * Certificate Queue Service
 *
 * Provides a service layer for queuing certificate generation jobs.
 * Acts as a bridge between the enrollment service and the certificate generation queue.
 *
 * Requirements: 14.3 - Certificate generation queue integration
 */

import { ValidationError, ExternalServiceError } from '../../../../shared/errors/index.js';
import {
  getCertificateGenerationQueue,
  CertificateGenerationJobData,
} from '../../../../shared/services/CertificateGenerationQueue.js';
import { logger } from '../../../../shared/utils/logger.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';

/**
 * Certificate Queue Service Interface
 */
export interface ICertificateQueueService {
  /**
   * Queues a certificate generation job for a completed enrollment
   *
   * @param enrollment - The completed enrollment
   * @param instructorId - ID of the course instructor
   * @param grade - Optional grade for the certificate
   * @param creditsEarned - Optional credits earned
   * @returns Promise resolving to the job ID
   */
  queueCertificateGeneration(
    enrollment: Enrollment,
    instructorId: string,
    grade?: string,
    creditsEarned?: number
  ): Promise<string>;

  /**
   * Gets the status of a certificate generation job
   *
   * @param jobId - The job ID
   * @returns Promise resolving to job status or null if not found
   */
  getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: unknown;
    error?: string;
  } | null>;
}

/**
 * Certificate Queue Service Implementation
 *
 * Handles queuing certificate generation jobs and provides status tracking.
 */
export class CertificateQueueService implements ICertificateQueueService {
  /**
   * Queues a certificate generation job for a completed enrollment
   */
  async queueCertificateGeneration(
    enrollment: Enrollment,
    instructorId: string,
    grade?: string,
    creditsEarned?: number
  ): Promise<string> {
    try {
      // Validate enrollment is eligible for certificate generation
      this.validateEnrollmentEligibility(enrollment);

      // Get the certificate generation queue
      const queue = getCertificateGenerationQueue();

      // Prepare job data
      const jobData: CertificateGenerationJobData = {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        instructorId,
        completionDate: enrollment.completedAt || new Date(),
        grade,
        creditsEarned,
        priority: 'normal',
      };

      // Add job to queue
      const job = await queue.addCertificateGenerationJob(jobData);

      logger.info('Certificate generation job queued successfully', {
        jobId: job.id,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
      });

      return job.id!;
    } catch (error) {
      logger.error('Failed to queue certificate generation job', {
        enrollmentId: enrollment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'CertificateQueueService',
        'Failed to queue certificate generation',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Gets the status of a certificate generation job
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: unknown;
    error?: string;
  } | null> {
    try {
      const queue = getCertificateGenerationQueue();
      const jobStatus = await queue.getJobStatus(jobId);

      if (!jobStatus) {
        return null;
      }

      return {
        status: jobStatus.status,
        progress: jobStatus.progress,
        result: jobStatus.result,
        error: jobStatus.failedReason,
      };
    } catch (error) {
      logger.error('Failed to get certificate job status', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return null;
    }
  }

  /**
   * Validates that enrollment is eligible for certificate generation
   */
  private validateEnrollmentEligibility(enrollment: Enrollment): void {
    if (enrollment.status !== 'completed') {
      throw new ValidationError('Enrollment must be completed to generate certificate', [
        { field: 'enrollment.status', message: 'Enrollment status must be completed' },
      ]);
    }

    if (enrollment.progressPercentage < 100) {
      throw new ValidationError('Enrollment must be 100% complete to generate certificate', [
        { field: 'enrollment.progressPercentage', message: 'Progress must be 100%' },
      ]);
    }

    if (!enrollment.completedAt) {
      throw new ValidationError('Enrollment must have completion date to generate certificate', [
        { field: 'enrollment.completedAt', message: 'Completion date is required' },
      ]);
    }
  }
}
