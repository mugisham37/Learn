import { gql } from '@apollo/client';
import type * as ApolloReactCommon from '@apollo/client';
import {
  useQuery,
  useLazyQuery,
  useMutation,
  useSubscription
} from '@apollo/client/react';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: string; output: string };
  JSON: { input: Record<string, unknown>; output: Record<string, unknown> };
  Upload: { input: File; output: File };
};

export type Course = {
  readonly __typename: 'Course';
  readonly createdAt: Scalars['DateTime']['output'];
  readonly description: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly status: CourseStatus;
  readonly title: Scalars['String']['output'];
};

export type CourseStatus = 'ARCHIVED' | 'DRAFT' | 'PUBLISHED' | '%future added value';

export type Mutation = {
  readonly __typename: 'Mutation';
  readonly _empty: Maybe<Scalars['String']['output']>;
};

export type Query = {
  readonly __typename: 'Query';
  readonly _empty: Maybe<Scalars['String']['output']>;
};

export type Subscription = {
  readonly __typename: 'Subscription';
  readonly _empty: Maybe<Scalars['String']['output']>;
};

export type User = {
  readonly __typename: 'User';
  readonly createdAt: Scalars['DateTime']['output'];
  readonly email: Scalars['String']['output'];
  readonly id: Scalars['ID']['output'];
  readonly role: UserRole;
};

export type UserRole = 'ADMIN' | 'EDUCATOR' | 'STUDENT' | '%future added value';

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetCurrentUserQueryResult = {
  readonly __typename: 'Query';
  readonly _empty: string | null | undefined;
};

export type GetCoursesQueryVariables = Exact<{ [key: string]: never }>;

export type GetCoursesQueryResult = {
  readonly __typename: 'Query';
  readonly _empty: string | null | undefined;
};

export type LoginMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;

export type LoginMutationResult = {
  readonly __typename: 'Mutation';
  readonly _empty: string | null | undefined;
};

export type CreateCourseMutationVariables = Exact<{
  input: Scalars['String']['input'];
}>;

export type CreateCourseMutationResult = {
  readonly __typename: 'Mutation';
  readonly _empty: string | null | undefined;
};

export type MessageUpdatesSubscriptionVariables = Exact<{ [key: string]: never }>;

export type MessageUpdatesSubscriptionResult = {
  readonly __typename: 'Subscription';
  readonly _empty: string | null | undefined;
};

export type ProgressUpdatesSubscriptionVariables = Exact<{ [key: string]: never }>;

export type ProgressUpdatesSubscriptionResult = {
  readonly __typename: 'Subscription';
  readonly _empty: string | null | undefined;
};

export const GetCurrentUserDocument = gql`
  query GetCurrentUser {
    _empty
  }
`;

/**
 * __useGetCurrentUserQuery__
 *
 * To run a query within a React component, call `useGetCurrentUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCurrentUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCurrentUserQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCurrentUserQuery(
  baseOptions?: ApolloReactCommon.QueryOptions<
    GetCurrentUserQueryResult,
    GetCurrentUserQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useQuery<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export function useGetCurrentUserLazyQuery(
  baseOptions?: ApolloReactCommon.QueryOptions<
    GetCurrentUserQueryResult,
    GetCurrentUserQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useLazyQuery<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export type GetCurrentUserQueryHookResult = ReturnType<typeof useGetCurrentUserQuery>;
export type GetCurrentUserLazyQueryHookResult = ReturnType<typeof useGetCurrentUserLazyQuery>;
export type GetCurrentUserQueryResultType = ReturnType<typeof useGetCurrentUserQuery>;
export function refetchGetCurrentUserQuery(variables?: GetCurrentUserQueryVariables) {
  return { query: GetCurrentUserDocument, variables: variables };
}
export const GetCoursesDocument = gql`
  query GetCourses {
    _empty
  }
`;

/**
 * __useGetCoursesQuery__
 *
 * To run a query within a React component, call `useGetCoursesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCoursesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCoursesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCoursesQuery(
  baseOptions?: ApolloReactCommon.QueryOptions<GetCoursesQueryResult, GetCoursesQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useQuery<GetCoursesQueryResult, GetCoursesQueryVariables>(
    GetCoursesDocument,
    options
  );
}
export function useGetCoursesLazyQuery(
  baseOptions?: ApolloReactCommon.QueryOptions<
    GetCoursesQueryResult,
    GetCoursesQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useLazyQuery<GetCoursesQueryResult, GetCoursesQueryVariables>(
    GetCoursesDocument,
    options
  );
}
export type GetCoursesQueryHookResult = ReturnType<typeof useGetCoursesQuery>;
export type GetCoursesLazyQueryHookResult = ReturnType<typeof useGetCoursesLazyQuery>;
export type GetCoursesQueryResultType = ReturnType<typeof useGetCoursesQuery>;
export function refetchGetCoursesQuery(variables?: GetCoursesQueryVariables) {
  return { query: GetCoursesDocument, variables: variables };
}
export const LoginDocument = gql`
  mutation Login($email: String!, $password: String!) {
    _empty
  }
`;
export type LoginMutationFn = ReturnType<typeof useLoginMutation>[0];

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      email: // value for 'email'
 *      password: // value for 'password'
 *   },
 * });
 */
