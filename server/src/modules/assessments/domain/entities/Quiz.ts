/**
 * Quiz Domain Entity
 *
 * Represents a quiz assessment with questions, configuration, and validation rules.
 * Implements business logic for quiz creation, validation, and lifecycle management.
 *
 * Requirements: 6.1, 6.2
 */

import { QuizCreatedEvent, QuizPublishedEvent, QuizDeletedEvent } from '../events/QuizEvents.js';

export type QuizType = 'formative' | 'summative' | 'practice';

export interface QuizConfig {
  timeLimitMinutes?: number;
  passingScorePercentage: number;
  maxAttempts: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
}

export interface CreateQuizData {
  lessonId: string;
  title: string;
  description?: string;
  quizType: QuizType;
  config: QuizConfig;
}

export class Quiz {
  private constructor(
    public readonly id: string,
    public readonly lessonId: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly quizType: QuizType,
    public readonly config: QuizConfig,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private _domainEvents: unknown[] = []
  ) {}

  static create(data: CreateQuizData): Quiz {
    // Validate quiz configuration
    this.validateQuizConfig(data.config);

    const quiz = new Quiz(
      crypto.randomUUID(),
      data.lessonId,
      data.title,
      data.description || null,
      data.quizType,
      data.config,
      new Date(),
      new Date()
    );

    // Add domain event
    quiz._domainEvents.push(new QuizCreatedEvent(quiz.id, quiz.lessonId, quiz.title));

    return quiz;
  }

  static fromPersistence(
    id: string,
    lessonId: string,
    title: string,
    description: string | null,
    quizType: QuizType,
    config: QuizConfig,
    createdAt: Date,
    updatedAt: Date
  ): Quiz {
    return new Quiz(id, lessonId, title, description, quizType, config, createdAt, updatedAt);
  }

  /**
   * Validates quiz configuration according to business rules
   */
  private static validateQuizConfig(config: QuizConfig): void {
    if (config.passingScorePercentage < 0 || config.passingScorePercentage > 100) {
      throw new Error('Passing score percentage must be between 0 and 100');
    }

    if (config.maxAttempts < 0) {
      throw new Error('Max attempts cannot be negative');
    }

    if (config.timeLimitMinutes !== undefined && config.timeLimitMinutes <= 0) {
      throw new Error('Time limit must be positive if specified');
    }

    if (config.availableFrom && config.availableUntil) {
      if (config.availableFrom >= config.availableUntil) {
        throw new Error('Available from date must be before available until date');
      }
    }
  }

  /**
   * Checks if the quiz is currently available for taking
   */
  isAvailable(): boolean {
    const now = new Date();

    if (this.config.availableFrom && now < this.config.availableFrom) {
      return false;
    }

    if (this.config.availableUntil && now > this.config.availableUntil) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a student can start a new attempt
   */
  canStartAttempt(currentAttempts: number): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    if (this.config.maxAttempts === 0) {
      return true; // Unlimited attempts
    }

    return currentAttempts < this.config.maxAttempts;
  }

  /**
   * Updates quiz configuration with validation
   */
  updateConfig(newConfig: Partial<QuizConfig>): Quiz {
    const updatedConfig = { ...this.config, ...newConfig };
    Quiz.validateQuizConfig(updatedConfig);

    return new Quiz(
      this.id,
      this.lessonId,
      this.title,
      this.description,
      this.quizType,
      updatedConfig,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Marks quiz as published (available to students)
   */
  publish(): Quiz {
    const publishedQuiz = new Quiz(
      this.id,
      this.lessonId,
      this.title,
      this.description,
      this.quizType,
      this.config,
      this.createdAt,
      new Date()
    );

    publishedQuiz._domainEvents.push(new QuizPublishedEvent(this.id, this.lessonId));

    return publishedQuiz;
  }

  /**
   * Marks quiz for deletion
   */
  delete(): void {
    this._domainEvents.push(new QuizDeletedEvent(this.id, this.lessonId));
  }

  /**
   * Gets domain events and clears them
   */
  getDomainEvents(): unknown[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  /**
   * Validates that the quiz has at least one question before publishing
   */
  validateForPublishing(questionCount: number): void {
    if (questionCount === 0) {
      throw new Error('Quiz must have at least one question to be published');
    }
  }
}
