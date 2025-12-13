/**
 * Image Processing Service Interface
 *
 * Defines the contract for image processing operations.
 * Handles image optimization, resizing, and format conversion.
 */

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Processed image result
 */
export interface ProcessedImageResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Image Processing Service Interface
 *
 * Provides methods for image processing operations including
 * resizing, optimization, and format conversion.
 */
export interface IImageProcessingService {
  /**
   * Processes an image with the specified options
   *
   * @param buffer - Input image buffer
   * @param options - Processing options
   * @returns Processed image result
   * @throws ValidationError if image is invalid
   * @throws Error if processing fails
   */
  processImage(buffer: Buffer, options: ImageProcessingOptions): Promise<ProcessedImageResult>;

  /**
   * Validates if a buffer contains a valid image
   *
   * @param buffer - Image buffer to validate
   * @returns True if valid image, false otherwise
   */
  isValidImage(buffer: Buffer): Promise<boolean>;

  /**
   * Gets image metadata
   *
   * @param buffer - Image buffer
   * @returns Image metadata
   * @throws ValidationError if image is invalid
   */
  getImageMetadata(buffer: Buffer): Promise<{
    format: string;
    width: number;
    height: number;
    size: number;
  }>;

  /**
   * Creates an optimized avatar image
   *
   * @param buffer - Input image buffer
   * @returns Optimized avatar buffer
   */
  createAvatar(buffer: Buffer): Promise<ProcessedImageResult>;

  /**
   * Creates a thumbnail image
   *
   * @param buffer - Input image buffer
   * @returns Thumbnail buffer
   */
  createThumbnail(buffer: Buffer): Promise<ProcessedImageResult>;
}
