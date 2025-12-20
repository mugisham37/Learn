/**
 * Course Management Hooks
 * 
 * React hooks for course-related operations including course CRUD,
 * filtering, pagination, and educator course management.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type {
  Course,
  CourseFilter,
  CreateCourseInput,
  UpdateCourseInput,
  PaginationInput,
  CourseConnection,
  CourseStatus,
} from '../types';

// GraphQL Queries and Mutations
const GET_COURSES = gql`
  query GetCourses($filter: CourseFilter, $pagination: PaginationInput) {
    courses(filter: $filter, pagination: $pagination) {
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

const GET_COURSE = gql`
  query GetCourse($id: ID!) {
    course(id: $id) {
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
          bio
          avatarUrl
        }
      }
      modules {
        id
        title
        description
        orderIndex
        lessons {
          id
          title
          description
          type
          duration
          orderIndex
        }
      }
      enrollmentCount
      averageRating
      reviews {
        id
        rating
        comment
        student {
          id
          profile {
            fullName
          }
        }
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

const GET_MY_COURSES = gql`
  query GetMyCourses($filter: CourseFilter, $pagination: PaginationInput) {
    myCourses(filter: $filter, pagination: $pagination) {
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

const CREATE_COURSE = gql`
  mutation CreateCourse($input: CreateCourseInput!) {
    createCourse(input: $input) {
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
        }
      }
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_COURSE = gql`
  mutation UpdateCourse($id: ID!, $input: UpdateCourseInput!) {
    updateCourse(id: $id, input: $input) {
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
      updatedAt
    }
  }
`;

const PUBLISH_COURSE = gql`
  mutation PublishCourse($id: ID!) {
    publishCourse(id: $id) {
      id
      status
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
  fetchMore?: (options: Record<string, unknown>) => Promise<unknown>;
}

interface MutationResult<T, V = Record<string, unknown>> {
  mutate: (variables: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

/**
 * Hook for fetching courses with filtering and pagination
 * 
 * @param filter - Optional course filter criteria
 * @param pagination - Optional pagination parameters
 * @returns Query result with courses data, loading state, and pagination
 * 
 * @example
 * ```tsx
 * function CourseList() {
 *   const { data, loading, error, fetchMore } = useCourses({
 *     filter: { category: 'programming', difficulty: 'BEGINNER' },
 *     pagination: { first: 10 }
 *   });
 *   
 *   if (loading) return <div>Loading courses...</div>;
 *   if (error) return <div>Error loading courses</div>;
 *   
 *   return (
 *     <div>
 *       {data?.edges.map(({ node: course }) => (
 *         <CourseCard key={course.id} course={course} />
 *       ))}
 *       {data?.pageInfo.hasNextPage && (
 *         <button onClick={() => fetchMore({ variables: { pagination: { after: data.pageInfo.endCursor } } })}>
 *           Load More
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCourses(
  filter?: CourseFilter,
  pagination?: PaginationInput
): QueryResult<CourseConnection> {
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_COURSES, {
    variables: { filter, pagination },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  return {
    data: data?.courses,
    loading,
    error,
    refetch,
    fetchMore,
  };
}

/**
 * Hook for fetching a single course by ID
 * 
 * @param id - The course ID to fetch
 * @returns Query result with course data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function CourseDetail({ courseId }: { courseId: string }) {
 *   const { data: course, loading, error } = useCourse(courseId);
 *   
 *   if (loading) return <div>Loading course...</div>;
 *   if (error) return <div>Course not found</div>;
 *   
 *   return (
 *     <div>
 *       <h1>{course?.title}</h1>
 *       <p>{course?.description}</p>
 *       <div>Modules: {course?.modules.length}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCourse(id: string): QueryResult<Course> {
  const { data, loading, error, refetch } = useQuery(GET_COURSE, {
    variables: { id },
    skip: !id,
    errorPolicy: 'all',
  });

  return {
    data: data?.course,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching courses created by the current user (educator)
 * 
 * @param filter - Optional course filter criteria
 * @param pagination - Optional pagination parameters
 * @returns Query result with educator's courses
 * 
 * @example
 * ```tsx
 * function MyCoursesPage() {
 *   const { data, loading, error } = useMyCourses();
 *   
 *   if (loading) return <div>Loading your courses...</div>;
 *   if (error) return <div>Error loading courses</div>;
 *   
 *   return (
 *     <div>
 *       <h1>My Courses ({data?.totalCount})</h1>
 *       {data?.edges.map(({ node: course }) => (
 *         <CourseManagementCard key={course.id} course={course} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMyCourses(
  filter?: CourseFilter,
  pagination?: PaginationInput
): QueryResult<CourseConnection> {
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_MY_COURSES, {
    variables: { filter, pagination },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  return {
    data: data?.myCourses,
    loading,
    error,
    refetch,
    fetchMore,
  };
}

/**
 * Hook for creating a new course with optimistic updates
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function CreateCourseForm() {
 *   const { mutate: createCourse, loading, error } = useCreateCourse();
 *   
 *   const handleSubmit = async (formData: CreateCourseInput) => {
 *     try {
 *       const newCourse = await createCourse({ input: formData });
 *       router.push(`/courses/${newCourse.id}/edit`);
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useCreateCourse(): MutationResult<Course, { input: CreateCourseInput }> {
  const [createCourseMutation, { loading, error, reset }] = useMutation(CREATE_COURSE, {
    errorPolicy: 'all',
    // Update cache after successful creation
    update: (cache: any, { data }: { data?: any }) => {
      if (data?.createCourse) {
        // Add to my courses list
        cache.updateQuery(
          { query: GET_MY_COURSES, variables: {} },
          (existingData: { myCourses?: CourseConnection } | undefined) => {
            if (!existingData?.myCourses) return existingData;
            
            return {
              myCourses: {
                ...existingData.myCourses,
                edges: [
                  {
                    node: data.createCourse,
                    cursor: data.createCourse.id,
                    __typename: 'CourseEdge',
                  },
                  ...existingData.myCourses.edges,
                ],
                totalCount: existingData.myCourses.totalCount + 1,
              },
            };
          }
        );
      }
    },
  });

  const mutate = async (variables: { input: CreateCourseInput }) => {
    const result = await createCourseMutation({ variables });
    return result.data?.createCourse;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for updating an existing course with optimistic updates
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function EditCourseForm({ course }: { course: Course }) {
 *   const { mutate: updateCourse, loading, error } = useUpdateCourse();
 *   
 *   const handleSubmit = async (formData: UpdateCourseInput) => {
 *     try {
 *       await updateCourse({ id: course.id, input: formData });
 *       // Course updated successfully
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useUpdateCourse(): MutationResult<Course, { id: string; input: UpdateCourseInput }> {
  const [updateCourseMutation, { loading, error, reset }] = useMutation(UPDATE_COURSE, {
    errorPolicy: 'all',
    // Optimistic response for immediate UI updates
    optimisticResponse: (variables: { id: string; input: UpdateCourseInput }) => ({
      updateCourse: {
        __typename: 'Course',
        id: variables.id,
        ...variables.input,
        updatedAt: new Date().toISOString(),
      },
    }),
    // Update cache after successful mutation
    update: (cache: any, { data }: { data?: any }) => {
      if (data?.updateCourse) {
        // Update course in cache
        cache.updateQuery(
          { query: GET_COURSE, variables: { id: data.updateCourse.id } },
          (existingData: { course?: Course } | undefined) => {
            if (!existingData?.course) return existingData;
            
            return {
              course: {
                ...existingData.course,
                ...data.updateCourse,
              },
            };
          }
        );
      }
    },
  });

  const mutate = async (variables: { id: string; input: UpdateCourseInput }) => {
    const result = await updateCourseMutation({ variables });
    return result.data?.updateCourse;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for publishing a course (changing status to published)
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function PublishCourseButton({ courseId }: { courseId: string }) {
 *   const { mutate: publishCourse, loading } = usePublishCourse();
 *   
 *   const handlePublish = async () => {
 *     try {
 *       await publishCourse({ id: courseId });
 *       // Course published successfully
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handlePublish} disabled={loading}>
 *       {loading ? 'Publishing...' : 'Publish Course'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePublishCourse(): MutationResult<Course, { id: string }> {
  const [publishCourseMutation, { loading, error, reset }] = useMutation(PUBLISH_COURSE, {
    errorPolicy: 'all',
    // Optimistic response for immediate UI updates
    optimisticResponse: (variables: { id: string }) => ({
      publishCourse: {
        __typename: 'Course',
        id: variables.id,
        status: 'PUBLISHED' as CourseStatus,
        updatedAt: new Date().toISOString(),
      },
    }),
    // Update cache after successful mutation
    update: (cache: any, { data }: { data?: any }) => {
      if (data?.publishCourse) {
        // Update course status in cache
        cache.updateQuery(
          { query: GET_COURSE, variables: { id: data.publishCourse.id } },
          (existingData: { course?: Course } | undefined) => {
            if (!existingData?.course) return existingData;
            
            return {
              course: {
                ...existingData.course,
                status: data.publishCourse.status,
                updatedAt: data.publishCourse.updatedAt,
              },
            };
          }
        );
      }
    },
  });

  const mutate = async (variables: { id: string }) => {
    const result = await publishCourseMutation({ variables });
    return result.data?.publishCourse;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}