/**
 * Assignment Domain Entity
 *
 * Represents a file-based assignment with due dates, rubrics, and late submission policies.
 * Implements business logic for assignment creation, validation, and lifecycle management.
 *
 * Requirements: 7.1, 7.3, 7.6
 */

export interface AssignmentConfig {
  dueDate: Date;
  lateSubmissionAllowed: boolean;
  latePenaltyPercentage: number;
  maxPoints: number;
  requiresFileUpload: boolean;
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  rubric?: Record<string, any>;
}

export interface CreateAssignmentData {
  lessonId: string;
  title: string;
  description?: string;
  instructions: string;
  config: AssignmentConfig;
}

export class Assignment {
  private constructor(
    public readonly id: string,
    public readonly lessonId: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly instructions: string,
    public readonly config: AssignmentConfig,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private _domainEvents: any[] = []
  ) {}

  static create(data: CreateAssignmentData): Assignment {
    // Validate assignment configuration
    this.validateAssignmentConfig(data.config);

    const assignment = new Assignment(
      crypto.randomUUID(),
      data.lessonId,
      data.title,
      data.description || null,
      data.instructions,
      data.config,
      new Date(),
      new Date()
    );

    return assignment;
  }
  static fromPersistence(
    id: string,
    lessonId: string,
    title: string,
    description: string | null,
    instructions: string,
    config: AssignmentConfig,
    createdAt: Date,
    updatedAt: Date
  ): Assignment {
    return new Assignment(
      id,
      lessonId,
      title,
      description,
      instructions,
      config,
      createdAt,
      updatedAt
    );
  }

  /**
   * Validates assignment configuration according to business rules
   */
  private static validateAssignmentConfig(config: AssignmentConfig): void {
    if (config.dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }

    if (config.maxPoints <= 0) {
      throw new Error('Max points must be positive');
    }

    if (config.latePenaltyPercentage < 0 || config.latePenaltyPercentage > 100) {
      throw new Error('Late penalty percentage must be between 0 and 100');
    }

    if (config.maxFileSizeMb <= 0) {
      throw new Error('Max file size must be positive');
    }

    if (
      config.requiresFileUpload &&
      (!config.allowedFileTypes || config.allowedFileTypes.length === 0)
    ) {
      throw new Error('Allowed file types must be specified when file upload is required');
    }

    // Validate file types format
    if (config.allowedFileTypes) {
      const validExtensions = /^\.[a-zA-Z0-9]+$/;
      for (const fileType of config.allowedFileTypes) {
        if (!validExtensions.test(fileType)) {
          throw new Error(
            `Invalid file type format: ${fileType}. Must be in format like .pdf, .docx`
          );
        }
      }
    }
  }

  /**
   * Checks if the assignment is currently accepting submissions
   */
  isAcceptingSubmissions(): boolean {
    const now = new Date();

    if (now <= this.config.dueDate) {
      return true;
    }

    return this.config.lateSubmissionAllowed;
  }

  /**
   * Determines if a submission would be considered late
   */
  isSubmissionLate(submissionDate: Date = new Date()): boolean {
    return submissionDate > this.config.dueDate;
  }

  /**
   * Calculates the late penalty for a submission
   */
  calculateLatePenalty(submissionDate: Date = new Date()): number {
    if (!this.isSubmissionLate(submissionDate)) {
      return 0;
    }

    return this.config.latePenaltyPercentage;
  }
  /**
   * Validates a file for submission
   */
  validateFile(fileName: string, fileSizeBytes: number): { isValid: boolean; error?: string } {
    if (!this.config.requiresFileUpload) {
      return { isValid: true };
    }

    // Check file size
    const fileSizeMb = fileSizeBytes / (1024 * 1024);
    if (fileSizeMb > this.config.maxFileSizeMb) {
      return {
        isValid: false,
        error: `File size ${fileSizeMb.toFixed(2)}MB exceeds maximum allowed size of ${this.config.maxFileSizeMb}MB`,
      };
    }

    // Check file type
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    const allowedTypes = this.config.allowedFileTypes.map((type) => type.toLowerCase());

    if (!allowedTypes.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File type ${fileExtension} is not allowed. Allowed types: ${this.config.allowedFileTypes.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Updates assignment configuration with validation
   */
  updateConfig(newConfig: Partial<AssignmentConfig>): Assignment {
    const updatedConfig = { ...this.config, ...newConfig };
    Assignment.validateAssignmentConfig(updatedConfig);

    return new Assignment(
      this.id,
      this.lessonId,
      this.title,
      this.description,
      this.instructions,
      updatedConfig,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Gets domain events and clears them
   */
  getDomainEvents(): any[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
