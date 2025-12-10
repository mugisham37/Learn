/**
 * Courses Domain Layer
 * 
 * Exports all domain entities, value objects, and events
 */

// Entities
export { Course } from './entities/Course';
export type { CourseProps, CourseStatus, CourseDifficulty } from './entities/Course';
export { CourseModule } from './entities/CourseModule';
export type { CourseModuleProps } from './entities/CourseModule';
export { Lesson } from './entities/Lesson';
export type { LessonProps, LessonType } from './entities/Lesson';

// Events
export type { DomainEvent } from './events/CourseEvents';
export {
  CourseCreatedEvent,
  CourseUpdatedEvent,
  CoursePublishedEvent,
  CourseArchivedEvent,
  ModuleAddedEvent,
  ModuleRemovedEvent,
  ModulesReorderedEvent,
  LessonAddedEvent,
  LessonRemovedEvent,
  LessonsReorderedEvent
} from './events/CourseEvents';
export type { CourseEvent } from './events/CourseEvents';