export function useLoginMutation(
  baseOptions?: ApolloReactCommon.MutationOptions<LoginMutationResult, LoginMutationVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useMutation<LoginMutationResult, LoginMutationVariables>(
    LoginDocument,
    options
  );
}
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResultType = ReturnType<typeof useLoginMutation>[1];
export type LoginMutationOptions = ApolloReactCommon.MutationOptions<
  LoginMutationResult,
  LoginMutationVariables
>;
export const CreateCourseDocument = gql`
  mutation CreateCourse($input: String!) {
    _empty
  }
`;
export type CreateCourseMutationFn = ReturnType<typeof useCreateCourseMutation>[0];

/**
 * __useCreateCourseMutation__
 *
 * To run a mutation, you first call `useCreateCourseMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateCourseMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createCourseMutation, { data, loading, error }] = useCreateCourseMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateCourseMutation(
  baseOptions?: ApolloReactCommon.MutationOptions<
    CreateCourseMutationResult,
    CreateCourseMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useMutation<CreateCourseMutationResult, CreateCourseMutationVariables>(
    CreateCourseDocument,
    options
  );
}
export type CreateCourseMutationHookResult = ReturnType<typeof useCreateCourseMutation>;
export type CreateCourseMutationResultType = ReturnType<typeof useCreateCourseMutation>[1];
export type CreateCourseMutationOptions = ApolloReactCommon.MutationOptions<
  CreateCourseMutationResult,
  CreateCourseMutationVariables
>;
export const MessageUpdatesDocument = gql`
  subscription MessageUpdates {
    _empty
  }
`;

/**
 * __useMessageUpdatesSubscription__
 *
 * To run a query within a React component, call `useMessageUpdatesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useMessageUpdatesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMessageUpdatesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useMessageUpdatesSubscription(
  baseOptions?: ApolloReactCommon.SubscriptionOptions<
    MessageUpdatesSubscriptionResult,
    MessageUpdatesSubscriptionVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useSubscription<
    MessageUpdatesSubscriptionResult,
    MessageUpdatesSubscriptionVariables
  >(MessageUpdatesDocument, options);
}
export type MessageUpdatesSubscriptionHookResult = ReturnType<typeof useMessageUpdatesSubscription>;
export type MessageUpdatesSubscriptionResultType = ReturnType<typeof useMessageUpdatesSubscription>;
export const ProgressUpdatesDocument = gql`
  subscription ProgressUpdates {
    _empty
  }
`;

/**
 * __useProgressUpdatesSubscription__
 *
 * To run a query within a React component, call `useProgressUpdatesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useProgressUpdatesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useProgressUpdatesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useProgressUpdatesSubscription(
  baseOptions?: ApolloReactCommon.SubscriptionOptions<
    ProgressUpdatesSubscriptionResult,
    ProgressUpdatesSubscriptionVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return useSubscription<
    ProgressUpdatesSubscriptionResult,
    ProgressUpdatesSubscriptionVariables
  >(ProgressUpdatesDocument, options);
}
export type ProgressUpdatesSubscriptionHookResult = ReturnType<
  typeof useProgressUpdatesSubscription
>;
export type ProgressUpdatesSubscriptionResultType = ReturnType<typeof useProgressUpdatesSubscription>;
