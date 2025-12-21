/**
 * User Management Hooks
 *
 * React hooks for user-related operations including profile management,
 * notification preferences, and user data fetching.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import type { User, UpdateProfileInput, UpdateNotificationPreferencesInput } from '../types';
import type {
  GetCurrentUserResponse,
  GetUserByIdResponse,
  UpdateProfileResponse,
  UpdateNotificationPreferencesResponse,
  LoginResponse,
  RegisterResponse,
  LogoutResponse,
  VerifyEmailResponse,
  RequestPasswordResetResponse,
  ResetPasswordResponse,
  RefreshTokenResponse,
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
  const [updateProfileMutation, { loading, error, reset }] = useMutation<UpdateProfileResponse>(
    UPDATE_PROFILE,
    {
      errorPolicy: 'all',
      // Update cache after successful mutation
      update: (cache: ApolloCache, { data }) => {
        if (data?.updateProfile) {
          cache.updateQuery<GetCurrentUserResponse>(
            { query: GET_CURRENT_USER },
            (existingData: GetCurrentUserResponse | null) => {
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
            }
          );
        }
      },
    }
  );

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
 * Hook for managing basic user notification preferences (legacy)
 *
 * @deprecated Use useUpdateNotificationPreferences from useNotifications for full functionality
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function BasicNotificationSettings() {
 *   const { mutate: updatePreferences, loading } = useUserNotificationPreferences();
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
export function useUserNotificationPreferences(): MutationResult<
  User,
  { input: UpdateNotificationPreferencesInput }
> {
  const [updatePreferencesMutation, { loading, error, reset }] =
    useMutation<UpdateNotificationPreferencesResponse>(UPDATE_NOTIFICATION_PREFERENCES, {
      errorPolicy: 'all',
      // Update cache after successful mutation
      update: (cache: ApolloCache, { data }) => {
        if (data?.updateNotificationPreferences) {
          cache.updateQuery<GetCurrentUserResponse>(
            { query: GET_CURRENT_USER },
            (existingData: GetCurrentUserResponse | null) => {
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
            }
          );
        }
      },
    });

  const mutate = async (variables: {
    input: UpdateNotificationPreferencesInput;
  }): Promise<User> => {
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

// Authentication Hooks Integration

const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
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
  }
`;

const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
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
  }
`;

const LOGOUT = gql`
  mutation Logout($input: LogoutInput) {
    logout(input: $input)
  }
`;

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input)
  }
`;

const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input)
  }
`;

const RESET_PASSWORD = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input)
  }
`;

const REFRESH_TOKEN = gql`
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

/**
 * Hook for user login with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { mutate: login, loading, error } = useLogin();
 *
 *   const handleSubmit = async (email: string, password: string) => {
 *     try {
 *       const result = await login({ input: { email, password } });
 *       // Handle successful login
 *     } catch (err) {
 *       // Handle login error
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useLogin(): MutationResult<
  { accessToken: string; refreshToken: string; user: User },
  { input: { email: string; password: string } }
> {
  const [loginMutation, { loading, error, reset }] = useMutation<LoginResponse>(LOGIN, {
    errorPolicy: 'all',
    // Update cache after successful login
    update: (cache: ApolloCache, { data }) => {
      if (data?.login?.user) {
        cache.writeQuery({
          query: GET_CURRENT_USER,
          data: { currentUser: data.login.user },
        });
      }
    },
  });

  const mutate = async (variables: { input: { email: string; password: string } }) => {
    const result = await loginMutation({ variables });
    if (!result.data?.login) {
      throw new Error('Login failed');
    }
    return result.data.login;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for user registration with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function RegisterForm() {
 *   const { mutate: register, loading, error } = useRegister();
 *
 *   const handleSubmit = async (email: string, password: string, fullName: string, role: string) => {
 *     try {
 *       const result = await register({ input: { email, password, fullName, role } });
 *       // Handle successful registration
 *     } catch (err) {
 *       // Handle registration error
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useRegister(): MutationResult<
  { accessToken: string; refreshToken: string; user: User },
  { input: { email: string; password: string; fullName: string; role: string } }
> {
  const [registerMutation, { loading, error, reset }] = useMutation<RegisterResponse>(REGISTER, {
    errorPolicy: 'all',
    // Update cache after successful registration
    update: (cache: ApolloCache, { data }) => {
      if (data?.register?.user) {
        cache.writeQuery({
          query: GET_CURRENT_USER,
          data: { currentUser: data.register.user },
        });
      }
    },
  });

  const mutate = async (variables: {
    input: { email: string; password: string; fullName: string; role: string };
  }) => {
    const result = await registerMutation({ variables });
    if (!result.data?.register) {
      throw new Error('Registration failed');
    }
    return result.data.register;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for user logout with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { mutate: logout, loading } = useLogout();
 *
 *   const handleLogout = async () => {
 *     try {
 *       await logout({ input: { refreshToken: 'optional-refresh-token' } });
 *       // Handle successful logout
 *     } catch (err) {
 *       // Handle logout error
 *     }
 *   };
 *
 *   return <button onClick={handleLogout} disabled={loading}>Logout</button>;
 * }
 * ```
 */
