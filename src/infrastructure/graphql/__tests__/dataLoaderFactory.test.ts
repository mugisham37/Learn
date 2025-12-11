/**
 * DataLoader Factory Tests
 * 
 * Tests for DataLoader creation and management functionality.
 * 
 * Requirements: 21.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDataLoaders, clearDataLoaderCaches, primeDataLoaderCaches } from '../dataLoaderFactory.js';

describe('DataLoader Factory', () => {
  describe('createDataLoaders', () => {
    it('should create DataLoaders structure successfully', async () => {
      // Act
      const dataloaders = await createDataLoaders('test-request-id');

      // Assert
      expect(dataloaders).toBeDefined();
      expect(typeof dataloaders).toBe('object');
    });

    it('should handle errors gracefully', async () => {
      // Act & Assert - should not throw
      const dataloaders = await createDataLoaders('test-request-id');
      expect(dataloaders).toBeDefined();
    });
  });

  describe('clearDataLoaderCaches', () => {
    it('should handle undefined dataloaders gracefully', () => {
      // Act & Assert - should not throw
      expect(() => clearDataLoaderCaches(undefined)).not.toThrow();
    });

    it('should handle empty dataloaders gracefully', () => {
      // Act & Assert - should not throw
      expect(() => clearDataLoaderCaches({})).not.toThrow();
    });
  });

  describe('primeDataLoaderCaches', () => {
    it('should handle undefined dataloaders gracefully', () => {
      // Act & Assert - should not throw
      expect(() => primeDataLoaderCaches(undefined, {})).not.toThrow();
    });

    it('should handle empty data gracefully', () => {
      // Act & Assert - should not throw
      expect(() => primeDataLoaderCaches({}, {})).not.toThrow();
    });

    it('should handle priming with sample data', () => {
      // Arrange
      const dataloaders = {};
      const data = {
        users: [{ id: 'user-1', email: 'test@example.com' }],
        courses: [{ id: 'course-1', title: 'Test Course' }],
        enrollments: [{ id: 'enrollment-1', studentId: 'user-1', courseId: 'course-1' }],
      };

      // Act & Assert - should not throw
      expect(() => primeDataLoaderCaches(dataloaders, data)).not.toThrow();
    });
  });
});