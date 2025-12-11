/**
 * Search Repository Tests
 * 
 * Tests for the SearchRepository implementation to ensure proper
 * Elasticsearch integration and error handling.
 * 
 * Requirements: 8.1, 8.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchRepository } from '../SearchRepository.js';
import type { CourseSearchDocument, LessonSearchDocument } from '../ISearchRepository.js';
import * as searchModule from '../index.js';

// Mock the Elasticsearch module
vi.mock('../index.js', async () => {
  const actual = await vi.importActual('../index.js');
  return {
    ...actual,
    elasticsearch: {
      index: vi.fn(),
      search: vi.fn(),
      delete: vi.fn(),
    },
    bulkIndex: vi.fn(),
    deleteByQuery: vi.fn(),
    refreshIndices: vi.fn(),
    getIndexStats: vi.fn(),
    checkElasticsearchHealth: vi.fn(),
  };
});

describe('SearchRepository', () => {
  let searchRepository: SearchRepository;
  let mockElasticsearch: any;

  beforeEach(() => {
    searchRepository = new SearchRepository();
    mockElasticsearch = (searchModule as any).elasticsearch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('indexCourse', () => {
    it('should successfully index a course document', async () => {
      // Arrange
      const courseDoc: CourseSearchDocument = {
        id: 'course-1',
        title: 'Test Course',
        description: 'A test course',
        slug: 'test-course',
        instructorId: 'instructor-1',
        instructorName: 'John Doe',
        category: 'programming',
        difficulty: 'beginner',
        price: 99.99,
        currency: 'USD',
        status: 'published',
        enrollmentCount: 10,
        totalReviews: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        modules: [],
        lessonContent: 'Test lesson content',
      };

      mockElasticsearch.index.mockResolvedValue({
        result: 'created',
      });

      // Act
      const result = await searchRepository.indexCourse(courseDoc);

      // Assert
      expect(result).toBe(true);
      expect(mockElasticsearch.index).toHaveBeenCalledWith({
        index: 'courses_active',
        id: 'course-1',
        body: courseDoc,
        refresh: 'wait_for',
      });
    });

    it('should handle indexing errors', async () => {
      // Arrange
      const courseDoc: CourseSearchDocument = {
        id: 'course-1',
        title: 'Test Course',
        description: 'A test course',
        slug: 'test-course',
        instructorId: 'instructor-1',
        instructorName: 'John Doe',
        category: 'programming',
        difficulty: 'beginner',
        price: 99.99,
        currency: 'USD',
        status: 'published',
        enrollmentCount: 10,
        totalReviews: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        modules: [],
        lessonContent: 'Test lesson content',
      };

      mockElasticsearch.index.mockRejectedValue(new Error('Elasticsearch error'));

      // Act & Assert
      await expect(searchRepository.indexCourse(courseDoc)).rejects.toThrow('Failed to index course document');
    });
  });

  describe('indexLesson', () => {
    it('should successfully index a lesson document', async () => {
      // Arrange
      const lessonDoc: LessonSearchDocument = {
        id: 'lesson-1',
        moduleId: 'module-1',
        courseId: 'course-1',
        title: 'Test Lesson',
        description: 'A test lesson',
        lessonType: 'video',
        contentText: 'Lesson content',
        durationMinutes: 30,
        orderNumber: 1,
        isPreview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        courseTitle: 'Test Course',
        courseCategory: 'programming',
        courseDifficulty: 'beginner',
      };

      mockElasticsearch.index.mockResolvedValue({
        result: 'created',
      });

      // Act
      const result = await searchRepository.indexLesson(lessonDoc);

      // Assert
      expect(result).toBe(true);
      expect(mockElasticsearch.index).toHaveBeenCalledWith({
        index: 'lessons_active',
        id: 'lesson-1',
        body: lessonDoc,
        refresh: 'wait_for',
      });
    });
  });

  describe('bulkIndexCourses', () => {
    it('should successfully bulk index course documents', async () => {
      // Arrange
      const courseDocs: CourseSearchDocument[] = [
        {
          id: 'course-1',
          title: 'Test Course 1',
          description: 'A test course',
          slug: 'test-course-1',
          instructorId: 'instructor-1',
          instructorName: 'John Doe',
          category: 'programming',
          difficulty: 'beginner',
          price: 99.99,
          currency: 'USD',
          status: 'published',
          enrollmentCount: 10,
          totalReviews: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          modules: [],
          lessonContent: 'Test lesson content',
        },
      ];

      (searchModule.bulkIndex as any).mockResolvedValue({
        success: true,
        indexed: 1,
        errors: [],
      });

      // Act
      const result = await searchRepository.bulkIndexCourses(courseDocs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.indexed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('searchCourses', () => {
    it('should successfully search courses with query', async () => {
      // Arrange
      const mockResponse = {
        hits: {
          hits: [
            {
              _source: {
                id: 'course-1',
                title: 'Test Course',
                description: 'A test course',
              },
              highlight: {},
            },
          ],
          total: { value: 1 },
          max_score: 1.0,
        },
        took: 5,
      };

      mockElasticsearch.search.mockResolvedValue(mockResponse);

      // Act
      const result = await searchRepository.searchCourses('test query');

      // Assert
      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.took).toBe(5);
      expect(result.maxScore).toBe(1.0);
    });

    it('should handle search with filters', async () => {
      // Arrange
      const mockResponse = {
        hits: {
          hits: [],
          total: { value: 0 },
          max_score: null,
        },
        took: 2,
      };

      mockElasticsearch.search.mockResolvedValue(mockResponse);

      // Act
      const result = await searchRepository.searchCourses('test', {
        filters: {
          category: ['programming'],
          difficulty: ['beginner'],
          priceRange: { min: 0, max: 100 },
        },
        sort: { field: 'price', order: 'asc' },
        pagination: { from: 0, size: 10 },
      });

      // Assert
      expect(result.documents).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockElasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'courses_active',
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { terms: { category: ['programming'] } },
                  { terms: { difficulty: ['beginner'] } },
                  { range: { price: { gte: 0, lte: 100 } } },
                ]),
              }),
            }),
            sort: [{ price: { order: 'asc' } }, '_score'],
            from: 0,
            size: 10,
          }),
        })
      );
    });
  });

  describe('deleteCourse', () => {
    it('should successfully delete a course document', async () => {
      // Arrange
      mockElasticsearch.delete.mockResolvedValue({
        result: 'deleted',
      });

      // Act
      const result = await searchRepository.deleteCourse('course-1');

      // Assert
      expect(result).toBe(true);
      expect(mockElasticsearch.delete).toHaveBeenCalledWith({
        index: 'courses_active',
        id: 'course-1',
        refresh: 'wait_for',
      });
    });

    it('should handle document not found', async () => {
      // Arrange
      const error = new Error('Not found');
      (error as any).statusCode = 404;
      mockElasticsearch.delete.mockRejectedValue(error);

      // Act
      const result = await searchRepository.deleteCourse('course-1');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('checkHealth', () => {
    it('should return health status', async () => {
      // Arrange
      (searchModule.checkElasticsearchHealth as any).mockResolvedValue({
        healthy: true,
        indices: { courses: true, lessons: true },
      });

      // Act
      const result = await searchRepository.checkHealth();

      // Assert
      expect(result.healthy).toBe(true);
      expect(result.indices.courses).toBe(true);
      expect(result.indices.lessons).toBe(true);
    });
  });

  describe('bulkReindex', () => {
    it('should handle bulk reindex operation', async () => {
      // Act
      const result = await searchRepository.bulkReindex('all');

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Course reindexing not yet implemented');
      expect(result.errors).toContain('Lesson reindexing not yet implemented');
    });
  });
});