/**
 * DataLoader implementations for Courses Module
 *
 * Provides efficient batching and caching for GraphQL field resolvers
 * to prevent N+1 query problems.
 *
 * Requirements: 21.5
 */

import * as DataLoader from 'dataloader';
import { ICourseService } from '../../application/services/ICourseService.js';
import { Course } from '../../domain/entities/Course.js';
import { CourseModule } from '../../domain/entities/CourseModule.js';
import { Lesson } from '../../domain/entities/Lesson.js';
import { ICourseRepository } from '../../infrastructure/repositories/ICourseRepository.js';
import { ICourseModuleRepository } from '../../infrastructure/repositories/ICourseModuleRepository.js';
import { ILessonRepository } from '../../infrastructure/repositories/ILessonRepository.js';

/**
 * DataLoader context interface
 */
export interface DataLoaderContext {
  courseService: ICourseService;
  courseRepository: ICourseRepository;
  moduleRepository: ICourseModuleRepository;
  lessonRepository: ILessonRepository;
}

/**
 * Course DataLoaders for efficient data fetching
 */
export class CourseDataLoaders {
  public readonly courseById: DataLoader<string, Course | null>;
  public readonly coursesByInstructorId: DataLoader<string, Course[]>;
  public readonly modulesByCourseId: DataLoader<string, CourseModule[]>;
  public readonly moduleById: DataLoader<string, CourseModule | null>;
  public readonly lessonsByModuleId: DataLoader<string, Lesson[]>;
  public readonly lessonById: DataLoader<string, Lesson | null>;

