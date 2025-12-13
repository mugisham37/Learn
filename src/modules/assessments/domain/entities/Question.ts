/**
 * Question Domain Entity
 *
 * Represents a quiz question with type-specific validation and answer checking.
 * Supports multiple question types with appropriate validation for each.
 *
 * Requirements: 6.1, 6.4, 6.5
 */

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'fill_blank'
  | 'matching';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MultipleChoiceOptions {
  options: string[];
  correctAnswerIndex: number;
}

export interface TrueFalseOptions {
  correctAnswer: boolean;
}

export interface ShortAnswerOptions {
  correctAnswers: string[]; // Multiple acceptable answers
  caseSensitive: boolean;
}

export interface EssayOptions {
  maxWords?: number;
  rubric?: string;
}

export interface FillBlankOptions {
  template: string; // Text with placeholders like "The capital of France is ___"
  correctAnswers: string[]; // Answers for each blank
}

export interface MatchingOptions {
  leftItems: string[];
  rightItems: string[];
  correctMatches: Array<{ left: number; right: number }>;
}

export interface CreateQuestionData {
  quizId: string;
  questionType: QuestionType;
  questionText: string;
  questionMediaUrl?: string;
  options?: unknown; // Type-specific options
  correctAnswer: unknown; // Type-specific correct answer
  explanation?: string;
  points: number;
  difficulty: Difficulty;
}

