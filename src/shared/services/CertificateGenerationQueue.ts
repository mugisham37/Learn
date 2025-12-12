/**
 * Certificate Generation Queue Implementation
 * 
 * Implements BullMQ queue for certificate generation jobs with PDF creation,
 * S3 upload, enrollment record updates, and email delivery.
 * 
 * Requirements: 14.3 - Certificate queue with moderate concurrency and retry logic
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

import { redis } from '../../infrastructure/cache/index.js';
import { 
  ICourseRepository 
} from '../../modules/courses/infrastructure/repositories/ICourseRepository.js';
import { 
  ICertificateGenerator,
  CertificateGenerationData
} from '../../modules/enrollments/application/services/ICertificateGenerator.js';
import { 
  Enrollment 
} from '../../modules/enrollments/domain/entities/Enrollment.js';
import { 
  ICertificateRepository 
} from '../../modules/enrollments/infrastructure/repositories/ICertificateRepository.js';
import { 
  IEnrollmentRepository 
} from '../../modules/enrollments/infrastructure/repositories/IEnrollmentRepository.js';
import { 
  INotificationService 
} from '../../modules/notifications/application/services/INotificationService.js';
import { 
  IUserProfileService 
} from '../../modules/users/application/services/IUserProfileService.js';
import { 
  IUserRepository 
} from '../../modules/users/infrastructure/repositories/IUserRepository.js';

import { 
  ExternalServiceError, 
  NotFoundError, 
  ValidationError 
} from '../errors/index.js';

import { IEmailService } from './IEmailService.js';
import { ServiceFactory } from './ServiceFactory.js';

import { logger } from '../utils/logger.js';

/**
 * Certificate generation job data interface
 */
export interface CertificateGenerationJobData {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  instructorId: string;
  completionDate: Date;
  grade?: string;
  creditsEarned?: number;
  priority?: 'normal' | 'high' | 'urgent';
  retryCount?: number;
  originalJobId?: string;
}

/**
 * Certificate generation result
 */
export interface CertificateGenerationResult {
  enrollmentId: string;
  certificateId: string;
  pdfUrl: string;
  emailSent: boolean;
  processingTimeMs: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Certificate Generation Queue Configuration
 */
const QUEUE_NAME = 'certificate-generation';
const QUEUE_OPTIONS: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Maximum retry attempts per requirement 14.3
    backoff: {
      type: 'exponential',
      delay: 3000,         // Start with 3 second delay
    },
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: redis,
  concurrency: 5,        // Moderate concurrency per requirement 14.3
  maxStalledCount: 2,    // Maximum stalled jobs before failing
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
};

/**
 * Certificate Generation Queue Implementation
 * 
 * Manages certificate generation jobs using BullMQ with comprehensive error handling,
 * retry logic, PDF generation, S3 upload, and email delivery.
 */
export class CertificateGenerationQueue {
  private queue: Queue<CertificateGenerationJobData>;
  private worker: Worker<CertificateGenerationJobData>;
  private emailService: IEmailService;
  private isInitialized = false;

  constructor(
    private readonly certificateGenerator: ICertificateGenerator,
    private readonly enrollmentRepository: IEnrollmentRepository,
    private readonly certificateRepository: ICertificateRepository,
    private readonly userRepository: IUserRepository,
    private readonly userProfileService: IUserProfileService,
    private readonly courseRepository: ICourseRepository,
    private readonly notificationService?: INotificationService
  ) {
    this.emailService = ServiceFactory.getEmailService();
    this.queue = new Queue<CertificateGenerationJobData>(QUEUE_NAME, QUEUE_OPTIONS);
    this.worker = new Worker<CertificateGenerationJobData>(
      QUEUE_NAME,
      this.processCertificateJob.bind(this),
      WORKER_OPTIONS
    );

    this.setupEventListeners();
  }

