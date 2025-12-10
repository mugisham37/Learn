/**
 * Enrollments Domain Layer
 * 
 * Exports all domain components for the enrollments module.
 * Includes entities, value objects, and domain services.
 */

// Domain entities
export * from './entities/index';

// Domain events
export type { DomainEvent } from './events/EnrollmentEvents';
export {
  EnrollmentCreatedEvent,
  LessonProgressUpdatedEvent,
  CourseProgressUpdatedEvent,
  CourseCompletedEvent,
  CertificateGeneratedEvent,
  EnrollmentWithdrawnEvent
} from './events/EnrollmentEvents';