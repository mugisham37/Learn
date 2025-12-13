/**
 * Certificate Generator Service Implementation
 *
 * Implements certificate generation operations including PDF creation,
 * S3 upload, and verification URL generation using PDFKit and QR codes.
 *
 * Requirements: 5.6, 5.7
 */

import PDFKit from 'pdfkit';
import * as QRCode from 'qrcode';

import { ValidationError, ExternalServiceError } from '../../../../shared/errors/index.js';
import { IS3Service } from '../../../../shared/services/IS3Service.js';
import { logger } from '../../../../shared/utils/logger.js';
import { Certificate } from '../../domain/entities/Certificate.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';

import { ICertificateGenerator, CertificateGenerationData } from './ICertificateGenerator.js';
import { PDFDocument, PDFDocumentOptions, QRCodeOptions } from './types/pdf.types.js';

/**
 * Certificate Generator Service Implementation
 *
 * Orchestrates certificate generation including PDF creation with QR codes,
 * S3 upload, and verification URL generation.
 */
export class CertificateGeneratorService implements ICertificateGenerator {
  private readonly baseUrl: string;

  constructor(private readonly s3Service: IS3Service) {
    this.baseUrl = process.env['APP_BASE_URL'] || 'https://platform.example.com';
  }

  /**
   * Generates a complete certificate for an enrollment
   *
   * Requirements: 5.6 - Certificate generation on completion
   */
  async generateCertificate(
    enrollment: Enrollment,
    data: CertificateGenerationData
  ): Promise<Certificate> {
    logger.info('Generating certificate for enrollment', {
      enrollmentId: enrollment.id,
      studentName: data.studentName,
      courseTitle: data.courseTitle,
    });

    // Validate enrollment is eligible for certificate
    this.validateEnrollmentEligibility(enrollment);

    // Create certificate entity
    const certificate = Certificate.create({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      studentName: data.studentName,
      courseTitle: data.courseTitle,
      instructorName: data.instructorName,
      completionDate: data.completionDate,
      grade: data.grade,
      creditsEarned: data.creditsEarned,
    });

    try {
      // Generate PDF
      const pdfBuffer = await this.createPDF(certificate);

      // Upload to S3
      const pdfUrl = await this.uploadToS3(pdfBuffer, certificate.certificateId);

      // Update certificate with PDF URL
      certificate.setPdfUrl(pdfUrl);

      logger.info('Certificate generated successfully', {
        enrollmentId: enrollment.id,
        certificateId: certificate.certificateId,
        pdfUrl,
      });

      return certificate;
    } catch (error) {
      logger.error('Failed to generate certificate', {
        enrollmentId: enrollment.id,
        certificateId: certificate.certificateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'Certificate Generator',
        'Failed to generate certificate',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Creates a PDF certificate document
   *
   * Requirements: 5.6 - PDF creation with student name, course title, completion date, instructor signature, QR code
   */
  async createPDF(certificate: Certificate): Promise<Buffer> {
    logger.info('Creating PDF for certificate', {
      certificateId: certificate.certificateId,
    });

    try {
      // Create PDF document
      const options: PDFDocumentOptions = {
        size: 'A4',
        layout: 'landscape',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      };
      const doc = new PDFKit(options) as PDFDocument;

      // Collect PDF data
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      // Generate QR code for verification
      const qrCodeOptions: QRCodeOptions = {
        width: 150,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      };
      const qrCodeDataUrl = await QRCode.toDataURL(certificate.getQRCodeData(), qrCodeOptions);

      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid QR code data URL format');
      }
      const qrCodeBuffer = Buffer.from(base64Data, 'base64');

      // Design certificate layout
      this.designCertificate(doc, certificate, qrCodeBuffer);

      // Finalize PDF
      doc.end();

      // Wait for PDF generation to complete
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          logger.info('PDF created successfully', {
            certificateId: certificate.certificateId,
            pdfSize: pdfBuffer.length,
          });
          resolve(pdfBuffer);
        });

        doc.on('error', (error: Error) => {
          logger.error('PDF generation failed', {
            certificateId: certificate.certificateId,
            error: error.message,
          });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to create PDF', {
        certificateId: certificate.certificateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'PDF Generator',
        'Failed to create PDF certificate',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Uploads certificate PDF to S3
   *
   * Requirements: 5.7 - Certificate PDF upload to S3
   */
  async uploadToS3(pdf: Buffer, certificateId: string): Promise<string> {
    logger.info('Uploading certificate PDF to S3', {
      certificateId,
      pdfSize: pdf.length,
    });

    try {
      const s3Key = `certificates/${certificateId}.pdf`;

      const uploadResult = await this.s3Service.uploadFile({
        key: s3Key,
        buffer: pdf,
        contentType: 'application/pdf',
        metadata: {
          certificateId,
          uploadedAt: new Date().toISOString(),
          contentType: 'certificate',
        },
      });

      logger.info('Certificate PDF uploaded successfully', {
        certificateId,
        s3Key,
        url: uploadResult.url,
      });

      return uploadResult.url;
    } catch (error) {
      logger.error('Failed to upload certificate PDF to S3', {
        certificateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'S3 Upload',
        'Failed to upload certificate PDF',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Generates verification URL for certificate
   *
   * Requirements: 5.7 - Generate verification URL with certificate ID
   */
  generateVerificationUrl(certificateId: string): string {
    return `${this.baseUrl}/certificates/verify/${certificateId}`;
  }

  /**
   * Designs the certificate PDF layout
   */
  private designCertificate(doc: PDFDocument, certificate: Certificate, qrCodeBuffer: Buffer): void {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;

    // Certificate border
    doc
      .rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin)
      .stroke('#2C3E50')
      .lineWidth(3);

    // Inner decorative border
    doc
      .rect(margin + 20, margin + 20, pageWidth - 2 * margin - 40, pageHeight - 2 * margin - 40)
      .stroke('#3498DB')
      .lineWidth(1);

    // Title
    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .fillColor('#2C3E50')
      .text('CERTIFICATE OF COMPLETION', margin, margin + 80, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // Decorative line under title
    const titleY = margin + 140;
    doc
      .moveTo(pageWidth * 0.3, titleY)
      .lineTo(pageWidth * 0.7, titleY)
      .stroke('#3498DB')
      .lineWidth(2);

    // "This is to certify that" text
    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#34495E')
      .text('This is to certify that', margin, titleY + 40, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // Student name
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#2C3E50')
      .text(certificate.getStudentName(), margin, titleY + 80, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // "has successfully completed" text
    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#34495E')
      .text('has successfully completed the course', margin, titleY + 130, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // Course title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#3498DB')
      .text(certificate.getCourseTitle(), margin, titleY + 170, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // Completion date
    const completionDate = certificate.getCompletionDate();
    const formattedDate = completionDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#34495E')
      .text(`Completed on ${formattedDate}`, margin, titleY + 220, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });

    // Grade (if available)
    const grade = certificate.getGrade();
    if (grade) {
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#27AE60')
        .text(`Grade: ${grade}`, margin, titleY + 250, {
          width: pageWidth - 2 * margin,
          align: 'center',
        });
    }

    // Credits earned (if available)
    const creditsEarned = certificate.getCreditsEarned();
    if (creditsEarned) {
      doc
        .fontSize(14)
        .font('Helvetica')
        .fillColor('#34495E')
        .text(`Credits Earned: ${creditsEarned}`, margin, titleY + (grade ? 280 : 250), {
          width: pageWidth - 2 * margin,
          align: 'center',
        });
    }

    // Instructor signature area
    const signatureY = pageHeight - margin - 120;

    // Instructor name
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#2C3E50')
      .text(certificate.getInstructorName(), margin + 100, signatureY, {
        width: 200,
        align: 'center',
      });

    // Signature line
    doc
      .moveTo(margin + 100, signatureY + 25)
      .lineTo(margin + 300, signatureY + 25)
      .stroke('#2C3E50')
      .lineWidth(1);

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#7F8C8D')
      .text('Instructor', margin + 100, signatureY + 35, {
        width: 200,
        align: 'center',
      });

    // Certificate ID and issued date
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#95A5A6')
      .text(`Certificate ID: ${certificate.certificateId}`, margin + 400, signatureY, {
        width: 300,
        align: 'left',
      });

    const issuedDate = certificate.issuedAt.toLocaleDateString('en-US');
    doc.text(`Issued: ${issuedDate}`, margin + 400, signatureY + 15, {
      width: 300,
      align: 'left',
    });

    // QR Code for verification
    doc.image(qrCodeBuffer, pageWidth - margin - 150, signatureY - 30, {
      width: 100,
      height: 100,
    });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#7F8C8D')
      .text('Scan to verify', pageWidth - margin - 150, signatureY + 80, {
        width: 100,
        align: 'center',
      });

    // Verification URL (small text at bottom)
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#BDC3C7')
      .text(`Verify at: ${certificate.verificationUrl}`, margin, pageHeight - margin - 20, {
        width: pageWidth - 2 * margin,
        align: 'center',
      });
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