  /**
   * Initializes the queue and worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test Redis connection
      await redis.ping();
      
      logger.info('Certificate generation queue initialized', {
        queueName: QUEUE_NAME,
        concurrency: WORKER_OPTIONS.concurrency,
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize certificate generation queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ExternalServiceError(
        'CertificateGenerationQueue',
        'Failed to initialize queue',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Adds a certificate generation job to the queue
   */
  async addCertificateGenerationJob(
    data: CertificateGenerationJobData,
    options?: JobsOptions
  ): Promise<Job<CertificateGenerationJobData>> {
    try {
      logger.info('Adding certificate generation job to queue', {
        enrollmentId: data.enrollmentId,
        studentId: data.studentId,
        courseId: data.courseId,
      });

      // Validate job data
      this.validateJobData(data);

      const job = await this.queue.add(
        'generate-certificate',
        data,
        {
          ...options,
          priority: this.getPriorityValue(data.priority || 'normal'),
          delay: options?.delay || 0,
          jobId: `certificate-${data.enrollmentId}-${Date.now()}`,
        }
      );

      logger.info('Certificate generation job added successfully', {
        jobId: job.id,
        enrollmentId: data.enrollmentId,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add certificate generation job', {
        enrollmentId: data.enrollmentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'CertificateGenerationQueue',
        'Failed to add job to queue',
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
    data?: CertificateGenerationJobData;
    result?: CertificateGenerationResult;
    failedReason?: string;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        status: await job.getState(),
        progress: typeof job.progress === 'number' ? job.progress : 0,
        data: job.data,
        result: job.returnvalue as CertificateGenerationResult,
        failedReason: job.failedReason,
        processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
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
   * Gets queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error('Failed to get certificate queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Gracefully shuts down the queue and worker
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down certificate generation queue...');

      // Close worker first to stop processing new jobs
      await this.worker.close();
      
      // Close queue
      await this.queue.close();

      logger.info('Certificate generation queue shut down successfully');
    } catch (error) {
      logger.error('Error during certificate queue shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Processes a certificate generation job
   */
  private async processCertificateJob(job: Job<CertificateGenerationJobData>): Promise<CertificateGenerationResult> {
    const startTime = Date.now();
    const { enrollmentId, studentId, courseId, instructorId, completionDate, grade, creditsEarned } = job.data;

    try {
      logger.info('Processing certificate generation job', {
        jobId: job.id,
        enrollmentId,
        studentId,
        courseId,
        attempt: job.attemptsMade + 1,
      });

      // Update job progress
      await job.updateProgress(10);

      // Validate enrollment exists and is completed
      const enrollment = await this.enrollmentRepository.findById(enrollmentId);
      if (!enrollment) {
        throw new NotFoundError(`Enrollment not found: ${enrollmentId}`);
      }

      if (enrollment.status !== 'completed') {
        throw new ValidationError(`Enrollment must be completed to generate certificate: ${enrollmentId}`);
      }

      await job.updateProgress(20);

      // Get student information
      const student = await this.userRepository.findById(studentId);
      if (!student) {
        throw new NotFoundError(`Student not found: ${studentId}`);
      }

      // Get student profile for full name
      const studentProfile = await this.userProfileService.getUserProfile(studentId);
      if (!studentProfile) {
        throw new NotFoundError(`Student profile not found: ${studentId}`);
      }

      await job.updateProgress(30);

      // Get course information
      const course = await this.courseRepository.findById(courseId);
      if (!course) {
        throw new NotFoundError(`Course not found: ${courseId}`);
      }

      // Get instructor information
      const instructor = await this.userRepository.findById(instructorId);
      if (!instructor) {
        throw new NotFoundError(`Instructor not found: ${instructorId}`);
      }

      const instructorProfile = await this.userProfileService.getUserProfile(instructorId);
      if (!instructorProfile) {
        throw new NotFoundError(`Instructor profile not found: ${instructorId}`);
      }

      await job.updateProgress(40);

      // Check if certificate already exists
      const existingCertificate = await this.certificateRepository.findByEnrollment(enrollmentId);
      if (existingCertificate) {
        logger.warn('Certificate already exists for enrollment', {
          enrollmentId,
          certificateId: existingCertificate.certificateId,
        });

        // Return existing certificate info
        const processingTimeMs = Date.now() - startTime;
        return {
          enrollmentId,
          certificateId: existingCertificate.certificateId,
          pdfUrl: existingCertificate.pdfUrl,
          emailSent: false, // Don't resend email for existing certificate
          processingTimeMs,
          status: 'completed',
        };
      }

      await job.updateProgress(50);

      // Prepare certificate generation data
      const certificateData: CertificateGenerationData = {
        studentName: studentProfile.fullName,
        courseTitle: course.title,
        instructorName: instructorProfile.fullName,
        completionDate,
        grade,
        creditsEarned,
      };

      // Convert database record to domain entity
      const enrollmentEntity = Enrollment.fromDatabase({
        ...enrollment,
        completedAt: enrollment.completedAt ?? undefined,
        progressPercentage: parseFloat(enrollment.progressPercentage),
      });
      
      // Generate certificate with PDF
      const certificate = await this.certificateGenerator.generateCertificate(enrollmentEntity, certificateData);

      await job.updateProgress(70);

      // Save certificate to database
      await this.certificateRepository.create({
        enrollmentId: certificate.enrollmentId,
        certificateId: certificate.certificateId,
        pdfUrl: certificate.pdfUrl,
        verificationUrl: certificate.verificationUrl,
        metadata: certificate.metadata,
      });

      await job.updateProgress(80);

      // Update enrollment record with certificate ID
      await this.enrollmentRepository.update(enrollmentId, {
        certificateId: certificate.id,
      });

      await job.updateProgress(90);

      // Send certificate via email
      let emailSent = false;
      try {
        await this.sendCertificateEmail(certificate, student.email, studentProfile.fullName, course.title);
        emailSent = true;
      } catch (emailError) {
        logger.error('Failed to send certificate email', {
          enrollmentId,
          certificateId: certificate.certificateId,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
        // Don't fail the job if email fails, just log it
      }

      await job.updateProgress(95);

      // Send notification
      if (this.notificationService) {
        try {
          await this.notificationService.createNotification({
            recipientId: studentId,
            notificationType: 'certificate_issued',
            title: 'Certificate Issued',
            content: `Your certificate for "${course.title}" has been generated and is ready for download.`,
            actionUrl: certificate.verificationUrl,
            priority: 'high',
            metadata: {
              certificateId: certificate.certificateId,
              courseId,
              courseTitle: course.title,
            },
          });
        } catch (notificationError) {
          logger.error('Failed to send certificate notification', {
            enrollmentId,
            certificateId: certificate.certificateId,
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          });
          // Don't fail the job if notification fails
        }
      }

      await job.updateProgress(100);

      const processingTimeMs = Date.now() - startTime;

      logger.info('Certificate generation job completed', {
        jobId: job.id,
        enrollmentId,
        certificateId: certificate.certificateId,
        emailSent,
        processingTimeMs,
      });

      return {
        enrollmentId,
        certificateId: certificate.certificateId,
        pdfUrl: certificate.pdfUrl,
        emailSent,
        processingTimeMs,
        status: 'completed',
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      logger.error('Certificate generation job failed', {
        jobId: job.id,
        enrollmentId,
        attempt: job.attemptsMade + 1,
        processingTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Sends certificate via email
   */
  private async sendCertificateEmail(
    certificate: {
      certificateId: string;
      issuedAt: Date;
      verificationUrl: string;
      pdfUrl: string;
    },
    recipientEmail: string,
    recipientName: string,
    courseTitle: string
  ): Promise<void> {
    try {
      await this.emailService.sendTransactional({
        to: recipientEmail,
        templateId: 'certificate-issued',
        templateData: {
          recipientName,
          courseTitle,
          certificateId: certificate.certificateId,
          issuedDate: certificate.issuedAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          verificationUrl: certificate.verificationUrl,
          downloadUrl: certificate.pdfUrl,
          actionButtonText: 'Download Certificate',
        },
        priority: 'high',
      });

      logger.info('Certificate email sent successfully', {
        certificateId: certificate.certificateId,
        recipientEmail,
      });
    } catch (error) {
      logger.error('Failed to send certificate email', {
        certificateId: certificate.certificateId,
        recipientEmail,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validates job data before processing
   */
  private validateJobData(data: CertificateGenerationJobData): void {
    if (!data.enrollmentId) {
      throw new ValidationError('Enrollment ID is required');
    }
    if (!data.studentId) {
      throw new ValidationError('Student ID is required');
    }
    if (!data.courseId) {
      throw new ValidationError('Course ID is required');
    }
    if (!data.instructorId) {
      throw new ValidationError('Instructor ID is required');
    }
    if (!data.completionDate) {
      throw new ValidationError('Completion date is required');
    }
    if (data.completionDate > new Date()) {
      throw new ValidationError('Completion date cannot be in the future');
    }
  }

  /**
   * Convert priority string to numeric value for BullMQ
   */
  private getPriorityValue(priority: 'normal' | 'high' | 'urgent'): number {
    switch (priority) {
      case 'urgent':
        return 1; // Highest priority
      case 'high':
        return 3;
      case 'normal':
      default:
        return 5; // Normal priority
    }
  }

  /**
   * Sets up event listeners for queue and worker
   */
  private setupEventListeners(): void {
    // Queue events
    this.queue.on('error', (error) => {
      logger.error('Certificate generation queue error', {
        error: error.message,
      });
    });

    // Worker events
    this.worker.on('completed', (job, result: CertificateGenerationResult) => {
      logger.info('Certificate generation job completed', {
        jobId: job.id,
        enrollmentId: result.enrollmentId,
        certificateId: result.certificateId,
        emailSent: result.emailSent,
        processingTimeMs: result.processingTimeMs,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Certificate generation job failed', {
        jobId: job?.id,
        enrollmentId: job?.data?.enrollmentId,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Certificate generation job stalled', { jobId });
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug('Certificate generation job progress', {
        jobId: job.id,
        enrollmentId: job.data.enrollmentId,
        progress,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Certificate generation worker error', {
        error: error.message,
      });
    });
  }
}

// Global instance management
let certificateGenerationQueueInstance: CertificateGenerationQueue | null = null;

/**
 * Get the global certificate generation queue instance
 */
export function getCertificateGenerationQueue(): CertificateGenerationQueue {
  if (!certificateGenerationQueueInstance) {
    throw new Error('CertificateGenerationQueue not initialized. Call initializeCertificateGenerationQueue first.');
  }
  return certificateGenerationQueueInstance;
}

/**
 * Initialize certificate generation queue (call this during application startup)
 */
export async function initializeCertificateGenerationQueue(
  certificateGenerator: ICertificateGenerator,
  enrollmentRepository: IEnrollmentRepository,
  certificateRepository: ICertificateRepository,
  userRepository: IUserRepository,
  userProfileService: IUserProfileService,
  courseRepository: ICourseRepository,
  notificationService?: INotificationService
): Promise<CertificateGenerationQueue> {
  if (certificateGenerationQueueInstance) {
    logger.warn('CertificateGenerationQueue already initialized');
    return certificateGenerationQueueInstance;
  }

  certificateGenerationQueueInstance = new CertificateGenerationQueue(
    certificateGenerator,
    enrollmentRepository,
    certificateRepository,
    userRepository,
    userProfileService,
    courseRepository,
    notificationService
  );

  await certificateGenerationQueueInstance.initialize();
  
  logger.info('Certificate generation queue initialized successfully');
  return certificateGenerationQueueInstance;
}

/**
 * Shutdown certificate generation queue (call this during application shutdown)
 */
export async function shutdownCertificateGenerationQueue(): Promise<void> {
  if (certificateGenerationQueueInstance) {
    await certificateGenerationQueueInstance.shutdown();
    certificateGenerationQueueInstance = null;
    logger.info('Certificate generation queue shut down successfully');
  }
}