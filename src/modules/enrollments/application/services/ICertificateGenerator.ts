/**
 * Certificate Generator Service Interface
 * 
 * Defines the contract for certificate generation operations including
 * PDF creation, S3 upload, and verification URL generation.
 * 
 * Requirements: 5.6, 5.7
 */

import { Certificate } from '../../domain/entities/Certificate.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';

/**
 * Certificate generation data
 */
export interface CertificateGenerationData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  completionDate: Date;
  grade?: string;
  creditsEarned?: number;
}

/**
 * Certificate Generator Service Interface
 * 
 * Provides methods for generating certificates, creating PDFs,
 * and uploading to S3 storage.
 */
export interface ICertificateGenerator {
  /**
   * Generates a complete certificate for an enrollment
   * 
   * @param enrollment - The enrollment to generate certificate for
   * @param data - Certificate generation data
   * @returns Generated certificate with PDF URL
   * @throws ValidationError if enrollment is not eligible for certificate
   * @throws ExternalServiceError if PDF generation or S3 upload fails
   */
  generateCertificate(enrollment: Enrollment, data: CertificateGenerationData): Promise<Certificate>;

  /**
   * Creates a PDF certificate document
   * 
   * @param certificate - Certificate entity with metadata
   * @returns PDF buffer
   * @throws ExternalServiceError if PDF generation fails
   */
  createPDF(certificate: Certificate): Promise<Buffer>;

  /**
   * Uploads certificate PDF to S3
   * 
   * @param pdf - PDF buffer
   * @param certificateId - Unique certificate identifier
   * @returns S3 URL of uploaded PDF
   * @throws ExternalServiceError if S3 upload fails
   */
  uploadToS3(pdf: Buffer, certificateId: string): Promise<string>;

  /**
   * Generates verification URL for certificate
   * 
   * @param certificateId - Unique certificate identifier
   * @returns Verification URL
   */
  generateVerificationUrl(certificateId: string): string;
}