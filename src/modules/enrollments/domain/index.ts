/**
 * Enrollments Domain Layer
 * 
 * Exports all domain components for the enrollments module.
 * Includes entities, value objects, and domain services.
 */

// Domain entities
export * from './entities/index.js';

// Domain events
export type { DomainEvent } from './events/EnrollmentEvents.js';
export {
  EnrollmentCreatedEvent,
  LessonProgressUpdatedEvent,
  CourseProgressUpdatedEvent,
  CourseCompletedEvent,
  CertificateGeneratedEvent,
  EnrollmentWithdrawnEvent
} from './events/EnrollmentEvents.js';