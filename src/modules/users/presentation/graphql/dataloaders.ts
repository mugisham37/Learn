/**
 * DataLoader implementations for Users Module
 *
 * Provides efficient batching and caching for GraphQL field resolvers
 * to prevent N+1 query problems.
 *
 * Requirements: 21.5
 */

import DataLoader from 'dataloader';

import { User } from '../../../../infrastructure/database/schema/users.schema.js';
import { IUserProfileService } from '../../application/services/IUserProfileService.js';
import { UserProfile } from '../../domain/value-objects/UserProfile.js';
import { IUserRepository } from '../../infrastructure/repositories/IUserRepository.js';

/**
 * DataLoader context interface for Users module
 */
export interface UserDataLoaderContext {
  userRepository: IUserRepository;
  userProfileService: IUserProfileService;
}

/**
 * User DataLoaders for efficient data fetching
 */
export class UserDataLoaders {
  public readonly userById: DataLoader<string, User | null>;
  public readonly usersByIds: DataLoader<string, User[]>;
  public readonly userProfileById: DataLoader<string, UserProfile | null>;

  constructor(private readonly context: UserDataLoaderContext) {
    // User by ID loader
    this.userById = new DataLoader<string, User | null>(
      async (userIds: readonly string[]) => {
        const users = await this.batchLoadUsersByIds([...userIds]);
        return userIds.map((id) => users.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
      }
    );

    // Users by IDs loader (for batch operations)
    this.usersByIds = new DataLoader<string, User[]>(
      async (userIdArrays: readonly string[]) => {
        // This is for cases where we need multiple users at once
        // For now, we'll implement it as individual lookups
        const results = await Promise.all(
          userIdArrays.map(async (userIdString) => {
            const userIds = userIdString.split(',');
            const users = await this.batchLoadUsersByIds(userIds);
            return userIds.map((id) => users.get(id)).filter(Boolean) as User[];
          })
        );
        return results;
      },
      {
        cache: true,
        maxBatchSize: 50,
        batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
      }
    );

    // User profile by user ID loader
    this.userProfileById = new DataLoader<string, UserProfile | null>(
      async (userIds: readonly string[]) => {
        const profiles = await this.batchLoadUserProfilesByIds([...userIds]);
        return userIds.map((id) => profiles.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
        batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
      }
    );
  }

  /**
   * Batch load users by IDs
   */
  private async batchLoadUsersByIds(userIds: string[]): Promise<Map<string, User>> {
    const usersMap = new Map<string, User>();

    // Load users individually (can be optimized later with batch repository method)
    const userPromises = userIds.map(async (id) => {
      try {
        const user = await this.context.userRepository.findById(id);
        return { id, user };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load user ${id}:`, error);
        return { id, user: null };
      }
    });

    const results = await Promise.all(userPromises);

    for (const { id, user } of results) {
      if (user) {
        usersMap.set(id, user);
      }
    }

    return usersMap;
  }

  /**
   * Batch load user profiles by user IDs
   */
  private async batchLoadUserProfilesByIds(userIds: string[]): Promise<Map<string, UserProfile>> {
    const profilesMap = new Map<string, UserProfile>();

    // Load profiles individually using the service
    const profilePromises = userIds.map(async (userId) => {
      try {
        const profile = await this.context.userProfileService.getUserProfile(userId);
        return { userId, profile };
      } catch (error) {
        // Log error but don't fail the entire batch
        console.warn(`Failed to load user profile ${userId}:`, error);
        return { userId, profile: null };
      }
    });

    const results = await Promise.all(profilePromises);

    for (const { userId, profile } of results) {
      if (profile) {
        profilesMap.set(userId, profile);
      }
    }

    return profilesMap;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.userById.clearAll();
    this.usersByIds.clearAll();
    this.userProfileById.clearAll();
  }

  /**
   * Prime cache with user data
   */
  primeUser(user: User): void {
    this.userById.prime(user.id, user);
  }

  /**
   * Prime cache with user profile data
   */
  primeUserProfile(userId: string, profile: UserProfile): void {
    this.userProfileById.prime(userId, profile);
  }
}

/**
 * Factory function to create User DataLoaders
 */
export function createUserDataLoaders(context: UserDataLoaderContext): UserDataLoaders {
  return new UserDataLoaders(context);
}
