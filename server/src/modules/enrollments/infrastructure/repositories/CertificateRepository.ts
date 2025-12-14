/**
 * Certificate Repository Implementation
 *
 * Implements certificate data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 5.6, 5.7
 */

import { eq, and, desc, count, sql, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { courses } from '../../../../infrastructure/database/schema/courses.schema.js';
import {
  certificates,
  Certificate,
  NewCertificate,
  enrollments,
} from '../../../../infrastructure/database/schema/enrollments.schema.js';
import { users, userProfiles } from '../../../../infrastructure/database/schema/users.schema.js';
// eslint-disable-next-line import/order
import { DatabaseError, ConflictError, NotFoundError } from '../../../../shared/errors/index.js';

import {
  ICertificateRepository,
  CreateCertificateDTO,
  UpdateCertificateDTO,
  CertificatePaginationDTO,
  PaginatedCertificateResult,
  CertificateFilterDTO,
} from './ICertificateRepository.js';

/**
 * Certificate Repository Implementation
 *
 * Provides data access methods for certificate entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 */
export class CertificateRepository implements ICertificateRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for certificate by ID
   */
  private getCertificateCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'certificate', 'id', id);
  }

  /**
   * Builds cache key for certificate by certificate ID
   */
  private getCertificateByCertificateIdCacheKey(certificateId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'certificate', 'cert-id', certificateId);
  }

  /**
   * Builds cache key for certificate by enrollment
   */
  private getCertificateByEnrollmentCacheKey(enrollmentId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'certificate', 'enrollment', enrollmentId);
  }

  /**
   * Builds cache key for certificate verification
   */
  private getCertificateVerificationCacheKey(certificateId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'certificate', 'verification', certificateId);
  }

  /**
   * Builds WHERE conditions from filters
   */
  private buildWhereConditions(filters?: CertificateFilterDTO): unknown[] {
    const conditions = [];

    if (filters?.enrollmentId) {
      conditions.push(eq(certificates.enrollmentId, filters.enrollmentId));
    }

    if (filters?.issuedAfter) {
      conditions.push(gte(certificates.issuedAt, filters.issuedAfter));
    }

    if (filters?.issuedBefore) {
      conditions.push(lte(certificates.issuedAt, filters.issuedBefore));
    }

    return conditions;
  }

  /**
   * Creates a new certificate in the database
   *
   * Validates enrollment uniqueness before insertion.
   *
   * @param data - Certificate creation data
   * @returns The created certificate
   * @throws ConflictError if certificate already exists for the enrollment
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateCertificateDTO): Promise<Certificate> {
    try {
      // Check for existing certificate for this enrollment
      const existingCertificate = await this.findByEnrollment(data.enrollmentId);
      if (existingCertificate) {
        throw new ConflictError('Certificate already exists for this enrollment', 'enrollmentId');
      }

      // Check for existing certificate with same certificate ID
      const existingCertificateId = await this.findByCertificateId(data.certificateId);
      if (existingCertificateId) {
        throw new ConflictError('Certificate ID already exists', 'certificateId');
      }

      // Prepare certificate data for insertion
      const newCertificate: NewCertificate = {
        enrollmentId: data.enrollmentId,
        certificateId: data.certificateId,
        pdfUrl: data.pdfUrl,
        verificationUrl: data.verificationUrl,
        metadata: data.metadata,
      };

      // Insert certificate into database
      const [createdCertificate] = await this.writeDb
        .insert(certificates)
        .values(newCertificate)
        .returning();

      if (!createdCertificate) {
        throw new DatabaseError('Failed to create certificate', 'insert');
      }

      return createdCertificate;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError('Certificate already exists', 'enrollmentId_or_certificateId');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create certificate',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a certificate by its unique ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param id - Certificate ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Certificate | null> {
    try {
      // Check cache first
      const cacheKey = this.getCertificateCacheKey(id);
      const cachedCertificate = await cache.get<Certificate>(cacheKey);

      if (cachedCertificate) {
        return cachedCertificate;
      }

      // Query database if not in cache
      const [certificate] = await this.readDb
        .select()
        .from(certificates)
        .where(eq(certificates.id, id))
        .limit(1);

      if (!certificate) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, certificate, CacheTTL.MEDIUM);

      return certificate;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find certificate by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a certificate by its certificate ID (public identifier)
   *
   * Implements caching with 5-minute TTL.
   *
   * @param certificateId - Certificate public ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByCertificateId(certificateId: string): Promise<Certificate | null> {
    try {
      // Check cache first
      const cacheKey = this.getCertificateByCertificateIdCacheKey(certificateId);
      const cachedCertificate = await cache.get<Certificate>(cacheKey);

      if (cachedCertificate) {
        return cachedCertificate;
      }

      // Query database if not in cache
      const [certificate] = await this.readDb
        .select()
        .from(certificates)
        .where(eq(certificates.certificateId, certificateId))
        .limit(1);

      if (!certificate) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both certificate ID and internal ID for consistency
      await Promise.all([
        cache.set(cacheKey, certificate, CacheTTL.MEDIUM),
        cache.set(this.getCertificateCacheKey(certificate.id), certificate, CacheTTL.MEDIUM),
      ]);

      return certificate;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find certificate by certificate ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a certificate by enrollment ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param enrollmentId - Enrollment ID
   * @returns The certificate if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByEnrollment(enrollmentId: string): Promise<Certificate | null> {
    try {
      // Check cache first
      const cacheKey = this.getCertificateByEnrollmentCacheKey(enrollmentId);
      const cachedCertificate = await cache.get<Certificate>(cacheKey);

      if (cachedCertificate) {
        return cachedCertificate;
      }

      // Query database if not in cache
      const [certificate] = await this.readDb
        .select()
        .from(certificates)
        .where(eq(certificates.enrollmentId, enrollmentId))
        .limit(1);

      if (!certificate) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both enrollment ID and internal ID for consistency
      await Promise.all([
        cache.set(cacheKey, certificate, CacheTTL.MEDIUM),
        cache.set(this.getCertificateCacheKey(certificate.id), certificate, CacheTTL.MEDIUM),
      ]);

      return certificate;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find certificate by enrollment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds certificates issued within a date range
   *
   * @param filters - Filter options
   * @param pagination - Pagination parameters
   * @returns Paginated list of certificates
   * @throws DatabaseError if database operation fails
   */
  async findByDateRange(
    filters?: CertificateFilterDTO,
    pagination?: CertificatePaginationDTO
  ): Promise<PaginatedCertificateResult> {
    try {
      const limit = pagination?.limit || 20;
      const offset = pagination?.offset || 0;

      // Build WHERE conditions
      const conditions = this.buildWhereConditions(filters);

      // Build WHERE clause once
      const whereClause =
        conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

      // Get total count
      const countResult = await this.readDb
        .select({ totalCount: count() })
        .from(certificates)
        .where(whereClause);

      const totalCount = countResult[0]?.totalCount || 0;

      // Get certificates with pagination
      const certificateList = await this.readDb
        .select()
        .from(certificates)
        .where(whereClause)
        .orderBy(desc(certificates.issuedAt))
        .limit(limit)
        .offset(offset);

      const result: PaginatedCertificateResult = {
        certificates: certificateList,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      };

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find certificates by date range',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a certificate's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Certificate ID
   * @param data - Update data
   * @returns The updated certificate
   * @throws NotFoundError if certificate doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateCertificateDTO): Promise<Certificate> {
    try {
      // First, verify certificate exists
      const existingCertificate = await this.findById(id);
      if (!existingCertificate) {
        throw new NotFoundError('Certificate', id);
      }

      // Prepare update data
      const updateData: Partial<NewCertificate> = {
        ...data,
      };

      // Update certificate in database
      const [updatedCertificate] = await this.writeDb
        .update(certificates)
        .set(updateData)
        .where(eq(certificates.id, id))
        .returning();

      if (!updatedCertificate) {
        throw new DatabaseError('Failed to update certificate', 'update');
      }

      // Invalidate all cache entries for this certificate
      await this.invalidateCache(id);
      await this.invalidateCacheByCertificateId(existingCertificate.certificateId);
      await this.invalidateCacheByEnrollment(existingCertificate.enrollmentId);

      return updatedCertificate;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update certificate',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a certificate from the database
   * USE WITH CAUTION - This is irreversible
   *
   * Invalidates all cache entries after successful deletion.
   *
   * @param id - Certificate ID
   * @returns void
   * @throws NotFoundError if certificate doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get certificate before deletion for cache invalidation
      const existingCertificate = await this.findById(id);
      if (!existingCertificate) {
        throw new NotFoundError('Certificate', id);
      }

      // Delete certificate
      const result = await this.writeDb
        .delete(certificates)
        .where(eq(certificates.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete certificate', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByCertificateId(existingCertificate.certificateId);
      await this.invalidateCacheByEnrollment(existingCertificate.enrollmentId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete certificate',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a certificate exists for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns True if certificate exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async existsByEnrollment(enrollmentId: string): Promise<boolean> {
    try {
      const certificate = await this.findByEnrollment(enrollmentId);
      return certificate !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check certificate existence by enrollment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a certificate ID is already in use
   *
   * @param certificateId - Certificate public ID
   * @returns True if certificate ID exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async existsByCertificateId(certificateId: string): Promise<boolean> {
    try {
      const certificate = await this.findByCertificateId(certificateId);
      return certificate !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check certificate existence by certificate ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the count of certificates issued within a date range
   *
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @returns Number of certificates issued
   * @throws DatabaseError if database operation fails
   */
  async getIssuedCount(startDate: Date, endDate: Date): Promise<number> {
    try {
      const countResult = await this.readDb
        .select({ issuedCount: count() })
        .from(certificates)
        .where(and(gte(certificates.issuedAt, startDate), lte(certificates.issuedAt, endDate)));

      return countResult[0]?.issuedCount || 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get issued certificate count',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds certificates that need to be regenerated
   * (e.g., due to template changes or corrections)
   *
   * This is a placeholder implementation. In a real system, you might have
   * a flag or metadata field indicating regeneration is needed.
   *
   * @param limit - Maximum number of certificates to return
   * @returns List of certificates that need regeneration
   * @throws DatabaseError if database operation fails
   */
  async findPendingRegeneration(_limit: number = 50): Promise<Certificate[]> {
    try {
      // This is a placeholder - in reality you'd have specific criteria
      // For now, return empty array as no certificates need regeneration
      return await Promise.resolve([]);
    } catch (error) {
      throw new DatabaseError(
        'Failed to find certificates pending regeneration',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verifies a certificate by its certificate ID
   * Returns certificate details for verification purposes
   *
   * @param certificateId - Certificate public ID
   * @returns Certificate with enrollment and course details, null if not found
   * @throws DatabaseError if database operation fails
   */
  async verifyCertificate(certificateId: string): Promise<{
    certificate: Certificate;
    studentName: string;
    courseTitle: string;
    completionDate: Date;
    instructorName: string;
  } | null> {
    try {
      // Check cache first
      const cacheKey = this.getCertificateVerificationCacheKey(certificateId);
      const cachedVerification = await cache.get<{
        certificate: Certificate;
        studentName: string;
        courseTitle: string;
        completionDate: Date;
        instructorName: string;
      }>(cacheKey);

      if (cachedVerification) {
        return cachedVerification;
      }

      // Complex query joining certificate with enrollment, course, and user data
      const [result] = await this.readDb
        .select({
          certificate: certificates,
          studentName: userProfiles.fullName,
          courseTitle: courses.title,
          completionDate: enrollments.completedAt,
          instructorName: sql<string>`instructor_profile.full_name`,
        })
        .from(certificates)
        .innerJoin(enrollments, eq(certificates.enrollmentId, enrollments.id))
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .innerJoin(users, eq(enrollments.studentId, users.id))
        .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
        .innerJoin(sql`users AS instructor`, eq(courses.instructorId, sql`instructor.id`))
        .innerJoin(
          sql`user_profiles AS instructor_profile`,
          eq(sql`instructor.id`, sql`instructor_profile.user_id`)
        )
        .where(eq(certificates.certificateId, certificateId))
        .limit(1);

      if (!result || !result.completionDate) {
        return null;
      }

      const verification = {
        certificate: result.certificate,
        studentName: result.studentName,
        courseTitle: result.courseTitle,
        completionDate: result.completionDate,
        instructorName: result.instructorName,
      };

      // Cache the result with longer TTL since certificate verification data rarely changes
      await cache.set(cacheKey, verification, CacheTTL.LONG);

      return verification;
    } catch (error) {
      throw new DatabaseError(
        'Failed to verify certificate',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific certificate
   *
   * Removes all cache entries related to the certificate by ID.
   * Should be called after any update operation.
   *
   * @param id - Certificate ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getCertificateCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for certificate ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for certificate by certificate ID
   *
   * Removes all cache entries related to the certificate by certificate ID.
   * Should be called after operations that affect certificate lookups.
   *
   * @param certificateId - Certificate public ID
   * @returns void
   */
  async invalidateCacheByCertificateId(certificateId: string): Promise<void> {
    try {
      const patterns = [
        this.getCertificateByCertificateIdCacheKey(certificateId),
        this.getCertificateVerificationCacheKey(certificateId),
      ];

      await Promise.all(patterns.map((pattern) => cache.delete(pattern)));
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for certificate ID ${certificateId}:`, error);
    }
  }

  /**
   * Invalidates cache for certificate by enrollment
   *
   * Removes all cache entries related to the enrollment's certificate.
   * Should be called after operations that affect enrollment certificates.
   *
   * @param enrollmentId - Enrollment ID
   * @returns void
   */
  async invalidateCacheByEnrollment(enrollmentId: string): Promise<void> {
    try {
      const cacheKey = this.getCertificateByEnrollmentCacheKey(enrollmentId);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(
        `Failed to invalidate cache for enrollment certificate ${enrollmentId}:`,
        error
      );
    }
  }
}
