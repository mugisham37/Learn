import { describe, it, expect, beforeEach } from 'vitest';
import { CourseModule, Lesson } from '../../../src/modules/courses/domain';

describe('CourseModule Entity', () => {
  let moduleProps: any;

  beforeEach(() => {
    moduleProps = {
      courseId: 'course-123',
      title: 'Introduction Module',
      description: 'This is an introduction module',
      orderNumber: 1,
    };
  });

  describe('Module Creation', () => {
    it('should create a new module with valid properties', () => {
      const module = CourseModule.create(moduleProps);

      expect(module.id).toBeDefined();
      expect(module.courseId).toBe(moduleProps.courseId);
      expect(module.title).toBe(moduleProps.title);
      expect(module.description).toBe(moduleProps.description);
      expect(module.orderNumber).toBe(moduleProps.orderNumber);
      expect(module.durationMinutes).toBe(0);
      expect(module.lessons).toHaveLength(0);
      expect(module.createdAt).toBeDefined();
      expect(module.updatedAt).toBeDefined();
    });

    it('should throw error for invalid module properties', () => {
      expect(() => CourseModule.create({ ...moduleProps, title: '' }))
        .toThrow('Module title is required');
      
      expect(() => CourseModule.create({ ...moduleProps, orderNumber: 0 }))
        .toThrow('Order number must be positive');
      
      expect(() => CourseModule.create({ ...moduleProps, courseId: '' }))
        .toThrow('Course ID is required');
    });
  });

  describe('Module Updates', () => {
    it('should update module properties', () => {
      const module = CourseModule.create(moduleProps);

      module.update({
        title: 'Updated Module Title',
        description: 'Updated description'
      });

      expect(module.title).toBe('Updated Module Title');
      expect(module.description).toBe('Updated description');
    });

    it('should update order number', () => {
      const module = CourseModule.create(moduleProps);

      module.updateOrderNumber(5);
      expect(module.orderNumber).toBe(5);

      expect(() => module.updateOrderNumber(0))
        .toThrow('Order number must be positive');
    });

    it('should validate updated properties', () => {
      const module = CourseModule.create(moduleProps);

      expect(() => module.update({ title: '' }))
        .toThrow('Module title is required');
    });
  });

  describe('Lesson Management', () => {
    it('should add lessons to module', () => {
      const module = CourseModule.create(moduleProps);
      const lesson1 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });
      const lesson2 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 2',
        type: 'video',
        durationMinutes: 30,
        orderNumber: 2,
        isPreview: false
      });

      module.addLesson(lesson1);
      module.addLesson(lesson2);

      expect(module.lessons).toHaveLength(2);
      expect(module.lessons[0].title).toBe('Lesson 1');
      expect(module.lessons[1].title).toBe('Lesson 2');
      expect(module.durationMinutes).toBe(30); // Only lesson2 has duration
      expect(module.domainEvents).toHaveLength(2); // 2 LessonAdded events
    });

    it('should prevent duplicate lesson order numbers', () => {
      const module = CourseModule.create(moduleProps);
      const lesson1 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });
      const lesson2 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 2',
        type: 'text',
        contentText: 'Content 2',
        orderNumber: 1, // Same order number
        isPreview: false
      });

      module.addLesson(lesson1);
      
      expect(() => module.addLesson(lesson2))
        .toThrow('Lesson with order number 1 already exists in module');
    });

    it('should remove lessons from module', () => {
      const module = CourseModule.create(moduleProps);
      const lesson = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });

      module.addLesson(lesson);
      expect(module.lessons).toHaveLength(1);

      module.removeLesson(lesson.id);
      expect(module.lessons).toHaveLength(0);
      expect(module.domainEvents).toHaveLength(2); // LessonAdded + LessonRemoved
    });

    it('should reorder lessons within module', () => {
      const module = CourseModule.create(moduleProps);
      const lesson1 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });
      const lesson2 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 2',
        type: 'text',
        contentText: 'Content 2',
        orderNumber: 2,
        isPreview: false
      });
      const lesson3 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 3',
        type: 'text',
        contentText: 'Content 3',
        orderNumber: 3,
        isPreview: false
      });

      module.addLesson(lesson1);
      module.addLesson(lesson2);
      module.addLesson(lesson3);

      // Reorder: lesson3, lesson1, lesson2
      module.reorderLessons([lesson3.id, lesson1.id, lesson2.id]);

      expect(module.lessons[0].id).toBe(lesson3.id);
      expect(module.lessons[0].orderNumber).toBe(1);
      expect(module.lessons[1].id).toBe(lesson1.id);
      expect(module.lessons[1].orderNumber).toBe(2);
      expect(module.lessons[2].id).toBe(lesson2.id);
      expect(module.lessons[2].orderNumber).toBe(3);
    });

    it('should get next available order number', () => {
      const module = CourseModule.create(moduleProps);
      
      expect(module.getNextLessonOrderNumber()).toBe(1);

      const lesson1 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });
      module.addLesson(lesson1);

      expect(module.getNextLessonOrderNumber()).toBe(2);
    });

    it('should recalculate duration when lessons are added/removed', () => {
      const module = CourseModule.create(moduleProps);
      expect(module.durationMinutes).toBe(0);

      const lesson1 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'video',
        durationMinutes: 15,
        orderNumber: 1,
        isPreview: false
      });
      const lesson2 = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 2',
        type: 'video',
        durationMinutes: 25,
        orderNumber: 2,
        isPreview: false
      });

      module.addLesson(lesson1);
      expect(module.durationMinutes).toBe(15);

      module.addLesson(lesson2);
      expect(module.durationMinutes).toBe(40);

      module.removeLesson(lesson1.id);
      expect(module.durationMinutes).toBe(25);
    });
  });

  describe('Prerequisites', () => {
    it('should handle prerequisite modules', () => {
      const module = CourseModule.create(moduleProps);
      expect(module.hasPrerequisite()).toBe(false);

      const moduleWithPrereq = CourseModule.create({
        ...moduleProps,
        prerequisiteModuleId: 'prerequisite-module-123'
      });
      expect(moduleWithPrereq.hasPrerequisite()).toBe(true);
      expect(moduleWithPrereq.prerequisiteModuleId).toBe('prerequisite-module-123');
    });
  });

  describe('Domain Events', () => {
    it('should clear domain events', () => {
      const module = CourseModule.create(moduleProps);
      const lesson = Lesson.create({
        moduleId: module.id,
        title: 'Lesson 1',
        type: 'text',
        contentText: 'Content 1',
        orderNumber: 1,
        isPreview: false
      });

      module.addLesson(lesson);
      expect(module.domainEvents).toHaveLength(1);

      module.clearDomainEvents();
      expect(module.domainEvents).toHaveLength(0);
    });
  });
});