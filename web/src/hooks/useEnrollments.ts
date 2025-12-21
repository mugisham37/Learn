/**
 * Enrollment Tracking Hooks
 *
 * React hooks for enrollment-related operations including enrollment management,
 * progress tracking, and lesson completion.
 */

import React from 'react';
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
  Certificate,
  WithdrawEnrollmentInput,
} from '../types';
import type {
  GetMyEnrollmentsResponse,
  GetEnrollmentProgressResponse,
  EnrollInCourseResponse,
  UpdateLessonProgressResponse,
  GetMyCertificatesResponse,
  VerifyCertificateResponse,
  CheckEnrollmentEligibilityResponse,
  CheckLessonAccessResponse,
  WithdrawEnrollmentResponse,
  CompleteLessonResponse,
  ResetLessonProgressResponse,
  RegenerateCertificateResponse,
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

const GET_MY_CERTIFICATES = gql`
  query GetMyCertificates {
    myCertificates {
      id
      certificateId
      pdfUrl
      issuedAt
      verificationUrl
      metadata {
        studentName
        courseTitle
        instructorName
        completionDate
        grade
        creditsEarned
      }
      enrollment {
        id
        course {
          id
          title
          thumbnailUrl
        }
      }
      studentName
      courseTitle
      instructorName
      completionDate
      grade
      creditsEarned
      qrCodeData
      isReadyForDelivery
      isExpired
    }
  }
`;

const VERIFY_CERTIFICATE = gql`
  query VerifyCertificate($certificateId: String!) {
    verifyCertificate(certificateId: $certificateId) {
      id
      certificateId
      pdfUrl
      issuedAt
      verificationUrl
      metadata {
        studentName
        courseTitle
        instructorName
        completionDate
        grade
        creditsEarned
      }
      studentName
      courseTitle
      instructorName
      completionDate
      grade
      creditsEarned
      isReadyForDelivery
      isExpired
    }
  }
`;

const CHECK_ENROLLMENT_ELIGIBILITY = gql`
  query CheckEnrollmentEligibility($studentId: ID!, $courseId: ID!) {
    checkEnrollmentEligibility(studentId: $studentId, courseId: $courseId) {
      eligible
      reasons
      requiresPayment
      paymentAmount
      enrollmentLimit
      currentEnrollments
    }
  }
`;

const CHECK_LESSON_ACCESS = gql`
  query CheckLessonAccess($enrollmentId: ID!, $lessonId: ID!) {
    checkLessonAccess(enrollmentId: $enrollmentId, lessonId: $lessonId) {
      canAccess
      reasons
      prerequisiteModules {
        moduleId
        moduleTitle
        isCompleted
      }
    }
  }
`;

const WITHDRAW_ENROLLMENT = gql`
  mutation WithdrawEnrollment($input: WithdrawEnrollmentInput!) {
    withdrawEnrollment(input: $input)
  }
`;

const COMPLETE_LESSON = gql`
  mutation CompleteLesson($enrollmentId: ID!, $lessonId: ID!) {
    completeLesson(enrollmentId: $enrollmentId, lessonId: $lessonId) {
      id
      lesson {
        id
        title
      }
      completedAt
      timeSpent
      isCompleted
      enrollment {
        id
        progressPercentage
        status
        completedAt
      }
    }
  }
`;

const RESET_LESSON_PROGRESS = gql`
  mutation ResetLessonProgress($enrollmentId: ID!, $lessonId: ID!) {
    resetLessonProgress(enrollmentId: $enrollmentId, lessonId: $lessonId) {
      id
      lesson {
        id
        title
      }
      status
      timeSpent
      attemptsCount
    }
  }
`;

const REGENERATE_CERTIFICATE = gql`
  mutation RegenerateCertificate($enrollmentId: ID!) {
    regenerateCertificate(enrollmentId: $enrollmentId) {
      id
      certificateId
      pdfUrl
      issuedAt
      verificationUrl
      metadata {
        studentName
        courseTitle
        instructorName
        completionDate
        grade
        creditsEarned
      }
      studentName
      courseTitle
      instructorName
      completionDate
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
  const { data, loading, error, refetch, fetchMore } = useQuery<GetMyEnrollmentsResponse>(
    GET_MY_ENROLLMENTS,
    {
      variables: { filter, pagination },
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    }
  );

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
  const { data, loading, error, refetch } = useQuery<GetEnrollmentProgressResponse>(
    GET_ENROLLMENT_PROGRESS,
    {
      variables: { enrollmentId },
      skip: !enrollmentId,
      errorPolicy: 'all',
    }
  );

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
  const [enrollInCourseMutation, { loading, error, reset }] = useMutation<EnrollInCourseResponse>(
    ENROLL_IN_COURSE,
    {
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
    }
  );

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
export function useUpdateLessonProgress(): MutationResult<
  LessonProgress,
  { input: UpdateLessonProgressInput }
> {
  const [updateProgressMutation, { loading, error, reset }] =
    useMutation<UpdateLessonProgressResponse>(UPDATE_LESSON_PROGRESS, {
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
                  completedAt:
                    data.updateLessonProgress.enrollment.completedAt ||
                    existingData.enrollment.completedAt ||
                    null,
                  lessonProgress: updatedLessonProgress,
                },
              } as GetEnrollmentProgressResponse;
            }
          );
        }
      },
    });

  const mutate = async (variables: {
    input: UpdateLessonProgressInput;
  }): Promise<LessonProgress> => {
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

/**
 * Hook for fetching the current user's certificates
 *
 * @returns Query result with certificates data
 *
 * @example
 * ```tsx
 * function MyCertificatesPage() {
 *   const { data: certificates, loading, error } = useMyCertificates();
 *
 *   if (loading) return <div>Loading certificates...</div>;
 *   if (error) return <div>Error loading certificates</div>;
 *
 *   return (
 *     <div>
 *       <h1>My Certificates ({certificates?.length || 0})</h1>
 *       {certificates?.map(cert => (
 *         <CertificateCard key={cert.id} certificate={cert} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMyCertificates(): QueryResult<Certificate[]> {
  const { data, loading, error, refetch } = useQuery<GetMyCertificatesResponse>(
    GET_MY_CERTIFICATES,
    {
      errorPolicy: 'all',
    }
  );

  return {
    data: data?.myCertificates,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for verifying a certificate by its ID
 *
 * @param certificateId - The certificate ID to verify
 * @returns Query result with certificate verification data
 *
 * @example
 * ```tsx
 * function CertificateVerificationPage({ certificateId }: { certificateId: string }) {
 *   const { data: certificate, loading, error } = useVerifyCertificate(certificateId);
 *
 *   if (loading) return <div>Verifying certificate...</div>;
 *   if (error) return <div>Invalid certificate</div>;
 *
 *   return (
 *     <div>
 *       <h1>Certificate Verified</h1>
 *       <div>Student: {certificate?.studentName}</div>
 *       <div>Course: {certificate?.courseTitle}</div>
 *       <div>Issued: {new Date(certificate?.issuedAt).toLocaleDateString()}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVerifyCertificate(certificateId: string): QueryResult<Certificate> {
  const { data, loading, error, refetch } = useQuery<VerifyCertificateResponse>(
    VERIFY_CERTIFICATE,
    {
      variables: { certificateId },
      skip: !certificateId,
      errorPolicy: 'all',
    }
  );

  return {
    data: data?.verifyCertificate,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for checking enrollment eligibility for a course
 *
 * @param studentId - The student ID to check eligibility for
 * @param courseId - The course ID to check eligibility for
 * @returns Query result with eligibility data
 *
 * @example
 * ```tsx
 * function EnrollmentEligibilityCheck({ studentId, courseId }: { studentId: string; courseId: string }) {
 *   const { data: eligibility, loading } = useCheckEnrollmentEligibility(studentId, courseId);
 *
 *   if (loading) return <div>Checking eligibility...</div>;
 *
 *   if (!eligibility?.eligible) {
 *     return (
 *       <div>
 *         <p>Cannot enroll:</p>
 *         <ul>
 *           {eligibility?.reasons.map((reason, i) => (
 *             <li key={i}>{reason}</li>
 *           ))}
 *         </ul>
 *       </div>
 *     );
 *   }
 *
 *   return <EnrollButton courseId={courseId} />;
 * }
 * ```
 */
export function useCheckEnrollmentEligibility(
  studentId: string,
  courseId: string
): QueryResult<CheckEnrollmentEligibilityResponse['checkEnrollmentEligibility']> {
  const { data, loading, error, refetch } = useQuery<CheckEnrollmentEligibilityResponse>(
    CHECK_ENROLLMENT_ELIGIBILITY,
    {
      variables: { studentId, courseId },
      skip: !studentId || !courseId,
      errorPolicy: 'all',
    }
  );

  return {
    data: data?.checkEnrollmentEligibility,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for checking lesson access permissions
 *
 * @param enrollmentId - The enrollment ID
 * @param lessonId - The lesson ID to check access for
 * @returns Query result with access data
 *
 * @example
 * ```tsx
 * function LessonAccessCheck({ enrollmentId, lessonId }: { enrollmentId: string; lessonId: string }) {
 *   const { data: access, loading } = useCheckLessonAccess(enrollmentId, lessonId);
 *
 *   if (loading) return <div>Checking access...</div>;
 *
 *   if (!access?.canAccess) {
 *     return (
 *       <div>
 *         <p>Complete these prerequisites first:</p>
 *         <ul>
 *           {access?.prerequisiteModules?.map(module => (
 *             <li key={module.moduleId}>
 *               {module.moduleTitle} {module.isCompleted ? '✓' : '✗'}
 *             </li>
 *           ))}
 *         </ul>
 *       </div>
 *     );
 *   }
 *
 *   return <LessonPlayer lessonId={lessonId} />;
 * }
 * ```
 */
export function useCheckLessonAccess(
  enrollmentId: string,
  lessonId: string
): QueryResult<CheckLessonAccessResponse['checkLessonAccess']> {
  const { data, loading, error, refetch } = useQuery<CheckLessonAccessResponse>(
    CHECK_LESSON_ACCESS,
    {
      variables: { enrollmentId, lessonId },
      skip: !enrollmentId || !lessonId,
      errorPolicy: 'all',
    }
  );

  return {
    data: data?.checkLessonAccess,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for withdrawing from a course enrollment
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function WithdrawButton({ enrollmentId }: { enrollmentId: string }) {
 *   const { mutate: withdrawEnrollment, loading } = useWithdrawEnrollment();
 *
 *   const handleWithdraw = async () => {
 *     if (!confirm('Are you sure you want to withdraw from this course?')) return;
 *
 *     try {
 *       await withdrawEnrollment({ input: { enrollmentId, reason: 'User requested' } });
 *       // Withdrawal successful
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleWithdraw} disabled={loading}>
 *       {loading ? 'Withdrawing...' : 'Withdraw from Course'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useWithdrawEnrollment(): MutationResult<
  boolean,
  { input: WithdrawEnrollmentInput }
> {
  const [withdrawMutation, { loading, error, reset }] = useMutation<WithdrawEnrollmentResponse>(
    WITHDRAW_ENROLLMENT,
    {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }, { variables }) => {
        if (data?.withdrawEnrollment && variables?.input.enrollmentId) {
          // Remove from my enrollments list
          cache.updateQuery<GetMyEnrollmentsResponse>(
            { query: GET_MY_ENROLLMENTS, variables: {} },
            (existingData: GetMyEnrollmentsResponse | null) => {
              if (!existingData?.myEnrollments) return existingData;

              return {
                myEnrollments: {
                  ...existingData.myEnrollments,
                  edges: existingData.myEnrollments.edges.filter(
                    edge => edge.node.id !== variables.input.enrollmentId
                  ),
                  totalCount: existingData.myEnrollments.totalCount - 1,
                },
              };
            }
          );
        }
      },
    }
  );

  const mutate = async (variables: { input: WithdrawEnrollmentInput }): Promise<boolean> => {
    const result = await withdrawMutation({ variables });
    if (!result.data?.withdrawEnrollment) {
      throw new Error('Failed to withdraw from enrollment');
    }
    return result.data.withdrawEnrollment;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for marking a lesson as complete
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function CompleteLessonButton({ enrollmentId, lessonId }: { enrollmentId: string; lessonId: string }) {
 *   const { mutate: completeLesson, loading } = useCompleteLesson();
 *
 *   const handleComplete = async () => {
 *     try {
 *       await completeLesson({ enrollmentId, lessonId });
 *       // Lesson marked as complete
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleComplete} disabled={loading}>
 *       {loading ? 'Completing...' : 'Mark as Complete'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCompleteLesson(): MutationResult<
  LessonProgress,
  { enrollmentId: string; lessonId: string }
> {
  const [completeLessonMutation, { loading, error, reset }] = useMutation<CompleteLessonResponse>(
    COMPLETE_LESSON,
    {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }) => {
        if (data?.completeLesson) {
          const enrollmentId = data.completeLesson.enrollment.id;

          // Update enrollment progress in cache
          cache.updateQuery<GetEnrollmentProgressResponse>(
            { query: GET_ENROLLMENT_PROGRESS, variables: { enrollmentId } },
            (existingData: GetEnrollmentProgressResponse | null) => {
              if (!existingData?.enrollment) return existingData;

              const updatedLessonProgress = existingData.enrollment.lessonProgress.map(
                (progress: LessonProgress) =>
                  progress.lesson.id === data.completeLesson.lesson.id
                    ? data.completeLesson
                    : progress
              );

              return {
                enrollment: {
                  ...existingData.enrollment,
                  progressPercentage: data.completeLesson.enrollment.progressPercentage,
                  status: data.completeLesson.enrollment.status,
                  completedAt:
                    data.completeLesson.enrollment.completedAt ||
                    existingData.enrollment.completedAt ||
                    null,
                  lessonProgress: updatedLessonProgress,
                },
              } as GetEnrollmentProgressResponse;
            }
          );
        }
      },
    }
  );

  const mutate = async (variables: {
    enrollmentId: string;
    lessonId: string;
  }): Promise<LessonProgress> => {
    const result = await completeLessonMutation({ variables });
    if (!result.data?.completeLesson) {
      throw new Error('Failed to complete lesson');
    }
    return result.data.completeLesson;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for resetting lesson progress
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function ResetProgressButton({ enrollmentId, lessonId }: { enrollmentId: string; lessonId: string }) {
 *   const { mutate: resetProgress, loading } = useResetLessonProgress();
 *
 *   const handleReset = async () => {
 *     if (!confirm('Are you sure you want to reset your progress for this lesson?')) return;
 *
 *     try {
 *       await resetProgress({ enrollmentId, lessonId });
 *       // Progress reset successful
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleReset} disabled={loading}>
 *       {loading ? 'Resetting...' : 'Reset Progress'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useResetLessonProgress(): MutationResult<
  LessonProgress,
  { enrollmentId: string; lessonId: string }
> {
  const [resetProgressMutation, { loading, error, reset }] =
    useMutation<ResetLessonProgressResponse>(RESET_LESSON_PROGRESS, {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }) => {
        if (data?.resetLessonProgress) {
          const enrollmentId = data.resetLessonProgress.enrollment?.id;

          if (enrollmentId) {
            // Update enrollment progress in cache
            cache.updateQuery<GetEnrollmentProgressResponse>(
              { query: GET_ENROLLMENT_PROGRESS, variables: { enrollmentId } },
              (existingData: GetEnrollmentProgressResponse | null) => {
                if (!existingData?.enrollment) return existingData;

                const updatedLessonProgress = existingData.enrollment.lessonProgress.map(
                  (progress: LessonProgress) =>
                    progress.lesson.id === data.resetLessonProgress.lesson.id
                      ? data.resetLessonProgress
                      : progress
                );

                return {
                  enrollment: {
                    ...existingData.enrollment,
                    lessonProgress: updatedLessonProgress,
                  },
                } as GetEnrollmentProgressResponse;
              }
            );
          }
        }
      },
    });

  const mutate = async (variables: {
    enrollmentId: string;
    lessonId: string;
  }): Promise<LessonProgress> => {
    const result = await resetProgressMutation({ variables });
    if (!result.data?.resetLessonProgress) {
      throw new Error('Failed to reset lesson progress');
    }
    return result.data.resetLessonProgress;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for regenerating a certificate for a completed enrollment
 *
 * @returns Mutation function with loading state and error handling
 *
 * @example
 * ```tsx
 * function RegenerateCertificateButton({ enrollmentId }: { enrollmentId: string }) {
 *   const { mutate: regenerateCertificate, loading } = useRegenerateCertificate();
 *
 *   const handleRegenerate = async () => {
 *     try {
 *       const certificate = await regenerateCertificate({ enrollmentId });
 *       // Certificate regenerated successfully
 *       window.open(certificate.pdfUrl, '_blank');
 *     } catch (err) {
 *       // Handle error
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleRegenerate} disabled={loading}>
 *       {loading ? 'Regenerating...' : 'Regenerate Certificate'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useRegenerateCertificate(): MutationResult<Certificate, { enrollmentId: string }> {
  const [regenerateMutation, { loading, error, reset }] =
    useMutation<RegenerateCertificateResponse>(REGENERATE_CERTIFICATE, {
      errorPolicy: 'all',
      update: (cache: ApolloCache, { data }, { variables }) => {
        if (data?.regenerateCertificate && variables?.enrollmentId) {
          // Update enrollment with new certificate
          cache.updateQuery<GetEnrollmentProgressResponse>(
            { query: GET_ENROLLMENT_PROGRESS, variables: { enrollmentId: variables.enrollmentId } },
            (existingData: GetEnrollmentProgressResponse | null) => {
              if (!existingData?.enrollment) return existingData;

              return {
                enrollment: {
                  ...existingData.enrollment,
                  certificate: data.regenerateCertificate,
                },
              } as GetEnrollmentProgressResponse;
            }
          );

          // Update certificates list
          cache.updateQuery<GetMyCertificatesResponse>(
            { query: GET_MY_CERTIFICATES, variables: {} },
            (existingData: GetMyCertificatesResponse | null) => {
              if (!existingData?.myCertificates) return existingData;

              // Replace old certificate with new one
              const updatedCertificates = existingData.myCertificates.map(cert =>
                cert.enrollment.id === variables.enrollmentId ? data.regenerateCertificate : cert
              );

              return {
                myCertificates: updatedCertificates,
              };
            }
          );
        }
      },
    });

  const mutate = async (variables: { enrollmentId: string }): Promise<Certificate> => {
    const result = await regenerateMutation({ variables });
    if (!result.data?.regenerateCertificate) {
      throw new Error('Failed to regenerate certificate');
    }
    return result.data.regenerateCertificate;
  };

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for fetching enrollment analytics and reporting data
 *
 * @param enrollmentId - Optional enrollment ID to get specific enrollment analytics
 * @returns Query result with analytics data
 *
 * @example
 * ```tsx
 * function EnrollmentAnalytics({ enrollmentId }: { enrollmentId?: string }) {
 *   const { data: analytics, loading } = useEnrollmentAnalytics(enrollmentId);
 *
 *   if (loading) return <div>Loading analytics...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Enrollment Analytics</h2>
 *       <div>Total Time Spent: {analytics?.totalTimeSpent} minutes</div>
 *       <div>Completion Rate: {analytics?.completionRate}%</div>
 *       <div>Average Score: {analytics?.averageScore}%</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEnrollmentAnalytics(enrollmentId?: string) {
  // This hook provides computed analytics from enrollment data
  const { data: enrollment, loading, error, refetch } = useEnrollmentProgress(enrollmentId || '');

  const analytics = React.useMemo(() => {
    if (!enrollment) return null;

    const totalLessons = enrollment.lessonProgress.length;
    const completedLessons = enrollment.lessonProgress.filter(p => p.isCompleted).length;
    const totalTimeSpent = enrollment.lessonProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const completionRate = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    return {
      enrollmentId: enrollment.id,
      courseTitle: enrollment.course.title,
      totalLessons,
      completedLessons,
      totalTimeSpent,
      completionRate,
      progressPercentage: enrollment.progressPercentage,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      hasCertificate: !!enrollment.certificate,
      certificateUrl: enrollment.certificate?.certificateUrl,
    };
  }, [enrollment]);

  return {
    data: analytics,
    loading,
    error,
    refetch,
  };
}
