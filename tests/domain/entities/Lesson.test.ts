import { describe, it, expect, beforeEach } from 'vitest';
import { Lesson } from '../../../src/modules/courses/domain';

describe('Lesson Entity', () => {
  let lessonProps: any;

  beforeEach(() => {
    lessonProps = {
      moduleId: 'module-123',
      title: 'Introduction Lesson',
      description: 'This is an introduction lesson',
      type: 'text' as const,
      contentText: 'This is the lesson content',
      orderNumber: 1,
      isPreview: false,
    };
  });

  describe('Lesson Creation', () => {
    it('should create a new text lesson with valid properties', () => {
      const lesson = Lesson.create(lessonProps);

      expect(lesson.id).toBeDefined();
      expect(lesson.moduleId).toBe(lessonProps.moduleId);
      expect(lesson.title).toBe(lessonProps.title);
      expect(lesson.description).toBe(lessonProps.description);
      expect(lesson.type).toBe(lessonProps.type);
      expect(lesson.contentText).toBe(lessonProps.contentText);
      expect(lesson.orderNumber).toBe(lessonProps.orderNumber);
      expect(lesson.isPreview).toBe(lessonProps.isPreview);
      expect(lesson.metadata).toEqual({});
      expect(lesson.createdAt).toBeDefined();
      expect(lesson.updatedAt).toBeDefined();
    });

    it('should create a video lesson', () => {
      const videoProps = {
        ...lessonProps,
        type: 'video' as const,
        contentText: undefined,
        durationMinutes: 30,
      };

      const lesson = Lesson.create(videoProps);

      expect(lesson.type).toBe('video');
      expect(lesson.durationMinutes).toBe(30);
      expect(lesson.contentText).toBeUndefined();
    });

    it('should throw error for invalid lesson properties', () => {
      expect(() => Lesson.create({ ...lessonProps, title: '' }))
        .toThrow('Lesson title is required');
      
      expect(() => Lesson.create({ ...lessonProps, orderNumber: 0 }))
        .toThrow('Order number must be positive');
      
      expect(() => Lesson.create({ ...lessonProps, moduleId: '' }))
        .toThrow('Module ID is required');
      
      expect(() => Lesson.create({ ...lessonProps, durationMinutes: -5 }))
        .toThrow('Duration cannot be negative');
    });

    it('should validate type-specific content requirements', () => {
      // Text lesson without content text should fail
      expect(() => Lesson.create({ 
        ...lessonProps, 
        type: 'text' as const,
        contentText: '' 
      })).toThrow('Text lesson must have content text');

      // Invalid lesson type should fail
      expect(() => Lesson.create({ 
        ...lessonProps, 
        type: 'invalid' as any
      })).toThrow('Invalid lesson type: invalid');
    });
  });

  describe('Lesson Updates', () => {
    it('should update lesson properties', () => {
      const lesson = Lesson.create(lessonProps);

      lesson.update({
        title: 'Updated Lesson Title',
        description: 'Updated description',
        contentText: 'Updated content',
        durationMinutes: 45,
        isPreview: true
      });

      expect(lesson.title).toBe('Updated Lesson Title');
      expect(lesson.description).toBe('Updated description');
      expect(lesson.contentText).toBe('Updated content');
      expect(lesson.durationMinutes).toBe(45);
      expect(lesson.isPreview).toBe(true);
    });

    it('should update order number', () => {
      const lesson = Lesson.create(lessonProps);

      lesson.updateOrderNumber(5);
      expect(lesson.orderNumber).toBe(5);

      expect(() => lesson.updateOrderNumber(0))
        .toThrow('Order number must be positive');
    });

    it('should update content URL', () => {
      const lesson = Lesson.create(lessonProps);

      lesson.updateContentUrl('https://example.com/video.mp4');
      expect(lesson.contentUrl).toBe('https://example.com/video.mp4');

      expect(() => lesson.updateContentUrl(''))
        .toThrow('Content URL cannot be empty');
    });

    it('should update metadata', () => {
      const lesson = Lesson.create(lessonProps);

      lesson.updateMetadata({ 
        videoQuality: '1080p',
        subtitles: ['en', 'es'] 
      });

      expect(lesson.metadata).toEqual({
        videoQuality: '1080p',
        subtitles: ['en', 'es']
      });

      // Should merge with existing metadata
      lesson.updateMetadata({ 
        duration: 1800 
      });

      expect(lesson.metadata).toEqual({
        videoQuality: '1080p',
        subtitles: ['en', 'es'],
        duration: 1800
      });
    });

    it('should set preview status', () => {
      const lesson = Lesson.create(lessonProps);
      expect(lesson.isPreview).toBe(false);

      lesson.setAsPreview(true);
      expect(lesson.isPreview).toBe(true);

      lesson.setAsPreview(false);
      expect(lesson.isPreview).toBe(false);
    });
  });

  describe('Content Validation', () => {
    it('should validate required content for different lesson types', () => {
      // Text lesson with content
      const textLesson = Lesson.create({
        ...lessonProps,
        type: 'text',
        contentText: 'Some content'
      });
      expect(textLesson.hasRequiredContent()).toBe(true);

      // Text lesson without content - create with minimal validation bypass
      const emptyTextLesson = Lesson.create({
        ...lessonProps,
        type: 'text',
        contentText: 'temp' // Temporary valid content to pass creation validation
      });
      
      // Directly modify the internal property to test hasRequiredContent logic
      (emptyTextLesson as any)._props.contentText = '   '; // Only whitespace
      expect(emptyTextLesson.hasRequiredContent()).toBe(false);

      // Video lesson with URL
      const videoLesson = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined,
        contentUrl: 'https://example.com/video.mp4'
      });
      expect(videoLesson.hasRequiredContent()).toBe(true);

      // Video lesson without URL
      const videoLessonNoUrl = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined
      });
      expect(videoLessonNoUrl.hasRequiredContent()).toBe(false);

      // Quiz and assignment lessons (always return true for now)
      const quizLesson = Lesson.create({
        ...lessonProps,
        type: 'quiz',
        contentText: undefined
      });
      expect(quizLesson.hasRequiredContent()).toBe(true);

      const assignmentLesson = Lesson.create({
        ...lessonProps,
        type: 'assignment',
        contentText: undefined
      });
      expect(assignmentLesson.hasRequiredContent()).toBe(true);
    });

    it('should check if lesson is ready for publication', () => {
      // Text lesson ready for publication
      const textLesson = Lesson.create({
        ...lessonProps,
        type: 'text',
        contentText: 'Some content'
      });
      expect(textLesson.isReadyForPublication()).toBe(true);

      // Video lesson with processed content
      const videoLesson = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined,
        contentUrl: 'https://example.com/video.mp4'
      });
      expect(videoLesson.isReadyForPublication()).toBe(true);

      // Video lesson without processed content
      const unprocessedVideoLesson = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined
      });
      expect(unprocessedVideoLesson.isReadyForPublication()).toBe(false);
    });

    it('should provide content summary', () => {
      const textLesson = Lesson.create({
        ...lessonProps,
        type: 'text',
        contentText: 'This is some content for the lesson'
      });
      expect(textLesson.getContentSummary()).toBe('Text content (35 characters)');

      const videoLesson = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined,
        contentUrl: 'https://example.com/video.mp4'
      });
      expect(videoLesson.getContentSummary()).toBe('Video processed');

      const unprocessedVideoLesson = Lesson.create({
        ...lessonProps,
        type: 'video',
        contentText: undefined
      });
      expect(unprocessedVideoLesson.getContentSummary()).toBe('Video processing...');

      const quizLesson = Lesson.create({
        ...lessonProps,
        type: 'quiz',
        contentText: undefined
      });
      expect(quizLesson.getContentSummary()).toBe('Interactive quiz');

      const assignmentLesson = Lesson.create({
        ...lessonProps,
        type: 'assignment',
        contentText: undefined
      });
      expect(assignmentLesson.getContentSummary()).toBe('Assignment submission');
    });
  });

  describe('Lesson Types', () => {
    it('should handle all supported lesson types', () => {
      const types = ['video', 'text', 'quiz', 'assignment'] as const;

      types.forEach(type => {
        const props = {
          ...lessonProps,
          type,
          contentText: type === 'text' ? 'Content' : undefined
        };

        const lesson = Lesson.create(props);
        expect(lesson.type).toBe(type);
      });
    });
  });
});