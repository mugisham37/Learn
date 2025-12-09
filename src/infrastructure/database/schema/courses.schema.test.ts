/**
 * Courses Schema Tests
 * 
 * Basic tests to verify the courses schema is properly defined
 */

import { describe, it, expect } from 'vitest';
import { 
  courses, 
  courseModules, 
  lessons,
  difficultyEnum,
  courseStatusEnum,
  lessonTypeEnum,
  type Course,
  type CourseModule,
  type Lesson
} from './courses.schema';

describe('Courses Schema', () => {
  it('should export courses table with all required fields', () => {
    expect(courses).toBeDefined();
    expect(courses).toHaveProperty('id');
    expect(courses).toHaveProperty('instructorId');
    expect(courses).toHaveProperty('title');
    expect(courses).toHaveProperty('slug');
    expect(courses).toHaveProperty('status');
  });

  it('should export courseModules table with all required fields', () => {
    expect(courseModules).toBeDefined();
    expect(courseModules).toHaveProperty('id');
    expect(courseModules).toHaveProperty('courseId');
    expect(courseModules).toHaveProperty('title');
    expect(courseModules).toHaveProperty('orderNumber');
    expect(courseModules).toHaveProperty('prerequisiteModuleId');
  });

  it('should export lessons table with all required fields', () => {
    expect(lessons).toBeDefined();
    expect(lessons).toHaveProperty('id');
    expect(lessons).toHaveProperty('moduleId');
    expect(lessons).toHaveProperty('title');
    expect(lessons).toHaveProperty('lessonType');
    expect(lessons).toHaveProperty('orderNumber');
  });

  it('should export difficulty enum', () => {
    expect(difficultyEnum).toBeDefined();
  });

  it('should export course status enum', () => {
    expect(courseStatusEnum).toBeDefined();
  });

  it('should export lesson type enum', () => {
    expect(lessonTypeEnum).toBeDefined();
  });

  it('should have proper type exports', () => {
    // This test verifies that the types can be used
    const course: Partial<Course> = {
      title: 'Test Course',
      slug: 'test-course'
    };
    
    const module: Partial<CourseModule> = {
      title: 'Test Module',
      orderNumber: 1
    };
    
    const lesson: Partial<Lesson> = {
      title: 'Test Lesson',
      orderNumber: 1
    };

    expect(course).toBeDefined();
    expect(module).toBeDefined();
    expect(lesson).toBeDefined();
  });
});