export class Question {
  private constructor(
    public readonly id: string,
    public readonly quizId: string,
    public readonly questionType: QuestionType,
    public readonly questionText: string,
    public readonly questionMediaUrl: string | undefined,
    public readonly options: unknown,
    public readonly correctAnswer: unknown,
    public readonly explanation: string | undefined,
    public readonly points: number,
    public readonly orderNumber: number,
    public readonly difficulty: Difficulty,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(data: CreateQuestionData, orderNumber: number): Question {
    // Validate question data
    this.validateQuestionData(data);

    const question = new Question(
      crypto.randomUUID(),
      data.quizId,
      data.questionType,
      data.questionText,
      data.questionMediaUrl,
      data.options,
      data.correctAnswer,
      data.explanation,
      data.points,
      orderNumber,
      data.difficulty,
      new Date(),
      new Date()
    );

    return question;
  }

  static fromPersistence(
    id: string,
    quizId: string,
    questionType: QuestionType,
    questionText: string,
    questionMediaUrl: string | undefined,
    options: unknown,
    correctAnswer: unknown,
    explanation: string | undefined,
    points: number,
    orderNumber: number,
    difficulty: Difficulty,
    createdAt: Date,
    updatedAt: Date
  ): Question {
    return new Question(
      id,
      quizId,
      questionType,
      questionText,
      questionMediaUrl,
      options,
      correctAnswer,
      explanation,
      points,
      orderNumber,
      difficulty,
      createdAt,
      updatedAt
    );
  }

  /**
   * Validates question data according to business rules
   */
  private static validateQuestionData(data: CreateQuestionData): void {
    if (!data.questionText?.trim()) {
      throw new Error('Question text is required');
    }

    if (data.points <= 0) {
      throw new Error('Points must be positive');
    }

    // Type-specific validation
    this.validateTypeSpecificData(data.questionType, data.options, data.correctAnswer);
  }

  /**
   * Validates type-specific question data
   */
  private static validateTypeSpecificData(
    questionType: QuestionType,
    options: unknown,
    correctAnswer: unknown
  ): void {
    switch (questionType) {
      case 'multiple_choice':
        if (!Array.isArray(options) || options.length < 2) {
          throw new Error('Multiple choice questions must have at least 2 options');
        }
        if (
          typeof correctAnswer !== 'number' ||
          correctAnswer < 0 ||
          correctAnswer >= options.length
        ) {
          throw new Error('Multiple choice questions must have a valid correct answer index');
        }
        break;

      case 'true_false':
        if (typeof correctAnswer !== 'boolean') {
          throw new Error('True/false questions must have a boolean correct answer');
        }
        break;

      case 'short_answer':
        if (
          !correctAnswer ||
          (!Array.isArray(correctAnswer) && typeof correctAnswer !== 'string')
        ) {
          throw new Error('Short answer questions must have correct answer(s)');
        }
        break;

      case 'essay':
        // Essay questions don't require a correct answer
        break;

      case 'fill_blank':
        if (!Array.isArray(correctAnswer)) {
          throw new Error('Fill in the blank questions must have an array of correct answers');
        }
        break;

      case 'matching':
        if (!options || !correctAnswer) {
          throw new Error('Matching questions must have options and correct answer mappings');
        }
        break;
    }
  }

  /**
   * Checks if a student's answer is correct
   */
  isAnswerCorrect(studentAnswer: unknown): boolean {
    if (studentAnswer === null || studentAnswer === undefined) {
      return false;
    }

    switch (this.questionType) {
      case 'multiple_choice':
        return studentAnswer === this.correctAnswer;

      case 'true_false':
        return studentAnswer === this.correctAnswer;

      case 'fill_blank':
        if (!Array.isArray(studentAnswer) || !Array.isArray(this.correctAnswer)) {
          return false;
        }
        const studentAnswers = studentAnswer as string[];
        const correctAnswers = this.correctAnswer as string[];

        if (studentAnswers.length !== correctAnswers.length) {
          return false;
        }

        return studentAnswers.every(
          (answer, index) =>
            answer.toLowerCase().trim() === correctAnswers[index]?.toLowerCase().trim()
        );

      case 'short_answer':
        const correctAnswerArray = Array.isArray(this.correctAnswer)
          ? (this.correctAnswer as string[])
          : [this.correctAnswer as string];

        const studentAnswerStr = (studentAnswer as string).toLowerCase().trim();
        return correctAnswerArray.some(
          (correct) => correct.toLowerCase().trim() === studentAnswerStr
        );

      default:
        return false; // Essay and matching questions need manual grading
    }
  }

  /**
   * Gets the display options for the question (may be randomized)
   */
  getDisplayOptions(randomize: boolean = false): unknown {
    if (!randomize || this.questionType !== 'multiple_choice') {
      return this.options;
    }

    // Randomize multiple choice options
    const options = this.options as string[];
    const correctIndex = this.correctAnswer as number;
    // const correctOption = options[correctIndex]; // Not used in current implementation

    // Create array of indices and shuffle
    const indices = Array.from({ length: options.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j]!;
      indices[j] = temp;
    }

    // Return shuffled options with new correct index
    const shuffledOptions = indices.map((i) => options[i]);
    const newCorrectIndex = indices.indexOf(correctIndex);

    return {
      options: shuffledOptions,
      correctAnswerIndex: newCorrectIndex,
    };
  }

  /**
   * Updates question content
   */
  update(
    questionText?: string,
    options?: unknown,
    correctAnswer?: unknown,
    explanation?: string,
    points?: number,
    difficulty?: Difficulty
  ): Question {
    const updatedData = {
      quizId: this.quizId,
      questionType: this.questionType,
      questionText: questionText || this.questionText,
      questionMediaUrl: this.questionMediaUrl,
      options: options !== undefined ? options : this.options,
      correctAnswer: correctAnswer !== undefined ? correctAnswer : this.correctAnswer,
      explanation: explanation !== undefined ? explanation : this.explanation,
      points: points || this.points,
      difficulty: difficulty || this.difficulty,
    };

    Question.validateQuestionData(updatedData);

    return new Question(
      this.id,
      this.quizId,
      this.questionType,
      updatedData.questionText,
      this.questionMediaUrl,
      updatedData.options,
      updatedData.correctAnswer,
      updatedData.explanation,
      updatedData.points,
      this.orderNumber,
      updatedData.difficulty,
      this.createdAt,
      new Date()
    );
  }
}
