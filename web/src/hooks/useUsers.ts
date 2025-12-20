/**
 * User Management Hooks
 * 
 * React hooks for user-related operations including profile management,
 * notification preferences, and user data fetching.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache, type MutationResult as ApolloMutationResult } from '@apollo/client';
import type {
  User,
  UpdateProfileInput,
  UpdateNotificationPreferencesInput,
} from '../types';
import type {
  GetCurrentUserResponse,
  GetUserByIdResponse,
  UpdateProfileResponse,
  UpdateNotificationPreferencesResponse,
} from '../types/graphql-responses';

// GraphQL Queries and Mutations
const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    currentUser {
      id
      email
      role
      emailVerified
      profile {
        fullName
        bio
        timezone
        language
        avatarUrl
      }
      notificationPreferences {
        emailNotifications
        pushNotifications
        courseUpdates
        messageNotifications
        assignmentReminders
      }
      createdAt
      updatedAt
    }
  }
`;

const GET_USER_BY_ID = gql`
  query GetUserById($id: ID!) {
    user(id: $id) {
      id
      email
      role
      profile {
        fullName
        bio
        timezone
        language
        avatarUrl
      }
      createdAt
    }
  }
`;

const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      profile {
        fullName
        bio
        timezone
        language
        avatarUrl
      }
      updatedAt
    }
  }
`;

const UPDATE_NOTIFICATION_PREFERENCES = gql`
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {
      id
      notificationPreferences {
        emailNotifications
        pushNotifications
        courseUpdates
        messageNotifications
        assignmentReminders
      }
      updatedAt
    }
  }
`;

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

interface MutationResult<T, V = Record<string, unknown>> {
  mutate: (variables: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

/**
 * Hook for fetching the current authenticated user's data
 * 
 * @returns Query result with current user data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { data: user, loading, error, refetch } = useCurrentUser();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return <div>Welcome, {user?.profile.fullName}!</div>;
 * }
 * ```
 */
export function useCurrentUser(): QueryResult<User> {
  const { data, loading, error, refetch } = useQuery<GetCurrentUserResponse>(GET_CURRENT_USER, {
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  return {
    data: data?.currentUser,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching a specific user by ID
 * 
 * @param id - The user ID to fetch
 * @returns Query result with user data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function UserCard({ userId }: { userId: string }) {
 *   const { data: user, loading, error } = useUserById(userId);
 *   
 *   if (loading) return <div>Loading user...</div>;
 *   if (error) return <div>User not found</div>;
 *   
 *   return <div>{user?.profile.fullName}</div>;
 * }
 * ```
 */
export function useUserById(id: string): QueryResult<User> {
  const { data, loading, error, refetch } = useQuery<GetUserByIdResponse>(GET_USER_BY_ID, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    data: data?.user,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for updating the current user's profile with optimistic updates
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function EditProfile() {
 *   const { mutate: updateProfile, loading, error } = useUpdateProfile();
 *   
 *   const handleSubmit = async (formData: UpdateProfileInput) => {
 *     try {
 *       await updateProfile({ input: formData });
 *       // Profile updated successfully
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useUpdateProfile(): MutationResult<User, { input: UpdateProfileInput }> {
  const [updateProfileMutation, { loading, error, reset }] = useMutation<UpdateProfileResponse>(UPDATE_PROFILE, {
    errorPolicy: 'all',
    // Update cache after successful mutation
    update: (cache: ApolloCache, { data }: ApolloMutationResult<UpdateProfileResponse>) => {
      if (data?.updateProfile) {
        cache.updateQuery<GetCurrentUserResponse>({ query: GET_CURRENT_USER }, (existingData: GetCurrentUserResponse | null) => {
          if (!existingData?.currentUser) return existingData;
          
          return {
            currentUser: {
              ...existingData.currentUser,
              profile: {
                ...existingData.currentUser.profile,
                ...data.updateProfile.profile,
              },
              updatedAt: data.updateProfile.updatedAt,
            },
          };
        });
      }
    },
  });

  const mutate = async (variables: { input: UpdateProfileInput }): Promise<User> => {
    const result = await updateProfileMutation({ variables });
    if (!result.data?.updateProfile) {
      throw new Error('Failed to update profile');
    }
    return result.data.updateProfile;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for managing notification preferences
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const { mutate: updatePreferences, loading } = useNotificationPreferences();
 *   
 *   const handleToggle = async (setting: keyof NotificationPreferences, value: boolean) => {
 *     await updatePreferences({
 *       input: { [setting]: value }
 *     });
 *   };
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useNotificationPreferences(): MutationResult<User, { input: UpdateNotificationPreferencesInput }> {
  const [updatePreferencesMutation, { loading, error, reset }] = useMutation<UpdateNotificationPreferencesResponse>(
    UPDATE_NOTIFICATION_PREFERENCES,
    {
      errorPolicy: 'all',
      // Update cache after successful mutation
      update: (cache: ApolloCache, { data }: ApolloMutationResult<UpdateNotificationPreferencesResponse>) => {
        if (data?.updateNotificationPreferences) {
          cache.updateQuery<GetCurrentUserResponse>({ query: GET_CURRENT_USER }, (existingData: GetCurrentUserResponse | null) => {
            if (!existingData?.currentUser) return existingData;
            
            return {
              currentUser: {
                ...existingData.currentUser,
                notificationPreferences: {
                  ...existingData.currentUser.notificationPreferences,
                  ...data.updateNotificationPreferences.notificationPreferences,
                },
                updatedAt: data.updateNotificationPreferences.updatedAt,
              },
            };
          });
        }
      },
    }
  );

  const mutate = async (variables: { input: UpdateNotificationPreferencesInput }): Promise<User> => {
    const result = await updatePreferencesMutation({ variables });
    if (!result.data?.updateNotificationPreferences) {
      throw new Error('Failed to update notification preferences');
    }
    return result.data.updateNotificationPreferences;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}