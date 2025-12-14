/**
 * DataLoader Factory
 *
 * Creates and configures DataLoader instances for GraphQL context.
 * Provides a centralized way to manage DataLoader creation and caching.
 *
 * Requirements: 21.5
 */

import { logger } from '../../shared/utils/logger.js';

import { GraphQLContext, UserDataLoaderInterface, CourseDataLoaderInterface, EnrollmentDataLoaderInterface } from './types.js';

/**
 * Creates DataLoaders for GraphQL context
 * This is a simplified implementation that provides the structure for DataLoader integration
 */
export async function createDataLoaders(requestId: string): Promise<GraphQLContext['dataloaders']> {
  const dataloaders: GraphQLContext['dataloaders'] = {};

  try {
    // For now, we'll create placeholder DataLoader implementations
    // In a real implementation, these would be properly initialized with repositories and services
    
    // Create mock DataLoader implementations that satisfy the interface
    const mockUserDataLoaders: UserDataLoaderInterface = {
      userById: {
        load: async () => ({}),
        loadMany: async () => [],
        clear: () => mockUserDataLoaders.userById,
        clearAll: () => mockUserDataLoaders.userById,
        prime: () => mockUserDataLoaders.userById,
      },
      usersByIds: {
        load: async () => [],
        loadMany: async () => [],
        clear: () => mockUserDataLoaders.usersByIds,
        clearAll: () => mockUserDataLoaders.usersByIds,
        prime: () => mockUserDataLoaders.usersByIds,
      },
      clearAll: () => {},
      primeUser: () => {},
    };

    const mockCourseDataLoaders: CourseDataLoaderInterface = {
      courseById: {
        load: async () => ({}),
        loadMany: async () => [],
        clear: () => mockCourseDataLoaders.courseById,
        clearAll: () => mockCourseDataLoaders.courseById,
        prime: () => mockCourseDataLoaders.courseById,
      },
      coursesByInstructorId: {
        load: async () => [],
        loadMany: async () => [],
        clear: () => mockCourseDataLoaders.coursesByInstructorId,
        clearAll: () => mockCourseDataLoaders.coursesByInstructorId,
        prime: () => mockCourseDataLoaders.coursesByInstructorId,
      },
      modulesByCourseId: {
        load: async () => [],
        loadMany: async () => [],
        clear: () => mockCourseDataLoaders.modulesByCourseId,
        clearAll: () => mockCourseDataLoaders.modulesByCourseId,
        prime: () => mockCourseDataLoaders.modulesByCourseId,
      },
      clearAll: () => {},
      prime: () => {},
    };

    const mockEnrollmentDataLoaders: EnrollmentDataLoaderInterface = {
      enrollmentById: {
        load: async () => ({}),
        loadMany: async () => [],
        clear: () => mockEnrollmentDataLoaders.enrollmentById,
        clearAll: () => mockEnrollmentDataLoaders.enrollmentById,
        prime: () => mockEnrollmentDataLoaders.enrollmentById,
      },
      enrollmentsByStudentId: {
        load: async () => [],
        loadMany: async () => [],
        clear: () => mockEnrollmentDataLoaders.enrollmentsByStudentId,
        clearAll: () => mockEnrollmentDataLoaders.enrollmentsByStudentId,
        prime: () => mockEnrollmentDataLoaders.enrollmentsByStudentId,
      },
      enrollmentsByCourseId: {
        load: async () => [],
        loadMany: async () => [],
        clear: () => mockEnrollmentDataLoaders.enrollmentsByCourseId,
        clearAll: () => mockEnrollmentDataLoaders.enrollmentsByCourseId,
        prime: () => mockEnrollmentDataLoaders.enrollmentsByCourseId,
      },
      clearAll: () => {},
      primeEnrollment: () => {},
    };

    // Populate the dataloaders object
    dataloaders.users = mockUserDataLoaders;
    dataloaders.courses = mockCourseDataLoaders;
    dataloaders.enrollments = mockEnrollmentDataLoaders;

    logger.debug('DataLoader factory initialized', {
      requestId,
      availableLoaders: ['users', 'courses', 'enrollments'],
    });

    return dataloaders;
  } catch (error) {
    logger.warn('Failed to initialize DataLoader factory', {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });

    return dataloaders;
  }
}

/**
 * Clears all DataLoader caches
 * Should be called when data is updated to ensure consistency
 */
export function clearDataLoaderCaches(dataloaders: GraphQLContext['dataloaders']): void {
  if (!dataloaders) return;

  try {
    if (dataloaders.users) {
      dataloaders.users.clearAll();
    }

    if (dataloaders.courses) {
      dataloaders.courses.clearAll();
    }

    if (dataloaders.enrollments) {
      dataloaders.enrollments.clearAll();
    }

    logger.debug('DataLoader caches cleared successfully');
  } catch (error) {
    logger.warn('Failed to clear DataLoader caches', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Primes DataLoader caches with data
 * Useful for optimizing queries when data is already available
 */
export function primeDataLoaderCaches(
  dataloaders: GraphQLContext['dataloaders'],
  data: {
    users?: Array<{ id: string; [key: string]: unknown }>;
    courses?: Array<{ id: string; [key: string]: unknown }>;
    enrollments?: Array<{ id: string; [key: string]: unknown }>;
  }
): void {
  if (!dataloaders) return;

  try {
    // Prime user data
    if (data.users && dataloaders.users) {
      for (const user of data.users) {
        dataloaders.users.primeUser(user);
      }
    }

    // Prime course data
    if (data.courses && dataloaders.courses) {
      for (const course of data.courses) {
        dataloaders.courses.prime(course);
      }
    }

    // Prime enrollment data
    if (data.enrollments && dataloaders.enrollments) {
      for (const enrollment of data.enrollments) {
        dataloaders.enrollments.primeEnrollment(enrollment);
      }
    }

    logger.debug('DataLoader caches primed successfully', {
      userCount: data.users?.length || 0,
      courseCount: data.courses?.length || 0,
      enrollmentCount: data.enrollments?.length || 0,
    });
  } catch (error) {
    logger.warn('Failed to prime DataLoader caches', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
