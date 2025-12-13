/**
 * Certificate Domain Entity
 *
 * Represents a digital certificate issued upon successful course completion.
 * Contains certificate metadata, PDF URL, and verification information.
 *
 * Requirements: 5.6, 5.7
 */

import { CertificateGeneratedEvent } from '../events/EnrollmentEvents';

export interface CertificateProps {
  id: string;
  enrollmentId: string;
  certificateId: string;
  pdfUrl: string;
  issuedAt: Date;
  verificationUrl: string;
  metadata?: {
    studentName: string;
    courseTitle: string;
    instructorName: string;
    completionDate: Date;
    grade?: string;
    creditsEarned?: number;
    [key: string]: any;
  };
  createdAt: Date;
}

export class Certificate {
  private _props: CertificateProps;
  private _domainEvents: any[] = [];

  constructor(props: CertificateProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string {
    return this._props.id;
  }
  get enrollmentId(): string {
    return this._props.enrollmentId;
  }
  get certificateId(): string {
    return this._props.certificateId;
  }
  get pdfUrl(): string {
    return this._props.pdfUrl;
  }
  get issuedAt(): Date {
    return this._props.issuedAt;
  }
  get verificationUrl(): string {
    return this._props.verificationUrl;
  }
  get metadata(): CertificateProps['metadata'] {
    return this._props.metadata;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get domainEvents(): any[] {
    return [...this._domainEvents];
  }

  // Static factory method for creating new certificate
  static create(props: {
    enrollmentId: string;
    studentId: string;
    courseId: string;
    studentName: string;
    courseTitle: string;
    instructorName: string;
    completionDate: Date;
    grade?: string;
    creditsEarned?: number;
  }): Certificate {
    const now = new Date();
    const certificateId = Certificate.generateCertificateId();

    const certificateProps: CertificateProps = {
      id: `certificate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      enrollmentId: props.enrollmentId,
      certificateId,
      pdfUrl: '', // Will be set after PDF generation
      issuedAt: now,
      verificationUrl: Certificate.generateVerificationUrl(certificateId),
      metadata: {
        studentName: props.studentName,
        courseTitle: props.courseTitle,
        instructorName: props.instructorName,
        completionDate: props.completionDate,
        grade: props.grade,
        creditsEarned: props.creditsEarned,
      },
      createdAt: now,
    };

    const certificate = new Certificate(certificateProps);

    certificate.addDomainEvent(
      new CertificateGeneratedEvent(certificate.id, {
        enrollmentId: props.enrollmentId,
        certificateId: certificate.certificateId,
        studentId: props.studentId,
        courseId: props.courseId,
        issuedAt: certificate.issuedAt,
        verificationUrl: certificate.verificationUrl,
      })
    );

    return certificate;
  }

  // Static factory method for creating from database record
  static fromDatabase(props: CertificateProps): Certificate {
    return new Certificate(props);
  }

  /**
   * Update PDF URL after PDF generation
   */
  setPdfUrl(pdfUrl: string): void {
    if (!pdfUrl?.trim()) {
      throw new Error('PDF URL is required');
    }

    this._props.pdfUrl = pdfUrl;
  }

  /**
   * Update certificate metadata
   */
  updateMetadata(metadata: Partial<CertificateProps['metadata']>): void {
    this._props.metadata = {
      ...this._props.metadata,
      ...metadata,
    } as CertificateProps['metadata'];
  }

  /**
   * Check if certificate is ready for delivery
   * Certificate is ready when it has a PDF URL
   */
  isReadyForDelivery(): boolean {
    return !!this._props.pdfUrl?.trim();
  }

  /**
   * Get student name from metadata
   */
  getStudentName(): string {
    return this._props.metadata?.studentName || 'Unknown Student';
  }

  /**
   * Get course title from metadata
   */
  getCourseTitle(): string {
    return this._props.metadata?.courseTitle || 'Unknown Course';
  }

  /**
   * Get instructor name from metadata
   */
  getInstructorName(): string {
    return this._props.metadata?.instructorName || 'Unknown Instructor';
  }

  /**
   * Get completion date from metadata
   */
  getCompletionDate(): Date {
    return this._props.metadata?.completionDate || this._props.issuedAt;
  }

  /**
   * Get grade from metadata
   */
  getGrade(): string | undefined {
    return this._props.metadata?.grade;
  }

  /**
   * Get credits earned from metadata
   */
  getCreditsEarned(): number | undefined {
    return this._props.metadata?.creditsEarned;
  }

  /**
   * Generate QR code data for verification
   */
  getQRCodeData(): string {
    return this._props.verificationUrl;
  }

  /**
   * Check if certificate is expired
   * Certificates don't expire by default, but this can be customized
   */
  isExpired(): boolean {
    // Certificates don't expire by default
    // This can be customized based on business requirements
    return false;
  }

  // Clear domain events
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // Convert to database format
  toDatabase(): Omit<CertificateProps, 'id'> {
    return {
      enrollmentId: this._props.enrollmentId,
      certificateId: this._props.certificateId,
      pdfUrl: this._props.pdfUrl,
      issuedAt: this._props.issuedAt,
      verificationUrl: this._props.verificationUrl,
      metadata: this._props.metadata,
      createdAt: this._props.createdAt,
    };
  }

  /**
   * Generate unique certificate ID
   */
  private static generateCertificateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `CERT-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
  }

  /**
   * Generate verification URL for certificate
   */
  private static generateVerificationUrl(certificateId: string): string {
    // This would typically use the application's base URL from configuration
    const baseUrl = process.env['APP_BASE_URL'] || 'https://platform.example.com';
    return `${baseUrl}/certificates/verify/${certificateId}`;
  }

  private validateProps(props: CertificateProps): void {
    if (!props.enrollmentId?.trim()) {
      throw new Error('Enrollment ID is required');
    }
    if (!props.certificateId?.trim()) {
      throw new Error('Certificate ID is required');
    }
    if (!props.verificationUrl?.trim()) {
      throw new Error('Verification URL is required');
    }
    if (!props.issuedAt) {
      throw new Error('Issued date is required');
    }
    if (props.issuedAt > new Date()) {
      throw new Error('Issued date cannot be in the future');
    }
  }

  private addDomainEvent(event: any): void {
    this._domainEvents.push(event);
  }
}
