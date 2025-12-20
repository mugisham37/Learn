/**
 * Enrollment Tracking Hooks
 * 
 * React hooks for enrollment-related operations including enrollment management,
 * progress tracking, and lesson completion.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import type {
  Enrollment,
  EnrollmentFilter,
  EnrollInCourseInput,
  UpdateLessonProgressInput,
  LessonProgress,
  PaginationInput,
  EnrollmentConnection,
} from '../types';
import type {
  GetMyEnrollmentsResponse,
  GetEnrollmentProgressResponse,
  EnrollInCourseResponse,
  UpdateLessonProgressResponse,
} from '../types/graphql-responses';

// GraphQL Queries and Mutations
const GET_MY_ENROLLMENTS = gql`
  query GetMyEnrollments($filter: EnrollmentFilter, $pagination: PaginationInput) {
    myEnrollments(filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          course {
            id
            title
            description
            thumbnailUrl
            instructor {
              id
              profile {
                fullName
              }
            }
            modules {
              id
              title
              lessons {
                id
                title
                duration
              }
            }
          }
          enrolledAt
          completedAt
          progressPercentage
          status
          certificate {
            id
            issuedAt
            certificateUrl
          }
          lessonProgress {
            id
            lesson {
              id
              title
            }
            completedAt
            timeSpent
            isCompleted
          }
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

const GET_ENROLLMENT_PROGRESS = gql`
  query GetEnrollmentProgress($enrollmentId: ID!) {
    enrollment(id: $enrollmentId) {
      id
      course {
        id
        title
        modules {
          id
          title
          orderIndex
          lessons {
            id
            title
            type
            duration
            orderIndex
          }
        }
      }
      progressPercentage
      status
      enrolledAt
      completedAt
      lessonProgress {
        id
        lesson {
          id
          title
          type
          duration
        }
        completedAt
        timeSpent
        isCompleted
        lastAccessedAt
      }
      certificate {
        id
        issuedAt
        certificateUrl
      }
    }
  }
`;

const ENROLL_IN_COURSE = gql`
  mutation EnrollInCourse($input: EnrollInCourseInput!) {
    enrollInCourse(input: $input) {
      id
      course {
        id
        title
        thumbnailUrl
        instructor {
          id
          profile {
            fullName
          }
        }
      }
      enrolledAt
      progressPercentage
      status
    }
  }
`;

const UPDATE_LESSON_PROGRESS = gql`
  mutation UpdateLessonProgress($input: UpdateLessonProgressInput!) {
    updateLessonProgress(input: $input) {
      id
      lesson {
        id
        title
      }
      completedAt
      timeSpent
      isCompleted
      lastAccessedAt
      enrollment {
        id
        progressPercentage
        status
        completedAt
      }
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
 * Hook for fetching the current user's enrollments with status filtering
 * 
 * @param filter - Optional enrollment filter criteria
 * @param pagination - Optional pagination parameters
 * @returns Query result with enrollments data, loading state, and pagination
 * 
 * @example
 * ```tsx
 * function MyCoursesPage() {
 *   const { data, loading, error, fetchMore } = useMyEnrollments({
 *     filter: { status: 'ACTIVE' },
 *     pagination: { first: 10 }
 *   });
 *   
 *   if (loading) return <div>Loading your courses...</div>;
 *   if (error) return <div>Error loading enrollments</div>;
 *   
 *   return (
 *     <div>
 *       <h1>My Enrolled Courses ({data?.totalCount})</h1>
 *       {data?.edges.map(({ node: enrollment }) => (
 *         <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
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
export function useMyEnrollments(
  filter?: EnrollmentFilter,
  pagination?: PaginationInput
): QueryResult<EnrollmentConnection> {
  const { data, loading, error, refetch, fetchMore } = useQuery<GetMyEnrollmentsResponse>(GET_MY_ENROLLMENTS, {
    variables: { filter, pagination },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  return {
    data: data?.myEnrollments,
    loading,
    error,
    refetch,
    fetchMore,
  };
}

/**
 * Hook for fetching detailed enrollment progress for a specific enrollment
 * 
 * @param enrollmentId - The enrollment ID to fetch progress for
 * @returns Query result with detailed enrollment progress data
 * 
 * @example
 * ```tsx
 * function CourseProgressPage({ enrollmentId }: { enrollmentId: string }) {
 *   const { data: enrollment, loading, error } = useEnrollmentProgress(enrollmentId);
 *   
 *   if (loading) return <div>Loading progress...</div>;
 *   if (error) return <div>Error loading progress</div>;
 *   
 *   return (
 *     <div>
 *       <h1>{enrollment?.course.title}</h1>
 *       <div>Progress: {enrollment?.progressPercentage}%</div>
 *       <div>
 *         {enrollment?.course.modules.map(module => (
 *           <ModuleProgress key={module.id} module={module} lessonProgress={enrollment.lessonProgress} />
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEnrollmentProgress(enrollmentId: string): QueryResult<Enrollment> {
  const { data, loading, error, refetch } = useQuery<GetEnrollmentProgressResponse>(GET_ENROLLMENT_PROGRESS, {
    variables: { enrollmentId },
    skip: !enrollmentId,
    errorPolicy: 'all',
  });

  return {
    data: data?.enrollment,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for enrolling in a course with payment integration
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function EnrollButton({ courseId, price }: { courseId: string; price: number }) {
 *   const { mutate: enrollInCourse, loading, error } = useEnrollInCourse();
 *   
 *   const handleEnroll = async () => {
 *     try {
 *       if (price > 0) {
 *         // Handle payment flow first
 *         const paymentResult = await processPayment({ courseId, amount: price });
 *         await enrollInCourse({ 
 *           input: { 
 *             courseId, 
 *             paymentIntentId: paymentResult.paymentIntentId 
 *           } 
 *         });
 *       } else {
 *         // Free course enrollment
 *         await enrollInCourse({ input: { courseId } });
 *       }
 *       // Enrollment successful
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleEnroll} disabled={loading}>
 *       {loading ? 'Enrolling...' : price > 0 ? `Enroll for $${price}` : 'Enroll Free'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useEnrollInCourse(): MutationResult<Enrollment, { input: EnrollInCourseInput }> {
  const [enrollInCourseMutation, { loading, error, reset }] = useMutation<EnrollInCourseResponse>(ENROLL_IN_COURSE, {
    errorPolicy: 'all',
    // Update cache after successful enrollment
    update: (cache: ApolloCache, { data }) => {
      if (data?.enrollInCourse) {
        // Add to my enrollments list
        cache.updateQuery<GetMyEnrollmentsResponse>(
          { query: GET_MY_ENROLLMENTS, variables: {} },
          (existingData: GetMyEnrollmentsResponse | null) => {
            if (!existingData?.myEnrollments) return existingData;
            
            return {
              myEnrollments: {
                ...existingData.myEnrollments,
                edges: [
                  {
                    node: data.enrollInCourse,
                    cursor: data.enrollInCourse.id,
                    __typename: 'EnrollmentEdge',
                  },
                  ...existingData.myEnrollments.edges,
                ],
                totalCount: existingData.myEnrollments.totalCount + 1,
              },
            };
          }
        );

        // Update course enrollment count in cache
        const courseId = data.enrollInCourse.course.id;
        const courseCacheId = cache.identify({ __typename: 'Course', id: courseId });
        if (courseCacheId) {
          cache.modify({
            id: courseCacheId,
            fields: {
              enrollmentCount(existingCount = 0) {
                return existingCount + 1;
              },
            },
          });
        }
      }
    },
  });

  const mutate = async (variables: { input: EnrollInCourseInput }): Promise<Enrollment> => {
    const result = await enrollInCourseMutation({ variables });
    if (!result.data?.enrollInCourse) {
      throw new Error('Failed to enroll in course');
    }
    return result.data.enrollInCourse;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for updating lesson progress with optimistic updates
 * 
 * @returns Mutation function with loading state and error handling
 * 
 * @example
 * ```tsx
 * function LessonPlayer({ lessonId, enrollmentId }: { lessonId: string; enrollmentId: string }) {
 *   const { mutate: updateProgress, loading } = useUpdateLessonProgress();
 *   
 *   const handleLessonComplete = async (timeSpent: number) => {
 *     try {
 *       await updateProgress({
 *         input: {
 *           enrollmentId,
 *           lessonId,
 *           isCompleted: true,
 *           timeSpent,
 *           completedAt: new Date().toISOString()
 *         }
 *       });
 *       // Progress updated successfully
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *   
 *   const handleProgressUpdate = async (timeSpent: number) => {
 *     await updateProgress({
 *       input: {
 *         enrollmentId,
 *         lessonId,
 *         timeSpent,
 *         lastAccessedAt: new Date().toISOString()
 *       }
 *     });
 *   };
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useUpdateLessonProgress(): MutationResult<LessonProgress, { input: UpdateLessonProgressInput }> {
  const [updateProgressMutation, { loading, error, reset }] = useMutation<UpdateLessonProgressResponse>(
    UPDATE_LESSON_PROGRESS,
    {
      errorPolicy: 'all',
      // Update cache after successful mutation
      update: (cache: ApolloCache, { data }) => {
        if (data?.updateLessonProgress) {
          const enrollmentId = data.updateLessonProgress.enrollment.id;
          
          // Update enrollment progress in cache
          cache.updateQuery<GetEnrollmentProgressResponse>(
            { query: GET_ENROLLMENT_PROGRESS, variables: { enrollmentId } },
            (existingData: GetEnrollmentProgressResponse | null) => {
              if (!existingData?.enrollment) return existingData;
              
              // Update lesson progress in the list
              const updatedLessonProgress = existingData.enrollment.lessonProgress.map(
                (progress: LessonProgress) =>
                  progress.lesson.id === data.updateLessonProgress.lesson.id
                    ? data.updateLessonProgress
                    : progress
              );
              
              return {
                enrollment: {
                  ...existingData.enrollment,
                  progressPercentage: data.updateLessonProgress.enrollment.progressPercentage,
                  status: data.updateLessonProgress.enrollment.status,
                  completedAt: data.updateLessonProgress.enrollment.completedAt || existingData.enrollment.completedAt || null,
                  lessonProgress: updatedLessonProgress,
                },
              } as GetEnrollmentProgressResponse;
            }
          );
        }
      },
    }
  );

  const mutate = async (variables: { input: UpdateLessonProgressInput }): Promise<LessonProgress> => {
    const result = await updateProgressMutation({ variables });
    if (!result.data?.updateLessonProgress) {
      throw new Error('Failed to update lesson progress');
    }
    return result.data.updateLessonProgress;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}