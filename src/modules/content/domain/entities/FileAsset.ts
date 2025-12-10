/**
 * File Asset Domain Entity
 * 
 * Represents a generic file upload with metadata, access control, and processing status.
 * Encapsulates business logic for file asset management.
 * 
 * Requirements:
 * - 4.1: File upload with validation and S3 storage
 * - 7.2: Assignment file submissions with type and size validation
 */

import { AssetType, ProcessingStatus } from '../../../../infrastructure/database/schema/content.schema.js';

export interface FileVariants {
  thumbnail?: string;
  compressed?: string;
  preview?: string;
  [key: string]: string | undefined;
}

export interface FileMetadata {
  width?: number;
  height?: number;
  pages?: number;
  author?: string;
  title?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  [key: string]: any;
}

export type AccessLevel = 'public' | 'course' | 'lesson' | 'private';

/**
 * File Asset Domain Entity
 * 
 * Encapsulates file asset business logic and validation rules
 */
export class FileAsset {
  constructor(
    public readonly id: string,
    public readonly courseId: string | null,
    public readonly lessonId: string | null,
    public readonly uploadedBy: string,
    public readonly fileName: string,
    public readonly originalFileName: string,
    public readonly fileSize: number,
    public readonly mimeType: string,
    public readonly assetType: AssetType,
    public readonly s3Bucket: string,
    public readonly s3Key: string,
    public readonly s3Region: string,
    public readonly isPublic: boolean = false,
    public readonly accessLevel: AccessLevel = 'course',
    public readonly cloudfrontUrl: string | null = null,
    public readonly processingStatus: ProcessingStatus = 'completed',
    public readonly processingErrorMessage: string | null = null,
    public readonly variants: FileVariants = {},
    public readonly description: string | null = null,
    public readonly tags: string[] = [],
    public readonly metadata: FileMetadata = {},
    public readonly expiresAt: Date | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validateFileAsset();
  }

  /**
   * Validate file asset data
   */
  private validateFileAsset(): void {
    if (!this.id) {
      throw new Error('File asset ID is required');
    }

    if (!this.uploadedBy) {
      throw new Error('File asset must have an uploader');
    }

    if (!this.fileName) {
      throw new Error('File name is required');
    }

    if (!this.originalFileName) {
      throw new Error('Original file name is required');
    }

    if (this.fileSize <= 0) {
      throw new Error('File size must be greater than 0');
    }

    if (!this.mimeType) {
      throw new Error('MIME type is required');
    }

    if (!this.s3Bucket || !this.s3Key || !this.s3Region) {
      throw new Error('S3 storage information is required');
    }

    if (!['public', 'course', 'lesson', 'private'].includes(this.accessLevel)) {
      throw new Error('Invalid access level');
    }
  }

  /**
   * Check if file is an image
   */
  isImage(): boolean {
    return this.assetType === 'image' || this.mimeType.startsWith('image/');
  }

  /**
   * Check if file is a document
   */
  isDocument(): boolean {
    return this.assetType === 'document' || 
           this.mimeType.includes('pdf') ||
           this.mimeType.includes('document') ||
           this.mimeType.includes('text/');
  }

  /**
   * Check if file is an audio file
   */
  isAudio(): boolean {
    return this.assetType === 'audio' || this.mimeType.startsWith('audio/');
  }

  /**
   * Check if file is an archive
   */
  isArchive(): boolean {
    return this.assetType === 'archive' || 
           this.mimeType.includes('zip') ||
           this.mimeType.includes('rar') ||
           this.mimeType.includes('tar');
  }

  /**
   * Check if file is currently being processed
   */
  isProcessing(): boolean {
    return this.processingStatus === 'in_progress';
  }

  /**
   * Check if file processing is complete
   */
  isProcessed(): boolean {
    return this.processingStatus === 'completed';
  }

  /**
   * Check if file processing failed
   */
  isProcessingFailed(): boolean {
    return this.processingStatus === 'failed';
  }

  /**
   * Check if file is expired
   */
  isExpired(): boolean {
    return this.expiresAt ? this.expiresAt < new Date() : false;
  }

  /**
   * Check if file is publicly accessible
   */
  isPubliclyAccessible(): boolean {
    return this.isPublic && this.accessLevel === 'public';
  }

