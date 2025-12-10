/**
 * Quiz Domain Events
 * 
 * Events emitted during quiz lifecycle for event-driven communication
 * and integration with other modules.
 * 
 * Requirements: 6.1, 6.2
 */

/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly eventData: Record<string, unknown>;
}

/**
 * Quiz Created Event
 * Emitted when a new quiz is created
 */
export class QuizCreatedEvent implements DomainEvent {
  readonly eventType = 'QuizCreated';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // quizId
    public readonly lessonId: string,
    public readonly title: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      lessonId: this.lessonId,
      title: this.title
    };
  }
}

/**
 * Quiz Published Event
 * Emitted when a quiz is published and made available to students
 */
export class QuizPublishedEvent implements DomainEvent {
  readonly eventType = 'QuizPublished';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // quizId
    public readonly lessonId: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      lessonId: this.lessonId
    };
  }
}

/**
 * Quiz Deleted Event
 * Emitted when a quiz is deleted
 */
export class QuizDeletedEvent implements DomainEvent {
  readonly eventType = 'QuizDeleted';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // quizId
    public readonly lessonId: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      lessonId: this.lessonId
    };
  }
}

/**
 * Question Added Event
 * Emitted when a question is added to a quiz
 */
export class QuestionAddedEvent implements DomainEvent {
  readonly eventType = 'QuestionAdded';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // questionId
    public readonly quizId: string,
    public readonly questionType: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      quizId: this.quizId,
      questionType: this.questionType
    };
  }
}

/**
 * Quiz Attempt Started Event
 * Emitted when a student starts a quiz attempt
 */
export class QuizAttemptStartedEvent implements DomainEvent {
  readonly eventType = 'QuizAttemptStarted';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // submissionId
    public readonly quizId: string,
    public readonly studentId: string,
    public readonly attemptNumber: number
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      quizId: this.quizId,
      studentId: this.studentId,
      attemptNumber: this.attemptNumber
    };
  }
}

/**
 * Quiz Submitted Event
 * Emitted when a student submits a completed quiz
 */
export class QuizSubmittedEvent implements DomainEvent {
  readonly eventType = 'QuizSubmitted';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // submissionId
    public readonly quizId: string,
    public readonly studentId: string,
    public readonly scorePercentage: number,
    public readonly gradingStatus: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      quizId: this.quizId,
      studentId: this.studentId,
      scorePercentage: this.scorePercentage,
      gradingStatus: this.gradingStatus
    };
  }
}

/**
 * Quiz Graded Event
 * Emitted when a quiz submission is manually graded
 */
export class QuizGradedEvent implements DomainEvent {
  readonly eventType = 'QuizGraded';
  readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string, // submissionId
    public readonly quizId: string,
    public readonly studentId: string,
    public readonly finalScore: number,
    public readonly gradedBy: string
  ) {
    this.occurredAt = new Date();
  }

  get eventData(): Record<string, unknown> {
    return {
      quizId: this.quizId,
      studentId: this.studentId,
      finalScore: this.finalScore,
      gradedBy: this.gradedBy
    };
  }
}