  constructor(private readonly context: DataLoaderContext) {
    // Course by ID loader
    this.courseById = new DataLoader<string, Course | null>(
      async (courseIds: readonly string[]) => {
        const courses = await this.batchLoadCoursesByIds([...courseIds]);
        return courseIds.map((id) => courses.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );

    // Courses by instructor ID loader
    this.coursesByInstructorId = new DataLoader<string, Course[]>(
      async (instructorIds: readonly string[]) => {
        const coursesMap = await this.batchLoadCoursesByInstructorIds([...instructorIds]);
        return instructorIds.map((id) => coursesMap.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 50,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );

    // Modules by course ID loader
    this.modulesByCourseId = new DataLoader<string, CourseModule[]>(
      async (courseIds: readonly string[]) => {
        const modulesMap = await this.batchLoadModulesByCourseIds([...courseIds]);
        return courseIds.map((id) => modulesMap.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );

    // Module by ID loader
    this.moduleById = new DataLoader<string, CourseModule | null>(
      async (moduleIds: readonly string[]) => {
        const modules = await this.batchLoadModulesByIds([...moduleIds]);
        return moduleIds.map((id) => modules.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );

    // Lessons by module ID loader
    this.lessonsByModuleId = new DataLoader<string, Lesson[]>(
      async (moduleIds: readonly string[]) => {
        const lessonsMap = await this.batchLoadLessonsByModuleIds([...moduleIds]);
        return moduleIds.map((id) => lessonsMap.get(id) || []);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );

    // Lesson by ID loader
    this.lessonById = new DataLoader<string, Lesson | null>(
      async (lessonIds: readonly string[]) => {
        const lessons = await this.batchLoadLessonsByIds([...lessonIds]);
        return lessonIds.map((id) => lessons.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback) => setTimeout(callback, 10),
      }
    );
  }

  /**
   * Batch load courses by IDs
   */
  private async batchLoadCoursesByIds(courseIds: string[]): Promise<Map<string, Course>> {
    const coursesMap = new Map<string, Course>();

    // Load courses individually (can be optimized later with batch repository method)
    const coursePromises = courseIds.map((id) => this.context.courseService.getCourseById(id));
    const courses = await Promise.all(coursePromises);

    for (let i = 0; i < courseIds.length; i++) {
      const course = courses[i];
      if (course) {
        coursesMap.set(courseIds[i], course);
      }
    }

    return coursesMap;
  }

  /**
   * Batch load courses by instructor IDs
   */
  private async batchLoadCoursesByInstructorIds(
    instructorIds: string[]
  ): Promise<Map<string, Course[]>> {
    const coursesMap = new Map<string, Course[]>();

    // Initialize empty arrays for all instructor IDs
    for (const instructorId of instructorIds) {
      coursesMap.set(instructorId, []);
    }

    // Load courses for each instructor individually (can be optimized later)
    const coursePromises = instructorIds.map(async (instructorId) => {
      const result = await this.context.courseService.getCoursesByInstructor(
        instructorId,
        { page: 1, limit: 100 } // Load first 100 courses per instructor
      );
      return { instructorId, courses: result.data };
    });

    const results = await Promise.all(coursePromises);

    for (const { instructorId, courses } of results) {
      coursesMap.set(instructorId, courses);
    }

    return coursesMap;
  }

  /**
   * Batch load modules by course IDs
   */
  private async batchLoadModulesByCourseIds(
    courseIds: string[]
  ): Promise<Map<string, CourseModule[]>> {
    const modulesMap = new Map<string, CourseModule[]>();

    // Initialize empty arrays for all course IDs
    for (const courseId of courseIds) {
      modulesMap.set(courseId, []);
    }

    // Load modules for each course individually using existing repository method
    const modulePromises = courseIds.map(async (courseId) => {
      const modules = await this.context.moduleRepository.findByCourse(courseId);
      return { courseId, modules };
    });

    const results = await Promise.all(modulePromises);

    for (const { courseId, modules } of results) {
      const domainModules = modules.map(
        (moduleSchema) =>
          new CourseModule({
            id: moduleSchema.id,
            courseId: moduleSchema.courseId,
            title: moduleSchema.title,
            description: moduleSchema.description || undefined,
            orderNumber: moduleSchema.orderNumber,
            durationMinutes: moduleSchema.durationMinutes,
            prerequisiteModuleId: moduleSchema.prerequisiteModuleId || undefined,
            createdAt: moduleSchema.createdAt,
            updatedAt: moduleSchema.updatedAt,
          })
      );

      // Modules are already sorted by order number from repository
      modulesMap.set(courseId, domainModules);
    }

    return modulesMap;
  }

  /**
   * Batch load modules by IDs
   */
  private async batchLoadModulesByIds(moduleIds: string[]): Promise<Map<string, CourseModule>> {
    const modulesMap = new Map<string, CourseModule>();

    // Load modules individually using existing repository method
    const modulePromises = moduleIds.map((id) => this.context.moduleRepository.findById(id));
    const modules = await Promise.all(modulePromises);

    for (let i = 0; i < moduleIds.length; i++) {
      const moduleSchema = modules[i];
      if (moduleSchema) {
        // Convert schema to domain entity
        const module = new CourseModule({
          id: moduleSchema.id,
          courseId: moduleSchema.courseId,
          title: moduleSchema.title,
          description: moduleSchema.description || undefined,
          orderNumber: moduleSchema.orderNumber,
          durationMinutes: moduleSchema.durationMinutes,
          prerequisiteModuleId: moduleSchema.prerequisiteModuleId || undefined,
          createdAt: moduleSchema.createdAt,
          updatedAt: moduleSchema.updatedAt,
        });

        modulesMap.set(moduleSchema.id, module);
      }
    }

    return modulesMap;
  }

  /**
   * Batch load lessons by module IDs
   */
  private async batchLoadLessonsByModuleIds(moduleIds: string[]): Promise<Map<string, Lesson[]>> {
    const lessonsMap = new Map<string, Lesson[]>();

    // Initialize empty arrays for all module IDs
    for (const moduleId of moduleIds) {
      lessonsMap.set(moduleId, []);
    }

    // Load lessons for each module individually using existing repository method
    const lessonPromises = moduleIds.map(async (moduleId) => {
      const lessons = await this.context.lessonRepository.findByModule(moduleId);
      return { moduleId, lessons };
    });

    const results = await Promise.all(lessonPromises);

    for (const { moduleId, lessons } of results) {
      const domainLessons = lessons.map(
        (lessonSchema) =>
          new Lesson({
            id: lessonSchema.id,
            moduleId: lessonSchema.moduleId,
            title: lessonSchema.title,
            description: lessonSchema.description || undefined,
            type: lessonSchema.lessonType,
            contentUrl: lessonSchema.contentUrl || undefined,
            contentText: lessonSchema.contentText || undefined,
            durationMinutes: lessonSchema.durationMinutes || undefined,
            orderNumber: lessonSchema.orderNumber,
            isPreview: lessonSchema.isPreview,
            metadata: lessonSchema.metadata || {},
            createdAt: lessonSchema.createdAt,
            updatedAt: lessonSchema.updatedAt,
          })
      );

      // Lessons are already sorted by order number from repository
      lessonsMap.set(moduleId, domainLessons);
    }

    return lessonsMap;
  }

  /**
   * Batch load lessons by IDs
   */
  private async batchLoadLessonsByIds(lessonIds: string[]): Promise<Map<string, Lesson>> {
    const lessonsMap = new Map<string, Lesson>();

    // Load lessons individually using existing repository method
    const lessonPromises = lessonIds.map((id) => this.context.lessonRepository.findById(id));
    const lessons = await Promise.all(lessonPromises);

    for (let i = 0; i < lessonIds.length; i++) {
      const lessonSchema = lessons[i];
      if (lessonSchema) {
        // Convert schema to domain entity
        const lesson = new Lesson({
          id: lessonSchema.id,
          moduleId: lessonSchema.moduleId,
          title: lessonSchema.title,
          description: lessonSchema.description || undefined,
          type: lessonSchema.lessonType,
          contentUrl: lessonSchema.contentUrl || undefined,
          contentText: lessonSchema.contentText || undefined,
          durationMinutes: lessonSchema.durationMinutes || undefined,
          orderNumber: lessonSchema.orderNumber,
          isPreview: lessonSchema.isPreview,
          metadata: lessonSchema.metadata || {},
          createdAt: lessonSchema.createdAt,
          updatedAt: lessonSchema.updatedAt,
        });

        lessonsMap.set(lessonSchema.id, lesson);
      }
    }

    return lessonsMap;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.courseById.clearAll();
    this.coursesByInstructorId.clearAll();
    this.modulesByCourseId.clearAll();
    this.moduleById.clearAll();
    this.lessonsByModuleId.clearAll();
    this.lessonById.clearAll();
  }

  /**
   * Prime cache with data
   */
  prime(course: Course): void {
    this.courseById.prime(course.id, course);

    // Prime modules if they exist
    if (course.modules) {
      this.modulesByCourseId.prime(course.id, course.modules);
      for (const module of course.modules) {
        this.moduleById.prime(module.id, module);

        // Prime lessons if they exist
        if (module.lessons) {
          this.lessonsByModuleId.prime(module.id, module.lessons);
          for (const lesson of module.lessons) {
            this.lessonById.prime(lesson.id, lesson);
          }
        }
      }
    }
  }
}

/**
 * Factory function to create DataLoaders
 */
export function createCourseDataLoaders(context: DataLoaderContext): CourseDataLoaders {
  return new CourseDataLoaders(context);
}