  /**
   * Get file size in human-readable format
   */
  getFormattedFileSize(): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.fileSize;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(): string {
    const parts = this.originalFileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Get display name (without extension for certain types)
   */
  getDisplayName(): string {
    if (this.isImage() || this.isDocument()) {
      const extension = this.getFileExtension();
      if (extension && this.originalFileName.endsWith(`.${extension}`)) {
        return this.originalFileName.slice(0, -extension.length - 1);
      }
    }
    return this.originalFileName;
  }

  /**
   * Get S3 object URL (not for public access, for management)
   */
  getS3Url(): string {
    return `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${this.s3Key}`;
  }

  /**
   * Get CloudFront URL if available
   */
  getCdnUrl(): string | null {
    return this.cloudfrontUrl;
  }

  /**
   * Get thumbnail URL if available
   */
  getThumbnailUrl(): string | null {
    return this.variants.thumbnail || null;
  }

  /**
   * Get preview URL if available
   */
  getPreviewUrl(): string | null {
    return this.variants.preview || null;
  }

  /**
   * Get compressed version URL if available
   */
  getCompressedUrl(): string | null {
    return this.variants.compressed || null;
  }

  /**
   * Check if file has thumbnail
   */
  hasThumbnail(): boolean {
    return !!this.variants.thumbnail;
  }

  /**
   * Check if file has preview
   */
  hasPreview(): boolean {
    return !!this.variants.preview;
  }

  /**
   * Get image dimensions if available
   */
  getImageDimensions(): { width: number; height: number } | null {
    if (this.isImage() && this.metadata.width && this.metadata.height) {
      return {
        width: this.metadata.width,
        height: this.metadata.height
      };
    }
    return null;
  }

  /**
   * Get document page count if available
   */
  getPageCount(): number | null {
    return this.isDocument() ? this.metadata.pages || null : null;
  }

  /**
   * Check if file is safe for preview (not executable, not archive)
   */
  isSafeForPreview(): boolean {
    const unsafeTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-winexe'
    ];
    
    const unsafeExtensions = ['exe', 'bat', 'cmd', 'com', 'scr', 'vbs', 'js'];
    const extension = this.getFileExtension();
    
    return !unsafeTypes.includes(this.mimeType) && 
           !unsafeExtensions.includes(extension);
  }

  /**
   * Get time until expiration
   */
  getTimeUntilExpiration(): number | null {
    if (!this.expiresAt) return null;
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  /**
   * Check if file will expire soon (within 24 hours)
   */
  isExpiringSoon(): boolean {
    const timeUntilExpiration = this.getTimeUntilExpiration();
    return timeUntilExpiration !== null && timeUntilExpiration < 24 * 60 * 60 * 1000;
  }

  /**
   * Get appropriate icon class based on file type
   */
  getIconClass(): string {
    if (this.isImage()) return 'file-image';
    if (this.isDocument()) return 'file-text';
    if (this.isAudio()) return 'file-audio';
    if (this.isArchive()) return 'file-archive';
    
    const extension = this.getFileExtension();
    switch (extension) {
      case 'pdf': return 'file-pdf';
      case 'doc':
      case 'docx': return 'file-word';
      case 'xls':
      case 'xlsx': return 'file-excel';
      case 'ppt':
      case 'pptx': return 'file-powerpoint';
      case 'csv': return 'file-csv';
      default: return 'file';
    }
  }

  /**
   * Create a copy with updated processing status
   */
  withProcessingStatus(
    status: ProcessingStatus,
    errorMessage?: string
  ): FileAsset {
    return new FileAsset(
      this.id,
      this.courseId,
      this.lessonId,
      this.uploadedBy,
      this.fileName,
      this.originalFileName,
      this.fileSize,
      this.mimeType,
      this.assetType,
      this.s3Bucket,
      this.s3Key,
      this.s3Region,
      this.isPublic,
      this.accessLevel,
      this.cloudfrontUrl,
      status,
      errorMessage || this.processingErrorMessage,
      this.variants,
      this.description,
      this.tags,
      this.metadata,
      this.expiresAt,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a copy with processing results
   */
  withProcessingResults(results: {
    variants?: FileVariants;
    metadata?: FileMetadata;
    cloudfrontUrl?: string;
  }): FileAsset {
    return new FileAsset(
      this.id,
      this.courseId,
      this.lessonId,
      this.uploadedBy,
      this.fileName,
      this.originalFileName,
      this.fileSize,
      this.mimeType,
      this.assetType,
      this.s3Bucket,
      this.s3Key,
      this.s3Region,
      this.isPublic,
      this.accessLevel,
      results.cloudfrontUrl || this.cloudfrontUrl,
      this.processingStatus,
      this.processingErrorMessage,
      { ...this.variants, ...results.variants },
      this.description,
      this.tags,
      { ...this.metadata, ...results.metadata },
      this.expiresAt,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Create a copy with updated expiration
   */
  withExpiration(expiresAt: Date | null): FileAsset {
    return new FileAsset(
      this.id,
      this.courseId,
      this.lessonId,
      this.uploadedBy,
      this.fileName,
      this.originalFileName,
      this.fileSize,
      this.mimeType,
      this.assetType,
      this.s3Bucket,
      this.s3Key,
      this.s3Region,
      this.isPublic,
      this.accessLevel,
      this.cloudfrontUrl,
      this.processingStatus,
      this.processingErrorMessage,
      this.variants,
      this.description,
      this.tags,
      this.metadata,
      expiresAt,
      this.createdAt,
      new Date()
    );
  }
}