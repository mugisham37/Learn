/**
 * Assignment Repository Tests
 * 
 * Basic tests to verify assignment repository implementation compiles
 * and basic functionality works correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database functions
vi.mock('../../../src/infrastructure/database/index.js', () => ({
  getWriteDb: vi.fn(),
  getReadDb: vi.fn(),
}));

// Mock cache
vi.mock('../../../src/infrastructure/cache/index.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    deletePattern: vi.fn(),
  },
  buildCacheKey: vi.fn((...args: any[]) => args.join(':')),
  CachePrefix: {
    ASSIGNMENT: 'assignment',
  },
  CacheTTL: {
    MEDIUM: 300,
  },
}));

import { AssignmentRepository } from '../../../src/modules/assessments/infrastructure/repositories/AssignmentRepository.js';
import { CreateAssignmentDTO } from '../../../src/modules/assessments/infrastructure/repositories/IAssignmentRepository.js';
import { getWriteDb, getReadDb } from '../../../src/infrastructure/database/index.js';
import { cache } from '../../../src/infrastructure/cache/index.js';

describe('AssignmentRepository', () => {
  let assignmentRepository: AssignmentRepository;

  // Mock database objects
  const mockWriteDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  const mockReadDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks
    vi.mocked(getWriteDb).mockReturnValue(mockWriteDb as any);
    vi.mocked(getReadDb).mockReturnValue(mockReadDb as any);
    
    assignmentRepository = new AssignmentRepository();
  });

  describe('create', () => {
    it('should create assignment successfully', async () => {
      // Arrange
      const createData: CreateAssignmentDTO = {
        lessonId: 'lesson-123',
        title: 'Test Assignment',
        instructions: 'Complete the assignment',
        dueDate: new Date('2024-12-31'),
        maxPoints: 100,
        allowedFileTypes: ['pdf', 'docx'],
      };

      const mockCreatedAssignment = {
        id: 'assignment-123',
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWriteDb.returning.mockResolvedValue([mockCreatedAssignment]);

      // Act
      const result = await assignmentRepository.create(createData);

      // Assert
      expect(result).toEqual(mockCreatedAssignment);
      expect(mockWriteDb.insert).toHaveBeenCalled();
      expect(mockWriteDb.values).toHaveBeenCalled();
      expect(mockWriteDb.returning).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return assignment from cache if available', async () => {
      // Arrange
      const assignmentId = 'assignment-123';
      const mockAssignment = {
        id: assignmentId,
        title: 'Test Assignment',
      };

      vi.mocked(cache.get).mockResolvedValue(mockAssignment);

      // Act
      const result = await assignmentRepository.findById(assignmentId);

      // Assert
      expect(result).toEqual(mockAssignment);
      expect(cache.get).toHaveBeenCalled();
      expect(mockReadDb.select).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true if assignment exists', async () => {
      // Arrange
      const assignmentId = 'assignment-123';
      const mockAssignment = { id: assignmentId };

      vi.mocked(cache.get).mockResolvedValue(mockAssignment);

      // Act
      const result = await assignmentRepository.exists(assignmentId);

      // Assert
      expect(result).toBe(true);
    });
  });
});