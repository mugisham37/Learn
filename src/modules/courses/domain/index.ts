/**
 * Courses Domain Layer
 * 
 * Exports all domain entities, value objects, and events
 */

// Entities
export { Course, CourseProps, CourseStatus, CourseDifficulty } from './entities/Course';
export { CourseModule, CourseModuleProps } from './entities/CourseModule';
export { Lesson, LessonProps, LessonType } from './entities/Lesson';

// Events
export {
  DomainEvent,
  CourseCreatedEvent,
  CourseUpdatedEvent,
  CoursePublishedEvent,
  CourseArchivedEvent,
  ModuleAddedEvent,
  ModuleRemovedEvent,
  ModulesReorderedEvent,
  LessonAddedEvent,
  LessonRemovedEvent,
  LessonsReorderedEvent,
  CourseEvent
} from './events/CourseEvents';