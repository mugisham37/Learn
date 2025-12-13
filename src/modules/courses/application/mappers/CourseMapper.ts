/**
 * Course Mapper
 *
 * Maps between database schema types and domain entities.
 * Handles conversion between plain objects from Drizzle ORM and rich domain objects.
 */

import { Course as CourseEntity, CourseProps } from '../../domain/entities/Course.js';
import {
  CourseModule as CourseModuleEntity,
  CourseModuleProps,
} from '../../domain/entities/CourseModule.js';
import { Lesson as LessonEntity, LessonProps } from '../../domain/entities/Lesson.js';
import {
  Course as CourseSchema,
  CourseModule as CourseModuleSchema,
  Lesson as LessonSchema,
} from '../../../../infrastructure/database/schema/courses.schema.js';

/**
 * Course Mapper
 *
 * Provides static methods to convert between database schema types and domain entities.
 */
export class CourseMapper {
  /**
   * Maps database course schema to domain entity
   */
  static toDomain(courseData: CourseSchema): CourseEntity {
    const props: CourseProps = {
      id: courseData.id,
      instructorId: courseData.instructorId,
      title: courseData.title,
      description: courseData.description,
      slug: courseData.slug,
      category: courseData.category,
      difficulty: courseData.difficulty as 'beginner' | 'intermediate' | 'advanced',
      price: parseFloat(courseData.price),
      currency: courseData.currency,
      enrollmentLimit: courseData.enrollmentLimit || undefined,
      enrollmentCount: courseData.enrollmentCount,
      averageRating: courseData.averageRating ? parseFloat(courseData.averageRating) : undefined,
      totalReviews: courseData.totalReviews,
      status: courseData.status as 'draft' | 'pending_review' | 'published' | 'archived',
      publishedAt: courseData.publishedAt || undefined,
      thumbnailUrl: courseData.thumbnailUrl || undefined,
      createdAt: courseData.createdAt,
      updatedAt: courseData.updatedAt,
    };

    return new CourseEntity(props);
  }

  /**
   * Maps array of database course schemas to domain entities
   */
  static toDomainArray(coursesData: CourseSchema[]): CourseEntity[] {
    return coursesData.map((courseData) => this.toDomain(courseData));
  }

  /**
   * Maps domain entity to database schema (for updates)
   * Note: This is typically not needed as repositories handle the conversion,
   * but provided for completeness
   */
  static toSchema(course: CourseEntity): Partial<CourseSchema> {
    return {
      id: course.id,
      instructorId: course.instructorId,
      title: course.title,
      description: course.description,
      slug: course.slug,
      category: course.category,
      difficulty: course.difficulty,
      price: course.price.toString(),
      currency: course.currency,
      enrollmentLimit: course.enrollmentLimit,
      enrollmentCount: course.enrollmentCount,
      averageRating: course.averageRating?.toString(),
      totalReviews: course.totalReviews,
      status: course.status,
      publishedAt: course.publishedAt,
      thumbnailUrl: course.thumbnailUrl,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}

/**
 * Course Module Mapper
 */
export class CourseModuleMapper {
  /**
   * Maps database course module schema to domain entity
   */
  static toDomain(moduleData: CourseModuleSchema): CourseModuleEntity {
    const props: CourseModuleProps = {
      id: moduleData.id,
      courseId: moduleData.courseId,
      title: moduleData.title,
      description: moduleData.description || undefined,
      orderNumber: moduleData.orderNumber,
      durationMinutes: moduleData.durationMinutes,
      prerequisiteModuleId: moduleData.prerequisiteModuleId || undefined,
      createdAt: moduleData.createdAt,
      updatedAt: moduleData.updatedAt,
    };

    return new CourseModuleEntity(props);
  }

  /**
   * Maps array of database course module schemas to domain entities
   */
  static toDomainArray(modulesData: CourseModuleSchema[]): CourseModuleEntity[] {
    return modulesData.map((moduleData) => this.toDomain(moduleData));
  }

  /**
   * Maps domain entity to database schema
   */
  static toSchema(module: CourseModuleEntity): Partial<CourseModuleSchema> {
    return {
      id: module.id,
      courseId: module.courseId,
      title: module.title,
      description: module.description,
      orderNumber: module.orderNumber,
      durationMinutes: module.durationMinutes,
      prerequisiteModuleId: module.prerequisiteModuleId,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
    };
  }
}

/**
 * Lesson Mapper
 */
export class LessonMapper {
  /**
   * Maps database lesson schema to domain entity
   */
  static toDomain(lessonData: LessonSchema): LessonEntity {
    const props: LessonProps = {
      id: lessonData.id,
      moduleId: lessonData.moduleId,
      title: lessonData.title,
      description: lessonData.description || undefined,
      type: lessonData.lessonType as 'video' | 'text' | 'quiz' | 'assignment',
      contentUrl: lessonData.contentUrl || undefined,
      contentText: lessonData.contentText || undefined,
      durationMinutes: lessonData.durationMinutes || undefined,
      orderNumber: lessonData.orderNumber,
      isPreview: lessonData.isPreview,
      metadata: lessonData.metadata as Record<string, any>,
      createdAt: lessonData.createdAt,
      updatedAt: lessonData.updatedAt,
    };

    return new LessonEntity(props);
  }

  /**
   * Maps array of database lesson schemas to domain entities
   */
  static toDomainArray(lessonsData: LessonSchema[]): LessonEntity[] {
    return lessonsData.map((lessonData) => this.toDomain(lessonData));
  }

  /**
   * Maps domain entity to database schema
   */
  static toSchema(lesson: LessonEntity): Partial<LessonSchema> {
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      title: lesson.title,
      description: lesson.description,
      lessonType: lesson.type,
      contentUrl: lesson.contentUrl,
      contentText: lesson.contentText,
      durationMinutes: lesson.durationMinutes,
      orderNumber: lesson.orderNumber,
      isPreview: lesson.isPreview,
      metadata: lesson.metadata,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
