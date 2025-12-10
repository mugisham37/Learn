/**
 * Certificate Repository Interface
 * 
 * Defines the contract for certificate data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 * 
 * Requirements: 5.6, 5.7
 */

import { Certificate } from '../../../../infrastructure/database/schema/enrollments.schema.js';

/**
 * Data Transfer Object for creating a new certificate
 */
export interface CreateCertificateDTO {
  enrollmentId: string;
  certificateId: string;
  pdfUrl: string;
  verificationUrl: string;
  metadata?: Record<string, unknown>;
}

/**
 * Data Transfer Object for updating a certificate
 */
export interface UpdateCertificateDTO {
  pdfUrl?: string;
  verificationUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pagination parameters for certificate queries
 */
export interface CertificatePaginationDTO {
  limit: number;
  offset: number;
}

/**
 * Paginated result for certificate queries
 */
export interface PaginatedCertificateResult {
  certificates: Certificate[];
  total: number;
  hasMore: boolean;
}

/**
 * Filter options for certificate queries
 */
export interface CertificateFilterDTO {
  enrollmentId?: string;
  issuedAfter?: Date;
  issuedBefore?: Date;
}

/**
 * Certificate Repository Interface
 * 
 * Provides methods for all certificate data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface ICertificateRepository {
  /**
   * Creates a new certificate in the database
   * 
   * @param data - Certificate creation data
   * @returns The created certificate
   * @throws ConflictError if certificate already exists for the enrollment
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateCertificateDTO): Promise<Certificate>;

  /**
   * Finds a certificate by its unique ID
   * 
   * @param id - Certificate ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Certificate | null>;

  /**
   * Finds a certificate by its certificate ID (public identifier)
   * 
   * @param certificateId - Certificate public ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByCertificateId(certificateId: string): Promise<Certificate | null>;

  /**
   * Finds a certificate by enrollment ID
   * 
   * @param enrollmentId - Enrollment ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByEnrollment(enrollmentId: string): Promise<Certificate | null>;

  /**
   * Finds certificates issued within a date range
   * 
   * @param filters - Filter options
   * @param pagination - Pagination parameters
   * @returns Paginated list of certificates
   * @throws DatabaseError if database operation fails
   */
  findByDateRange(
    filters?: CertificateFilterDTO,
    pagination?: CertificatePaginationDTO
  ): Promise<PaginatedCertificateResult>;

  /**
   * Updates a certificate's data
   * 
   * @param id - Certificate ID
   * @param data - Update data
   * @returns The updated certificate
   * @throws NotFoundError if certificate doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateCertificateDTO): Promise<Certificate>;

  /**
   * Deletes a certificate from the database
   * USE WITH CAUTION - This is irreversible
   * 
   * @param id - Certificate ID
   * @returns void
   * @throws NotFoundError if certificate doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if a certificate exists for an enrollment
   * 
   * @param enrollmentId - Enrollment ID
   * @returns True if certificate exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  existsByEnrollment(enrollmentId: string): Promise<boolean>;

  /**
   * Checks if a certificate ID is already in use
   * 
   * @param certificateId - Certificate public ID
   * @returns True if certificate ID exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  existsByCertificateId(certificateId: string): Promise<boolean>;

  /**
   * Gets the count of certificates issued within a date range
   * 
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Number of certificates issued
   * @throws DatabaseError if database operation fails
   */
  getIssuedCount(startDate: Date, endDate: Date): Promise<number>;

  /**
   * Finds certificates that need to be regenerated
   * (e.g., due to template changes or corrections)
   * 
   * @param limit - Maximum number of certificates to return
   * @returns List of certificates that need regeneration
   * @throws DatabaseError if database operation fails
   */
  findPendingRegeneration(limit?: number): Promise<Certificate[]>;

  /**
   * Verifies a certificate by its certificate ID
   * Returns certificate details for verification purposes
   * 
   * @param certificateId - Certificate public ID
   * @returns Certificate with enrollment and course details, null if not found
   * @throws DatabaseError if database operation fails
   */
  verifyCertificate(certificateId: string): Promise<{
    certificate: Certificate;
    studentName: string;
    courseTitle: string;
    completionDate: Date;
    instructorName: string;
  } | null>;

  /**
   * Invalidates cache for a specific certificate
   * Should be called after any update operation
   * 
   * @param id - Certificate ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for certificate by certificate ID
   * Should be called after operations that affect certificate lookups
   * 
   * @param certificateId - Certificate public ID
   * @returns void
   */
  invalidateCacheByCertificateId(certificateId: string): Promise<void>;

  /**
   * Invalidates cache for certificate by enrollment
   * Should be called after operations that affect enrollment certificates
   * 
   * @param enrollmentId - Enrollment ID
   * @returns void
   */
  invalidateCacheByEnrollment(enrollmentId: string): Promise<void>;
}