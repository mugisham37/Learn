/**
 * Domain Events for Course Lifecycle
 * 
 * These events are published when significant course-related actions occur
 * and can be consumed by other modules for side effects like notifications,
 * analytics updates, cache invalidation, etc.
 */

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  occurredAt: Date;
  version: number;
}

export class CourseCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CourseCreated';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly instructorId: string,
    public readonly title: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      instructorId: this.instructorId,
      title: this.title,
    };
  }
}

export class CourseUpdatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CourseUpdated';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly instructorId: string,
    public readonly changes?: Record<string, any>
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      instructorId: this.instructorId,
      changes: this.changes,
    };
  }
}

export class CoursePublishedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CoursePublished';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly instructorId: string,
    public readonly title: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      instructorId: this.instructorId,
      title: this.title,
    };
  }
}

export class CourseArchivedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CourseArchived';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly instructorId: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      instructorId: this.instructorId,
    };
  }
}

export class ModuleAddedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'ModuleAdded';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // courseId
    public readonly moduleId: string,
    public readonly moduleTitle: string,
    public readonly orderNumber: number
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      moduleId: this.moduleId,
      moduleTitle: this.moduleTitle,
      orderNumber: this.orderNumber,
    };
  }
}

export class ModuleRemovedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'ModuleRemoved';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // courseId
    public readonly moduleId: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      moduleId: this.moduleId,
    };
  }
}

export class ModulesReorderedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'ModulesReordered';
  public readonly aggregateType = 'Course';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // courseId
    public readonly newOrder: Array<{ moduleId: string; orderNumber: number }>
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      courseId: this.aggregateId,
      newOrder: this.newOrder,
    };
  }
}

export class LessonAddedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'LessonAdded';
  public readonly aggregateType = 'CourseModule';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // moduleId
    public readonly courseId: string,
    public readonly lessonId: string,
    public readonly lessonTitle: string,
    public readonly lessonType: string,
    public readonly orderNumber: number
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      moduleId: this.aggregateId,
      courseId: this.courseId,
      lessonId: this.lessonId,
      lessonTitle: this.lessonTitle,
      lessonType: this.lessonType,
      orderNumber: this.orderNumber,
    };
  }
}

export class LessonRemovedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'LessonRemoved';
  public readonly aggregateType = 'CourseModule';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // moduleId
    public readonly courseId: string,
    public readonly lessonId: string
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      moduleId: this.aggregateId,
      courseId: this.courseId,
      lessonId: this.lessonId,
    };
  }
}

export class LessonsReorderedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'LessonsReordered';
  public readonly aggregateType = 'CourseModule';
  public readonly occurredAt: Date;
  public readonly version = 1;

  constructor(
    public readonly aggregateId: string, // moduleId
    public readonly courseId: string,
    public readonly newOrder: Array<{ lessonId: string; orderNumber: number }>
  ) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  get eventData() {
    return {
      moduleId: this.aggregateId,
      courseId: this.courseId,
      newOrder: this.newOrder,
    };
  }
}

// Type union for all course-related events
export type CourseEvent = 
  | CourseCreatedEvent
  | CourseUpdatedEvent
  | CoursePublishedEvent
  | CourseArchivedEvent
  | ModuleAddedEvent
  | ModuleRemovedEvent
  | ModulesReorderedEvent
  | LessonAddedEvent
  | LessonRemovedEvent
  | LessonsReorderedEvent;