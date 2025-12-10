/**
 * Courses Application Layer
 * 
 * Exports application services and interfaces for the courses module.
 * This layer contains business logic, use cases, and orchestration.
 */

export type { ICourseService, PublicationValidationResult } from './services/ICourseService.js';
export { CourseService } from './services/CourseService.js';
export { CourseMapper, CourseModuleMapper, LessonMapper } from './mappers/CourseMapper.js';