/**
 * Server-side GraphQL Client
 * 
 * Provides GraphQL client functionality for server-side rendering and API routes.
 * Handles authentication, error handling, and caching for SSR/SSG operations.
 * 
 * Requirements: 8.2, 8.3
 */

import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { config } from '@/lib/config';
import { cookies } from 'next/headers';

/**
 * Create server-side Apollo Client instance
 */
export function createServerClient(accessToken?: string) {
  // HTTP link for GraphQL endpoint
  const httpLink = createHttpLink({
    uri: config.graphqlEndpoint,
    fetch: fetch,
  });

  // Authentication link
  const authLink = setContext(async (_, { headers }) => {
    // Get token from parameter or cookies
    let token = accessToken;
    
    if (!token) {
      try {
        const cookieStore = cookies();
        token = cookieStore.get('access-token')?.value;
      } catch (error) {
        // Cookies not available in this context
        console.warn('Unable to access cookies for server-side GraphQL request');
      }
    }

    return {
      headers: {
        ...headers,
        ...(token && { authorization: `Bearer ${token}` }),
        'Content-Type': 'application/json',
      },
    };
  });

  // Error handling link
  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        console.error(
          `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`,
          { extensions }
        );
      });
    }

    if (networkError) {
      console.error(`Network error: ${networkError.message}`, networkError);
    }
  });

  // Create cache with server-side configuration
  const cache = new InMemoryCache({
    // Disable cache persistence on server
    addTypename: true,
    typePolicies: {
      Query: {
        fields: {
          // Configure pagination for server-side queries
          courses: {
            keyArgs: ['filter', 'sort'],
            merge(existing = { edges: [], pageInfo: {} }, incoming) {
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
          users: {
            keyArgs: ['filter', 'sort'],
            merge(existing = { edges: [], pageInfo: {} }, incoming) {
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
    },
  });

  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache,
    ssrMode: true,
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
}

/**
 * Execute GraphQL query on server-side
 */
export async function executeServerQuery<T = any, V = any>(
  query: any,
  variables?: V,
  accessToken?: string
): Promise<{
  data: T | null;
  errors?: any[];
  loading: boolean;
}> {
  try {
    const client = createServerClient(accessToken);
    
    const result = await client.query({
      query,
      variables,
      fetchPolicy: 'network-only', // Always fetch fresh data on server
    });

    return {
      data: result.data,
      errors: result.errors,
      loading: false,
    };
  } catch (error) {
    console.error('Server-side GraphQL query error:', error);
    
    return {
      data: null,
      errors: [error],
      loading: false,
    };
  }
}

/**
 * Execute GraphQL mutation on server-side
 */
export async function executeServerMutation<T = any, V = any>(
  mutation: any,
  variables?: V,
  accessToken?: string
): Promise<{
  data: T | null;
  errors?: any[];
}> {
  try {
    const client = createServerClient(accessToken);
    
    const result = await client.mutate({
      mutation,
      variables,
    });

    return {
      data: result.data,
      errors: result.errors,
    };
  } catch (error) {
    console.error('Server-side GraphQL mutation error:', error);
    
    return {
      data: null,
      errors: [error],
    };
  }
}

/**
 * Server-side data fetching utilities
 */
export const serverGraphQL = {
  /**
   * Fetch user data for server-side rendering
   */
  async fetchCurrentUser(accessToken: string) {
    const ME_QUERY = `
      query Me {
        me {
          id
          email
          role
          emailVerified
          profile {
            fullName
            avatarUrl
            bio
            timezone
            language
          }
          notificationPreferences {
            email
            push
            sms
            inApp
          }
          createdAt
          updatedAt
        }
      }
    `;

    return executeServerQuery(ME_QUERY, {}, accessToken);
  },

  /**
   * Fetch courses for server-side rendering
   */
  async fetchCourses(variables: {
    first?: number;
    after?: string;
    filter?: any;
    sort?: any;
  } = {}) {
    const COURSES_QUERY = `
      query Courses($first: Int, $after: String, $filter: CourseFilter, $sort: CourseSort) {
        courses(first: $first, after: $after, filter: $filter, sort: $sort) {
          edges {
            node {
              id
              title
              description
              slug
              category
              difficulty
              price
              currency
              status
              thumbnailUrl
              instructor {
                id
                profile {
                  fullName
                  avatarUrl
                }
              }
              enrollmentCount
              averageRating
              createdAt
              updatedAt
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;

    return executeServerQuery(COURSES_QUERY, variables);
  },

  /**
   * Fetch course by slug for server-side rendering
   */
  async fetchCourseBySlug(slug: string, accessToken?: string) {
    const COURSE_BY_SLUG_QUERY = `
      query CourseBySlug($slug: String!) {
        courseBySlug(slug: $slug) {
          id
          title
          description
          slug
          category
          difficulty
          price
          currency
          status
          thumbnailUrl
          instructor {
            id
            profile {
              fullName
              avatarUrl
              bio
            }
          }
          modules {
            id
            title
            description
            order
            lessons {
              id
              title
              description
              type
              duration
              order
            }
          }
          enrollmentCount
          averageRating
          reviews {
            edges {
              node {
                id
                rating
                comment
                user {
                  profile {
                    fullName
                    avatarUrl
                  }
                }
                createdAt
              }
            }
          }
          createdAt
          updatedAt
        }
      }
    `;

    return executeServerQuery(COURSE_BY_SLUG_QUERY, { slug }, accessToken);
  },

  /**
   * Fetch user enrollments for server-side rendering
   */
  async fetchUserEnrollments(accessToken: string, variables: {
    first?: number;
    after?: string;
    filter?: any;
  } = {}) {
    const USER_ENROLLMENTS_QUERY = `
      query MyEnrollments($first: Int, $after: String, $filter: EnrollmentFilter) {
        myEnrollments(first: $first, after: $after, filter: $filter) {
          edges {
            node {
              id
              status
              progress
              completedAt
              course {
                id
                title
                slug
                thumbnailUrl
                instructor {
                  profile {
                    fullName
                  }
                }
              }
              enrolledAt
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }
    `;

    return executeServerQuery(USER_ENROLLMENTS_QUERY, variables, accessToken);
  },
};