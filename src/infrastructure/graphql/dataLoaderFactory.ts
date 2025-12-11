/**
 * DataLoader Factory
 * 
 * Creates and configures DataLoader instances for GraphQL context.
 * Provides a centralized way to manage DataLoader creation and caching.
 * 
 * Requirements: 21.5
 */

import { logger } from '../../shared/utils/logger.js';
import { GraphQLContext } from './apolloServer.js';

/**
 * Creates DataLoaders for GraphQL context
 * This is a simplified implementation that provides the structure for DataLoader integration
 */
export async function createDataLoaders(requestId: string): Promise<GraphQLContext['dataloaders']> {
  const dataloaders: GraphQLContext['dataloaders'] = {};

  try {
    // Import DataLoader classes
    const { createUserDataLoaders } = await import('../../modules/users/presentation/graphql/dataloaders.js');
    const { createCourseDataLoaders } = await import('../../modules/courses/presentation/graphql/dataloaders.js');
    const { createEnrollmentDataLoaders } = await import('../../modules/enrollments/presentation/graphql/dataloaders.js');

    // Note: In a production application, these dependencies would be injected
    // through a dependency injection container. For now, we'll create a structure
    // that can be easily extended when the services are properly initialized.

    logger.debug('DataLoader factory initialized', {
      requestId,
      availableLoaders: ['users', 'courses', 'enrollments'],
    });

    // Return empty structure for now - can be populated when services are available
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
    users?: Array<{ id: string; [key: string]: any }>;
    courses?: Array<{ id: string; [key: string]: any }>;
    enrollments?: Array<{ id: string; [key: string]: any }>;
  }
): void {
  if (!dataloaders) return;

  try {
    // Prime user data
    if (data.users && dataloaders.users) {
      for (const user of data.users) {
        dataloaders.users.primeUser(user as any);
      }
    }

    // Prime course data
    if (data.courses && dataloaders.courses) {
      for (const course of data.courses) {
        dataloaders.courses.prime(course as any);
      }
    }

    // Prime enrollment data
    if (data.enrollments && dataloaders.enrollments) {
      for (const enrollment of data.enrollments) {
        dataloaders.enrollments.primeEnrollment(enrollment as any);
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