import { gql } from '@apollo/client';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client';
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
  JSON: { input: any; output: any };
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
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetCurrentUserQueryResult,
    GetCurrentUserQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export function useGetCurrentUserLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetCurrentUserQueryResult,
    GetCurrentUserQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
// @ts-ignore
export function useGetCurrentUserSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetCurrentUserQueryResult,
    GetCurrentUserQueryVariables
  >
): ApolloReactHooks.UseSuspenseQueryResult<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetCurrentUserQueryResult,
        GetCurrentUserQueryVariables
      >
): ApolloReactHooks.UseSuspenseQueryResult<
  GetCurrentUserQueryResult | undefined,
  GetCurrentUserQueryVariables
>;
export function useGetCurrentUserSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetCurrentUserQueryResult,
        GetCurrentUserQueryVariables
      >
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetCurrentUserQueryResult, GetCurrentUserQueryVariables>(
    GetCurrentUserDocument,
    options
  );
}
export type GetCurrentUserQueryHookResult = ReturnType<typeof useGetCurrentUserQuery>;
export type GetCurrentUserLazyQueryHookResult = ReturnType<typeof useGetCurrentUserLazyQuery>;
export type GetCurrentUserSuspenseQueryHookResult = ReturnType<
  typeof useGetCurrentUserSuspenseQuery
>;
export type GetCurrentUserQueryResult = ApolloReactCommon.QueryResult<
  GetCurrentUserQueryResult,
  GetCurrentUserQueryVariables
>;
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
  baseOptions?: ApolloReactHooks.QueryHookOptions<GetCoursesQueryResult, GetCoursesQueryVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetCoursesQueryResult, GetCoursesQueryVariables>(
    GetCoursesDocument,
    options
  );
}
export function useGetCoursesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetCoursesQueryResult,
    GetCoursesQueryVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetCoursesQueryResult, GetCoursesQueryVariables>(
    GetCoursesDocument,
    options
  );
}
// @ts-ignore
export function useGetCoursesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetCoursesQueryResult,
    GetCoursesQueryVariables
  >
): ApolloReactHooks.UseSuspenseQueryResult<GetCoursesQueryResult, GetCoursesQueryVariables>;
export function useGetCoursesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetCoursesQueryResult, GetCoursesQueryVariables>
): ApolloReactHooks.UseSuspenseQueryResult<
  GetCoursesQueryResult | undefined,
  GetCoursesQueryVariables
>;
export function useGetCoursesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<GetCoursesQueryResult, GetCoursesQueryVariables>
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetCoursesQueryResult, GetCoursesQueryVariables>(
    GetCoursesDocument,
    options
  );
}
export type GetCoursesQueryHookResult = ReturnType<typeof useGetCoursesQuery>;
export type GetCoursesLazyQueryHookResult = ReturnType<typeof useGetCoursesLazyQuery>;
export type GetCoursesSuspenseQueryHookResult = ReturnType<typeof useGetCoursesSuspenseQuery>;
export type GetCoursesQueryResult = ApolloReactCommon.QueryResult<
  GetCoursesQueryResult,
  GetCoursesQueryVariables
>;
export function refetchGetCoursesQuery(variables?: GetCoursesQueryVariables) {
  return { query: GetCoursesDocument, variables: variables };
}
export const LoginDocument = gql`
  mutation Login($email: String!, $password: String!) {
    _empty
  }
`;
export type LoginMutationFn = ApolloReactCommon.MutationFunction<
  LoginMutationResult,
  LoginMutationVariables
>;

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
  baseOptions?: ApolloReactHooks.MutationHookOptions<LoginMutationResult, LoginMutationVariables>
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<LoginMutationResult, LoginMutationVariables>(
    LoginDocument,
    options
  );
}
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = ApolloReactCommon.MutationResult<LoginMutationResult>;
export type LoginMutationOptions = ApolloReactCommon.BaseMutationOptions<
  LoginMutationResult,
  LoginMutationVariables
>;
export const CreateCourseDocument = gql`
  mutation CreateCourse($input: String!) {
    _empty
  }
`;
export type CreateCourseMutationFn = ApolloReactCommon.MutationFunction<
  CreateCourseMutationResult,
  CreateCourseMutationVariables
>;

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
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreateCourseMutationResult,
    CreateCourseMutationVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<CreateCourseMutationResult, CreateCourseMutationVariables>(
    CreateCourseDocument,
    options
  );
}
export type CreateCourseMutationHookResult = ReturnType<typeof useCreateCourseMutation>;
export type CreateCourseMutationResult =
  ApolloReactCommon.MutationResult<CreateCourseMutationResult>;
export type CreateCourseMutationOptions = ApolloReactCommon.BaseMutationOptions<
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
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    MessageUpdatesSubscriptionResult,
    MessageUpdatesSubscriptionVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    MessageUpdatesSubscriptionResult,
    MessageUpdatesSubscriptionVariables
  >(MessageUpdatesDocument, options);
}
export type MessageUpdatesSubscriptionHookResult = ReturnType<typeof useMessageUpdatesSubscription>;
export type MessageUpdatesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<MessageUpdatesSubscriptionResult>;
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
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    ProgressUpdatesSubscriptionResult,
    ProgressUpdatesSubscriptionVariables
  >
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    ProgressUpdatesSubscriptionResult,
    ProgressUpdatesSubscriptionVariables
  >(ProgressUpdatesDocument, options);
}
export type ProgressUpdatesSubscriptionHookResult = ReturnType<
  typeof useProgressUpdatesSubscription
>;
export type ProgressUpdatesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<ProgressUpdatesSubscriptionResult>;