export function useLogout(): MutationResult<boolean, { input?: { refreshToken?: string } }> {
  const [logoutMutation, { loading, error, reset }] = useMutation<LogoutResponse>(LOGOUT, {
    errorPolicy: 'all',
    // Clear cache after successful logout
    update: (cache: ApolloCache) => {
      cache.evict({ fieldName: 'currentUser' });
      cache.gc();
    },
  });

  const mutate = async (variables: { input?: { refreshToken?: string } } = {}) => {
    const result = await logoutMutation({ variables });
    return result.data?.logout ?? false;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for email verification with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function EmailVerification({ token }: { token: string }) {
 *   const { mutate: verifyEmail, loading, error } = useVerifyEmail();
 *
 *   const handleVerify = async () => {
 *     try {
 *       await verifyEmail({ input: { token } });
 *       // Handle successful verification
 *     } catch (err) {
 *       // Handle verification error
 *     }
 *   };
 *
 *   return <button onClick={handleVerify} disabled={loading}>Verify Email</button>;
 * }
 * ```
 */
export function useVerifyEmail(): MutationResult<boolean, { input: { token: string } }> {
  const [verifyEmailMutation, { loading, error, reset }] = useMutation<VerifyEmailResponse>(
    VERIFY_EMAIL,
    {
      errorPolicy: 'all',
      // Refetch current user after successful verification
      refetchQueries: [{ query: GET_CURRENT_USER }],
    }
  );

  const mutate = async (variables: { input: { token: string } }) => {
    const result = await verifyEmailMutation({ variables });
    return result.data?.verifyEmail ?? false;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for requesting password reset with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function ForgotPassword() {
 *   const { mutate: requestReset, loading, error } = useRequestPasswordReset();
 *
 *   const handleSubmit = async (email: string) => {
 *     try {
 *       await requestReset({ input: { email } });
 *       // Handle successful request
 *     } catch (err) {
 *       // Handle request error
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useRequestPasswordReset(): MutationResult<boolean, { input: { email: string } }> {
  const [requestResetMutation, { loading, error, reset }] =
    useMutation<RequestPasswordResetResponse>(REQUEST_PASSWORD_RESET, {
      errorPolicy: 'all',
    });

  const mutate = async (variables: { input: { email: string } }) => {
    const result = await requestResetMutation({ variables });
    return result.data?.requestPasswordReset ?? false;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for resetting password with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function ResetPassword({ token }: { token: string }) {
 *   const { mutate: resetPassword, loading, error } = useResetPassword();
 *
 *   const handleSubmit = async (newPassword: string) => {
 *     try {
 *       await resetPassword({ input: { token, newPassword } });
 *       // Handle successful reset
 *     } catch (err) {
 *       // Handle reset error
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useResetPassword(): MutationResult<
  boolean,
  { input: { token: string; newPassword: string } }
> {
  const [resetPasswordMutation, { loading, error, reset }] = useMutation<ResetPasswordResponse>(
    RESET_PASSWORD,
    {
      errorPolicy: 'all',
    }
  );

  const mutate = async (variables: { input: { token: string; newPassword: string } }) => {
    const result = await resetPasswordMutation({ variables });
    return result.data?.resetPassword ?? false;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for refreshing authentication tokens with backend GraphQL integration
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function TokenRefresh() {
 *   const { mutate: refreshToken, loading, error } = useRefreshToken();
 *
 *   const handleRefresh = async (refreshToken: string) => {
 *     try {
 *       const result = await refreshToken({ input: { refreshToken } });
 *       // Handle successful token refresh
 *     } catch (err) {
 *       // Handle refresh error
 *     }
 *   };
 *
 *   return <button onClick={handleRefresh} disabled={loading}>Refresh Token</button>;
 * }
 * ```
 */
export function useRefreshToken(): MutationResult<
  { accessToken: string; refreshToken: string },
  { input: { refreshToken: string } }
> {
  const [refreshTokenMutation, { loading, error, reset }] = useMutation<RefreshTokenResponse>(
    REFRESH_TOKEN,
    {
      errorPolicy: 'all',
    }
  );

  const mutate = async (variables: { input: { refreshToken: string } }) => {
    const result = await refreshTokenMutation({ variables });
    if (!result.data?.refreshToken) {
      throw new Error('Token refresh failed');
    }
    return result.data.refreshToken;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

// User Role and Permission Validation Hooks

/**
 * Hook for checking user roles and permissions
 * Integrates with the existing auth system for comprehensive permission checking
 *
 * @returns Object with role and permission checking functions
 *
 * @example
 * ```tsx
 * function ProtectedComponent() {
 *   const { hasRole, hasPermission, canAccessCourse } = useUserPermissions();
 *
 *   if (!hasRole('EDUCATOR')) {
 *     return <div>Access denied</div>;
 *   }
 *
 *   return <div>Protected content</div>;
 * }
 * ```
 */
export function useUserPermissions() {
  const { data: user } = useCurrentUser();

  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return user?.role ? roles.includes(user.role) : false;
  };

  const isStudent = (): boolean => hasRole('STUDENT');
  const isEducator = (): boolean => hasRole('EDUCATOR');
  const isAdmin = (): boolean => hasRole('ADMIN');

  const canManageUsers = (): boolean => hasRole('ADMIN');
  const canCreateCourses = (): boolean => hasAnyRole(['EDUCATOR', 'ADMIN']);
  const canAccessAnalytics = (): boolean => hasAnyRole(['EDUCATOR', 'ADMIN']);

  return {
    user,
    hasRole,
    hasAnyRole,
    isStudent,
    isEducator,
    isAdmin,
    canManageUsers,
    canCreateCourses,
    canAccessAnalytics,
  };
}

/**
 * Hook for user resource ownership validation
 * Checks if the current user owns or can modify a specific resource
 *
 * @returns Object with ownership checking functions
 *
 * @example
 * ```tsx
 * function EditButton({ resourceOwnerId }: { resourceOwnerId: string }) {
 *   const { isOwner, canModify } = useUserOwnership();
 *
 *   if (!canModify(resourceOwnerId)) {
 *     return null;
 *   }
 *
 *   return <button>Edit</button>;
 * }
 * ```
 */
export function useUserOwnership() {
  const { data: user } = useCurrentUser();

  const isOwner = (resourceOwnerId: string): boolean => {
    return user?.id === resourceOwnerId;
  };

  const canModify = (resourceOwnerId: string): boolean => {
    // Admins can modify any resource
    if (user?.role === 'ADMIN') return true;

    // Users can modify their own resources
    return isOwner(resourceOwnerId);
  };

  const canDelete = (resourceOwnerId: string): boolean => {
    // Same logic as canModify for now
    return canModify(resourceOwnerId);
  };

  return {
    user,
    isOwner,
    canModify,
    canDelete,
  };
}
