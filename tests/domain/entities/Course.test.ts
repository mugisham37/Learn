import { describe, it, expect, beforeEach } from 'vitest';
import { Course, CourseModule, Lesson } from '../../../src/modules/courses/domain';

describe('Course Entity', () => {
  let courseProps: any;

  beforeEach(() => {
    courseProps = {
      instructorId: 'instructor-123',
      title: 'Introduction to Programming',
      description: 'Learn the basics of programming',
      category: 'Technology',
      difficulty: 'beginner' as const,
      price: 99.99,
      currency: 'USD',
    };
  });

  describe('Course Creation', () => {
    it('should create a new course with valid properties', () => {
      const course = Course.create(courseProps);

      expect(course.id).toBeDefined();
      expect(course.title).toBe(courseProps.title);
      expect(course.description).toBe(courseProps.description);
      expect(course.instructorId).toBe(courseProps.instructorId);
      expect(course.category).toBe(courseProps.category);
      expect(course.difficulty).toBe(courseProps.difficulty);
      expect(course.price).toBe(courseProps.price);
      expect(course.currency).toBe(courseProps.currency);
      expect(course.status).toBe('draft');
      expect(course.enrollmentCount).toBe(0);
      expect(course.totalReviews).toBe(0);
      expect(course.slug).toContain('introduction-to-programming');
      expect(course.domainEvents).toHaveLength(1);
      expect(course.domainEvents[0].eventType).toBe('CourseCreated');
    });

    it('should generate unique slugs for courses with same title', () => {
      const course1 = Course.create(courseProps);
      const course2 = Course.create(courseProps);

      expect(course1.slug).not.toBe(course2.slug);
      expect(course1.slug).toContain('introduction-to-programming');
      expect(course2.slug).toContain('introduction-to-programming');
    });

    it('should throw error for invalid course properties', () => {
      expect(() => Course.create({ ...courseProps, title: '' }))
        .toThrow('Course title is required');
      
      expect(() => Course.create({ ...courseProps, description: '' }))
        .toThrow('Course description is required');
      
      expect(() => Course.create({ ...courseProps, category: '' }))
        .toThrow('Course category is required');
      
      expect(() => Course.create({ ...courseProps, price: -10 }))
        .toThrow('Course price cannot be negative');
    });
  });

  describe('Course Updates', () => {
    it('should update course properties', () => {
      const course = Course.create(courseProps);
      const originalSlug = course.slug;

      course.update({
        title: 'Advanced Programming',
        description: 'Learn advanced programming concepts',
        price: 149.99
      });

      expect(course.title).toBe('Advanced Programming');
      expect(course.description).toBe('Learn advanced programming concepts');
      expect(course.price).toBe(149.99);
      expect(course.slug).not.toBe(originalSlug);
      expect(course.slug).toContain('advanced-programming');
      expect(course.domainEvents).toHaveLength(2);
      expect(course.domainEvents[1].eventType).toBe('CourseUpdated');
    });

    it('should validate updated properties', () => {
      const course = Course.create(courseProps);

      expect(() => course.update({ title: '' }))
        .toThrow('Course title is required');
      
      expect(() => course.update({ price: -50 }))
        .toThrow('Course price cannot be negative');
    });
  });

  describe('Module Management', () => {
    it('should add modules to course', () => {
      const course = Course.create(courseProps);
      const module1 = CourseModule.create({
        courseId: course.id,
        title: 'Module 1',
        orderNumber: 1
      });
      const module2 = CourseModule.create({
        courseId: course.id,
        title: 'Module 2',
        orderNumber: 2
      });

      course.addModule(module1);
      course.addModule(module2);

      expect(course.modules).toHaveLength(2);
      expect(course.modules[0].title).toBe('Module 1');
      expect(course.modules[1].title).toBe('Module 2');
      expect(course.domainEvents).toHaveLength(3); // Created + 2 ModuleAdded
    });

    it('should prevent duplicate order numbers', () => {
      const course = Course.create(courseProps);
      const module1 = CourseModule.create({
        courseId: course.id,
        title: 'Module 1',
        orderNumber: 1
      });
      const module2 = CourseModule.create({
        courseId: course.id,
        title: 'Module 2',
        orderNumber: 1 // Same order number
      });

      course.addModule(module1);
      
      expect(() => course.addModule(module2))
        .toThrow('Module with order number 1 already exists');
    });

    it('should remove modules from course', () => {
      const course = Course.create(courseProps);
      const module = CourseModule.create({
        courseId: course.id,
        title: 'Module 1',
        orderNumber: 1
      });

      course.addModule(module);
      expect(course.modules).toHaveLength(1);

      course.removeModule(module.id);
      expect(course.modules).toHaveLength(0);
      expect(course.domainEvents).toHaveLength(3); // Created + ModuleAdded + ModuleRemoved
    });

    it('should reorder modules', () => {
      const course = Course.create(courseProps);
      const module1 = CourseModule.create({
        courseId: course.id,
        title: 'Module 1',
        orderNumber: 1
      });
      const module2 = CourseModule.create({
        courseId: course.id,
        title: 'Module 2',
        orderNumber: 2
      });
      const module3 = CourseModule.create({
        courseId: course.id,
        title: 'Module 3',
        orderNumber: 3
      });

      course.addModule(module1);
      course.addModule(module2);
      course.addModule(module3);

      // Reorder: module3, module1, module2
      course.reorderModules([module3.id, module1.id, module2.id]);

      expect(course.modules[0].id).toBe(module3.id);
      expect(course.modules[0].orderNumber).toBe(1);
      expect(course.modules[1].id).toBe(module1.id);
      expect(course.modules[1].orderNumber).toBe(2);
      expect(course.modules[2].id).toBe(module2.id);
      expect(course.modules[2].orderNumber).toBe(3);
    });
  });

  describe('Course Publication', () => {
    it('should validate publication requirements', () => {
      const course = Course.create(courseProps);

      const validation = course.canPublish();
      expect(validation.canPublish).toBe(false);
      expect(validation.reasons).toContain('Course must have at least 3 modules');
    });

    it('should publish course when requirements are met', () => {
      const course = Course.create(courseProps);
      
      // Add 3 modules with lessons
      for (let i = 1; i <= 3; i++) {
        const module = CourseModule.create({
          courseId: course.id,
          title: `Module ${i}`,
          orderNumber: i
        });
        
        const lesson = Lesson.create({
          moduleId: module.id,
          title: `Lesson ${i}`,
          type: 'text',
          contentText: 'Sample content',
          orderNumber: 1,
          isPreview: false
        });
        
        module.addLesson(lesson);
        course.addModule(module);
      }

      const validation = course.canPublish();
      expect(validation.canPublish).toBe(true);

      course.publish();
      expect(course.status).toBe('published');
      expect(course.publishedAt).toBeDefined();
      expect(course.domainEvents.some(e => e.eventType === 'CoursePublished')).toBe(true);
    });

    it('should prevent publishing when requirements not met', () => {
      const course = Course.create(courseProps);

      expect(() => course.publish())
        .toThrow('Cannot publish course: Course must have at least 3 modules');
    });
  });

  describe('Enrollment Management', () => {
    it('should update enrollment count', () => {
      const course = Course.create(courseProps);

      course.updateEnrollmentCount(50);
      expect(course.enrollmentCount).toBe(50);

      expect(() => course.updateEnrollmentCount(-5))
        .toThrow('Enrollment count cannot be negative');
    });

    it('should update rating', () => {
      const course = Course.create(courseProps);

      course.updateRating(4.5, 100);
      expect(course.averageRating).toBe(4.5);
      expect(course.totalReviews).toBe(100);

      expect(() => course.updateRating(6, 100))
        .toThrow('Average rating must be between 0 and 5');
      
      expect(() => course.updateRating(4.5, -10))
        .toThrow('Total reviews cannot be negative');
    });
  });

  describe('Domain Events', () => {
    it('should clear domain events', () => {
      const course = Course.create(courseProps);
      expect(course.domainEvents).toHaveLength(1);

      course.clearDomainEvents();
      expect(course.domainEvents).toHaveLength(0);
    });
  });
});