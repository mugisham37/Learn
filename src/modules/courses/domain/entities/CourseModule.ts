import {
  DomainEvent,
  LessonAddedEvent,
  LessonRemovedEvent,
  LessonsReorderedEvent,
} from '../events/CourseEvents';

import { Lesson } from './Lesson';

export interface CourseModuleProps {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  orderNumber: number;
  durationMinutes: number;
  prerequisiteModuleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CourseModule {
  private _props: CourseModuleProps;
  private _lessons: Lesson[] = [];
  private _domainEvents: DomainEvent[] = [];

  constructor(props: CourseModuleProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string {
    return this._props.id;
  }
  get courseId(): string {
    return this._props.courseId;
  }
  get title(): string {
    return this._props.title;
  }
  get description(): string | undefined {
    return this._props.description;
  }
  get orderNumber(): number {
    return this._props.orderNumber;
  }
  get durationMinutes(): number {
    return this._props.durationMinutes;
  }
  get prerequisiteModuleId(): string | undefined {
    return this._props.prerequisiteModuleId;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }
  get lessons(): Lesson[] {
    return [...this._lessons];
  }
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  // Static factory method for creating new modules
  static create(
    props: Omit<CourseModuleProps, 'id' | 'durationMinutes' | 'createdAt' | 'updatedAt'>
  ): CourseModule {
    const now = new Date();

    const moduleProps: CourseModuleProps = {
      ...props,
      id: crypto.randomUUID(),
      durationMinutes: 0,
      createdAt: now,
      updatedAt: now,
    };

    return new CourseModule(moduleProps);
  }

  // Update module properties
  update(
    updates: Partial<Pick<CourseModuleProps, 'title' | 'description' | 'prerequisiteModuleId'>>
  ): void {
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

  // Add lesson to module
  addLesson(lesson: Lesson): void {
    // Ensure unique order numbers within module
    const existingOrderNumbers = this._lessons.map((l) => l.orderNumber);
    if (existingOrderNumbers.includes(lesson.orderNumber)) {
      throw new Error(`Lesson with order number ${lesson.orderNumber} already exists in module`);
    }

    this._lessons.push(lesson);
    this.recalculateDuration();

    this.addDomainEvent(
      new LessonAddedEvent(
        this.id,
        this.courseId,
        lesson.id,
        lesson.title,
        lesson.type,
        lesson.orderNumber
      )
    );
  }

  // Remove lesson from module
  removeLesson(lessonId: string): void {
    const lessonIndex = this._lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex === -1) {
      throw new Error(`Lesson with id ${lessonId} not found`);
    }

    this._lessons.splice(lessonIndex, 1);
    this.recalculateDuration();

    this.addDomainEvent(new LessonRemovedEvent(this.id, this.courseId, lessonId));
  }

  // Reorder lessons within module
  reorderLessons(lessonIds: string[]): void {
    if (lessonIds.length !== this._lessons.length) {
      throw new Error('Lesson IDs count must match existing lessons count');
    }

    // Verify all lesson IDs exist
    const existingIds = new Set(this._lessons.map((l) => l.id));
    const providedIds = new Set(lessonIds);

    if (
      existingIds.size !== providedIds.size ||
      !Array.from(existingIds).every((id) => providedIds.has(id))
    ) {
      throw new Error('Invalid lesson IDs provided');
    }

    // Reorder lessons and update order numbers
    const reorderedLessons: Lesson[] = [];
    lessonIds.forEach((lessonId, index) => {
      const lesson = this._lessons.find((l) => l.id === lessonId)!;
      lesson.updateOrderNumber(index + 1);
      reorderedLessons.push(lesson);
    });

    this._lessons = reorderedLessons;
    this._props.updatedAt = new Date();

    const newOrder = reorderedLessons.map((lesson) => ({
      lessonId: lesson.id,
      orderNumber: lesson.orderNumber,
    }));

    this.addDomainEvent(new LessonsReorderedEvent(this.id, this.courseId, newOrder));
  }

  // Get next available order number for new lesson
  getNextLessonOrderNumber(): number {
    if (this._lessons.length === 0) {
      return 1;
    }

    const maxOrderNumber = Math.max(...this._lessons.map((l) => l.orderNumber));
    return maxOrderNumber + 1;
  }

  // Check if module has prerequisite
  hasPrerequisite(): boolean {
    return this._props.prerequisiteModuleId !== undefined;
  }

  // Set lessons (for loading from database)
  setLessons(lessons: Lesson[]): void {
    this._lessons = [...lessons];
    this.recalculateDuration();
  }

  // Clear domain events
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // Recalculate total duration based on lessons
  private recalculateDuration(): void {
    const totalDuration = this._lessons.reduce((sum, lesson) => {
      return sum + (lesson.durationMinutes || 0);
    }, 0);

    this._props.durationMinutes = totalDuration;
    this._props.updatedAt = new Date();
  }

  // Validate module properties
  private validateProps(props: CourseModuleProps): void {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Module title is required');
    }
    if (props.title.length > 255) {
      throw new Error('Module title cannot exceed 255 characters');
    }
    if (props.orderNumber <= 0) {
      throw new Error('Order number must be positive');
    }
    if (props.durationMinutes < 0) {
      throw new Error('Duration cannot be negative');
    }
    if (!props.courseId || props.courseId.trim().length === 0) {
      throw new Error('Course ID is required');
    }
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
}
