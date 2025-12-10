export type LessonType = 'video' | 'text' | 'quiz' | 'assignment';

export interface LessonProps {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  type: LessonType;
  contentUrl?: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber: number;
  isPreview: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class Lesson {
  private _props: LessonProps;

  constructor(props: LessonProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string { return this._props.id; }
  get moduleId(): string { return this._props.moduleId; }
  get title(): string { return this._props.title; }
  get description(): string | undefined { return this._props.description; }
  get type(): LessonType { return this._props.type; }
  get contentUrl(): string | undefined { return this._props.contentUrl; }
  get contentText(): string | undefined { return this._props.contentText; }
  get durationMinutes(): number | undefined { return this._props.durationMinutes; }
  get orderNumber(): number { return this._props.orderNumber; }
  get isPreview(): boolean { return this._props.isPreview; }
  get metadata(): Record<string, any> { return { ...this._props.metadata }; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }

  // Static factory method for creating new lessons
  static create(props: Omit<LessonProps, 'id' | 'metadata' | 'createdAt' | 'updatedAt'>): Lesson {
    const now = new Date();
    
    const lessonProps: LessonProps = {
      ...props,
      id: crypto.randomUUID(),
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    return new Lesson(lessonProps);
  }

  // Update lesson properties
  update(updates: Partial<Pick<LessonProps, 'title' | 'description' | 'contentUrl' | 'contentText' | 'durationMinutes' | 'isPreview'>>): void {
    Object.assign(this._props, updates, { updatedAt: new Date() });
    this.validateProps(this._props);
  }

  // Update order number (used during reordering)
  updateOrderNumber(orderNumber: number): void {
    if (orderNumber <= 0) {
      throw new Error('Order number must be positive');
    }
    
    this._props.orderNumber = orderNumber;
    this._props.updatedAt = new Date();
  }

  // Update content URL (for video processing completion)
  updateContentUrl(contentUrl: string): void {
    if (!contentUrl || contentUrl.trim().length === 0) {
      throw new Error('Content URL cannot be empty');
    }
    
    this._props.contentUrl = contentUrl;
    this._props.updatedAt = new Date();
  }

  // Update metadata
  updateMetadata(metadata: Record<string, any>): void {
    this._props.metadata = { ...this._props.metadata, ...metadata };
    this._props.updatedAt = new Date();
  }

  // Set as preview lesson
  setAsPreview(isPreview: boolean): void {
    this._props.isPreview = isPreview;
    this._props.updatedAt = new Date();
  }

  // Check if lesson has required content based on type
  hasRequiredContent(): boolean {
    switch (this._props.type) {
      case 'video':
        return !!this._props.contentUrl;
      case 'text':
        return !!this._props.contentText && this._props.contentText.trim().length > 0;
      case 'quiz':
      case 'assignment':
        // These will be validated by their respective entities
        return true;
      default:
        return false;
    }
  }

  // Check if lesson is ready for course publication
  isReadyForPublication(): boolean {
    if (!this.hasRequiredContent()) {
      return false;
    }

    // Video lessons need processing to be complete
    if (this._props.type === 'video' && !this._props.contentUrl) {
      return false;
    }

    return true;
  }

  // Get content summary for display
  getContentSummary(): string {
    switch (this._props.type) {
      case 'video':
        return this._props.contentUrl ? 'Video processed' : 'Video processing...';
      case 'text':
        const textLength = this._props.contentText?.length || 0;
        return `Text content (${textLength} characters)`;
      case 'quiz':
        return 'Interactive quiz';
      case 'assignment':
        return 'Assignment submission';
      default:
        return 'Unknown content type';
    }
  }

  // Validate lesson properties
  private validateProps(props: LessonProps): void {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Lesson title is required');
    }
    if (props.title.length > 255) {
      throw new Error('Lesson title cannot exceed 255 characters');
    }
    if (props.orderNumber <= 0) {
      throw new Error('Order number must be positive');
    }
    if (!props.moduleId || props.moduleId.trim().length === 0) {
      throw new Error('Module ID is required');
    }
    if (props.durationMinutes !== undefined && props.durationMinutes < 0) {
      throw new Error('Duration cannot be negative');
    }

    // Type-specific validation
    this.validateTypeSpecificContent(props);
  }

  // Validate type-specific content requirements
  private validateTypeSpecificContent(props: LessonProps): void {
    switch (props.type) {
      case 'video':
        // Video lessons should have duration
        if (props.durationMinutes === undefined || props.durationMinutes <= 0) {
          // Allow creation without duration, but warn
          console.warn('Video lesson should have a positive duration');
        }
        break;
      
      case 'text':
        // Text lessons should have content text
        if (!props.contentText || props.contentText.trim().length === 0) {
          throw new Error('Text lesson must have content text');
        }
        break;
      
      case 'quiz':
        // Quiz lessons will be validated by Quiz entity
        break;
      
      case 'assignment':
        // Assignment lessons will be validated by Assignment entity
        break;
      
      default:
        throw new Error(`Invalid lesson type: ${props.type}`);
    }
  }
}