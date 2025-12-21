/**
 * Assessment Hooks
 *
 * React hooks for assessment-related operations including quiz attempts,
 * assignment submissions, and grading workflows.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Quiz,
  QuizAttempt,
  Assignment,
  AssignmentSubmission,
  StartQuizInput,
  SubmitAssignmentInput,
  GradeAssignmentInput,
} from '../types';
import type {
  GetQuizResponse,
  GetQuizAttemptResponse,
  GetAssignmentResponse,
  StartQuizResponse,
  SubmitQuizResponse,
  SubmitAssignmentResponse,
  GradeAssignmentResponse,
} from '../types/graphql-responses';

// GraphQL Queries and Mutations
const GET_QUIZ = gql`
  query GetQuiz($id: ID!) {
    quiz(id: $id) {
      id
      title
      description
      timeLimit
      maxAttempts
      passingScore
      questions {
        id
        type
        question
        options
        points
        orderIndex
      }
      lesson {
        id
        title
        module {
          id
          course {
            id
            title
          }
        }
      }
      createdAt
      updatedAt
    }
  }
`;

const GET_QUIZ_ATTEMPT = gql`
  query GetQuizAttempt($id: ID!) {
    quizAttempt(id: $id) {
      id
      quiz {
        id
        title
        timeLimit
        questions {
          id
          type
          question
          options
          points
        }
      }
      student {
        id
        profile {
          fullName
        }
      }
      startedAt
      submittedAt
      timeRemaining
      status
      score
      maxScore
      answers {
        id
        question {
          id
        }
        answer
        isCorrect
        points
      }
    }
  }
`;

const GET_ASSIGNMENT = gql`
  query GetAssignment($id: ID!) {
    assignment(id: $id) {
      id
      title
      description
      instructions
      dueDate
      maxPoints
      allowedFileTypes
      maxFileSize
      lesson {
        id
        title
        module {
          id
          course {
            id
            title
          }
        }
      }
      submissions {
        id
        student {
          id
          profile {
            fullName
          }
        }
        submittedAt
        status
        grade
        feedback
      }
      createdAt
      updatedAt
    }
  }
`;

const START_QUIZ = gql`
  mutation StartQuiz($input: StartQuizInput!) {
    startQuiz(input: $input) {
      id
      quiz {
        id
        title
        timeLimit
        questions {
          id
          type
          question
          options
          points
        }
      }
      startedAt
      timeRemaining
      status
    }
  }
`;

const SUBMIT_QUIZ_ANSWER = gql`
  mutation SubmitQuizAnswer($input: SubmitQuizAnswerInput!) {
    submitQuizAnswer(input: $input) {
      id
      question {
        id
      }
      answer
      submittedAt
      quizAttempt {
        id
        timeRemaining
        status
      }
    }
  }
`;

const SUBMIT_QUIZ = gql`
  mutation SubmitQuiz($attemptId: ID!) {
    submitQuiz(attemptId: $attemptId) {
      id
      submittedAt
      status
      score
      maxScore
      answers {
        id
        question {
          id
        }
        answer
        isCorrect
        points
      }
    }
  }
`;

const SUBMIT_ASSIGNMENT = gql`
  mutation SubmitAssignment($input: SubmitAssignmentInput!) {
    submitAssignment(input: $input) {
      id
      assignment {
        id
        title
      }
      student {
        id
        profile {
          fullName
        }
      }
      submittedAt
      status
      submissionText
      files {
        id
        fileName
        fileSize
        fileUrl
      }
    }
  }
`;

const GRADE_ASSIGNMENT = gql`
  mutation GradeAssignment($input: GradeAssignmentInput!) {
    gradeAssignment(input: $input) {
      id
      grade
      feedback
      gradedAt
      gradedBy {
        id
        profile {
          fullName
        }
      }
      status
    }
  }
`;

// Additional queries for analytics and reporting
const GET_QUIZ_ANALYTICS = gql`
  query GetQuizAnalytics($quizId: ID!, $dateRange: DateRangeInput) {
    quizAnalytics(quizId: $quizId, dateRange: $dateRange) {
      totalAttempts
      averageScore
      passRate
      averageTimeSpent
      questionAnalytics {
        questionId
        correctAnswerRate
        averageTimeSpent
        commonWrongAnswers
      }
      scoreDistribution {
        range
        count
      }
      attemptsByDate {
        date
        count
      }
    }
  }
`;

const GET_ASSIGNMENT_ANALYTICS = gql`
  query GetAssignmentAnalytics($assignmentId: ID!, $dateRange: DateRangeInput) {
    assignmentAnalytics(assignmentId: $assignmentId, dateRange: $dateRange) {
      totalSubmissions
      averageGrade
      submissionRate
      averageTimeToSubmit
      gradeDistribution {
        range
        count
      }
      submissionsByDate {
        date
        count
      }
      lateSubmissions {
        count
        percentage
      }
    }
  }
`;

const GET_STUDENT_ASSESSMENT_PROGRESS = gql`
  query GetStudentAssessmentProgress($studentId: ID!, $courseId: ID) {
    studentAssessmentProgress(studentId: $studentId, courseId: $courseId) {
      totalQuizzes
      completedQuizzes
      averageQuizScore
      totalAssignments
      submittedAssignments
      averageAssignmentGrade
      overallProgress
      recentActivity {
        type
        title
        completedAt
        score
      }
    }
  }
`;

const GET_ASSESSMENT_ATTEMPTS = gql`
  query GetAssessmentAttempts($assessmentId: ID!, $studentId: ID) {
    assessmentAttempts(assessmentId: $assessmentId, studentId: $studentId) {
      id
      attemptNumber
      startedAt
      submittedAt
      score
      status
      timeSpent
      answers {
        questionId
        answer
        isCorrect
        timeSpent
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
}

interface MutationResult<T, V = Record<string, unknown>> {
  mutate: (variables: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

interface QuizSession {
  attempt: QuizAttempt | null;
  timeRemaining: number;
  autoSave: boolean;
  submitAnswer: (questionId: string, answer: string | string[]) => Promise<void>;
  submitQuiz: () => Promise<QuizAttempt>;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook for starting a quiz attempt with timer management
 *
 * @returns Quiz session management utilities
 *
 * @example
 * ```tsx
 * function QuizTaker({ quizId }: { quizId: string }) {
 *   const { mutate: startQuiz, loading, error } = useStartQuiz();
 *   const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
 *
 *   const handleStartQuiz = async () => {
 *     try {
 *       const newAttempt = await startQuiz({ input: { quizId } });
 *       setAttempt(newAttempt);
 *     } catch (err) {
 *       console.error('Failed to start quiz:', err);
 *     }
 *   };
 *
 *   if (!attempt) {
 *     return (
 *       <div>
 *         <h1>Ready to start the quiz?</h1>
 *         <button onClick={handleStartQuiz} disabled={loading}>
 *           {loading ? 'Starting...' : 'Start Quiz'}
 *         </button>
 *         {error && <div>Error: {error.message}</div>}
 *       </div>
 *     );
 *   }
 *
 *   return <QuizInterface attempt={attempt} />;
 * }
 * ```
 */
export function useStartQuiz(): MutationResult<QuizAttempt, { input: StartQuizInput }> {
  const [startQuizMutation, { loading, error, reset }] = useMutation<StartQuizResponse>(
    START_QUIZ,
    {
      errorPolicy: 'all',
    }
  );

  const mutate = useCallback(
    async (variables: { input: StartQuizInput }): Promise<QuizAttempt> => {
      const result = await startQuizMutation({ variables });
      if (!result.data?.startQuiz) {
        throw new Error('Failed to start quiz');
      }
      return result.data.startQuiz;
    },
    [startQuizMutation]
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for managing quiz sessions with auto-save functionality
 *
 * @param attemptId - The quiz attempt ID
 * @returns Quiz session management utilities
 *
 * @example
 * ```tsx
 * function QuizInterface({ attemptId }: { attemptId: string }) {
 *   const { attempt, timeRemaining, submitAnswer, submitQuiz, loading, error } = useQuizSession(attemptId);
 *
 *   const handleAnswerChange = async (questionId: string, answer: any) => {
 *     try {
 *       await submitAnswer(questionId, answer);
 *     } catch (err) {
 *       console.error('Failed to save answer:', err);
 *     }
 *   };
 *
 *   const handleSubmitQuiz = async () => {
 *     try {
 *       const result = await submitQuiz();
 *       // Navigate to results page
 *     } catch (err) {
 *       console.error('Failed to submit quiz:', err);
 *     }
 *   };
 *
 *   if (!attempt) return <div>Loading quiz...</div>;
 *
 *   return (
 *     <div>
 *       <div>Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</div>
 *       {attempt.quiz.questions.map(question => (
 *         <QuestionComponent
 *           key={question.id}
 *           question={question}
 *           onAnswerChange={(answer) => handleAnswerChange(question.id, answer)}
 *         />
 *       ))}
 *       <button onClick={handleSubmitQuiz} disabled={loading}>
 *         Submit Quiz
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useQuizSession(attemptId: string): QuizSession {
  const [submitAnswerMutation] = useMutation(SUBMIT_QUIZ_ANSWER);
  const [submitQuizMutation, { loading: submitLoading, error: submitError }] =
    useMutation<SubmitQuizResponse>(SUBMIT_QUIZ);

  // Initialize time remaining from server data using lazy initial state
  const [timeRemaining, setTimeRemaining] = useState(() => 0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    data: attemptData,
    loading,
    error,
  } = useQuery<GetQuizAttemptResponse>(GET_QUIZ_ATTEMPT, {
    variables: { id: attemptId },
    skip: !attemptId,
    errorPolicy: 'all',
  });

  // Update time remaining when server data changes - using useEffect with proper dependency
  useEffect(() => {
    if (attemptData?.quizAttempt?.timeRemaining !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeRemaining(prev => {
        // Only update if we haven't started counting down yet (initial load)
        return prev === 0 ? attemptData.quizAttempt.timeRemaining : prev;
      });
    }
  }, [attemptData?.quizAttempt?.timeRemaining]);

  // Timer management
  useEffect(() => {
    if (attemptData?.quizAttempt?.status === 'IN_PROGRESS' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            submitQuizMutation({ variables: { attemptId } });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [attemptData?.quizAttempt?.status, timeRemaining, attemptId, submitQuizMutation]);

  const submitAnswer = useCallback(
    async (questionId: string, answer: string | string[]) => {
      try {
        await submitAnswerMutation({
          variables: {
            input: {
              attemptId,
              questionId,
              answer: typeof answer === 'string' ? answer : answer.join(','),
            },
          },
        });
      } catch (err) {
        console.error('Failed to submit answer:', err);
        throw err;
      }
    },
    [attemptId, submitAnswerMutation]
  );

  const submitQuiz = useCallback(async () => {
    try {
      const result = await submitQuizMutation({ variables: { attemptId } });

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      return result.data?.submitQuiz;
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      throw err;
    }
  }, [attemptId, submitQuizMutation]);

  return {
    attempt: attemptData?.quizAttempt || null,
    timeRemaining,
    autoSave: true,
    submitAnswer,
    submitQuiz: async () => {
      const result = await submitQuiz();
      if (!result) {
        throw new Error('Failed to submit quiz');
      }
      return result;
    },
    loading: loading || submitLoading,
    error: error || submitError,
  };
}

/**
 * Hook for submitting assignments with file upload support
 *
 * @returns Assignment submission utilities
 *
 * @example
 * ```tsx
 * function AssignmentSubmission({ assignmentId }: { assignmentId: string }) {
 *   const { mutate: submitAssignment, loading, error } = useSubmitAssignment();
 *   const { uploadFile } = useFileUpload();
 *
 *   const handleSubmit = async (formData: { text: string; files: File[] }) => {
 *     try {
 *       // Upload files first if any
 *       const uploadedFiles = [];
 *       for (const file of formData.files) {
 *         const uploadResult = await uploadFile(file);
 *         uploadedFiles.push({
 *           fileName: file.name,
 *           fileKey: uploadResult.fileKey,
 *           fileSize: file.size,
 *         });
 *       }
 *
 *       // Submit assignment
 *       const submission = await submitAssignment({
 *         input: {
 *           assignmentId,
 *           submissionText: formData.text,
 *           files: uploadedFiles,
 *         }
 *       });
 *
 *       console.log('Assignment submitted:', submission);
 *     } catch (err) {
 *       console.error('Failed to submit assignment:', err);
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <textarea placeholder="Your submission..." />
 *       <input type="file" multiple />
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Submitting...' : 'Submit Assignment'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useSubmitAssignment(): MutationResult<
  AssignmentSubmission,
  { input: SubmitAssignmentInput }
> {
  const [submitAssignmentMutation, { loading, error, reset }] =
    useMutation<SubmitAssignmentResponse>(SUBMIT_ASSIGNMENT, {
      errorPolicy: 'all',
      // Update cache after successful submission
      update: (cache: ApolloCache, { data }) => {
        if (data?.submitAssignment) {
          const assignmentId = data.submitAssignment.assignment.id;

          // Update assignment submissions list
          cache.updateQuery<GetAssignmentResponse>(
            { query: GET_ASSIGNMENT, variables: { id: assignmentId } },
            (existingData: GetAssignmentResponse | null) => {
              if (!existingData?.assignment) return existingData;

              return {
                assignment: {
                  ...existingData.assignment,
                  submissions: [data.submitAssignment, ...existingData.assignment.submissions],
                },
              };
            }
          );
        }
      },
    });

  const mutate = useCallback(
    async (variables: { input: SubmitAssignmentInput }): Promise<AssignmentSubmission> => {
      const result = await submitAssignmentMutation({ variables });
      if (!result.data?.submitAssignment) {
        throw new Error('Failed to submit assignment');
      }
      return result.data.submitAssignment;
    },
    [submitAssignmentMutation]
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for grading assignments (educator workflow)
 *
 * @returns Assignment grading utilities
 *
 * @example
 * ```tsx
 * function GradingInterface({ submissionId }: { submissionId: string }) {
 *   const { mutate: gradeAssignment, loading, error } = useGradeAssignment();
 *
 *   const handleGrade = async (grade: number, feedback: string) => {
 *     try {
 *       const result = await gradeAssignment({
 *         input: {
 *           submissionId,
 *           grade,
 *           feedback,
 *         }
 *       });
 *
 *       console.log('Assignment graded:', result);
 *     } catch (err) {
 *       console.error('Failed to grade assignment:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <input
 *         type="number"
 *         placeholder="Grade (0-100)"
 *         onChange={(e) => setGrade(Number(e.target.value))}
 *       />
 *       <textarea
 *         placeholder="Feedback for student..."
 *         onChange={(e) => setFeedback(e.target.value)}
 *       />
 *       <button onClick={() => handleGrade(grade, feedback)} disabled={loading}>
 *         {loading ? 'Grading...' : 'Submit Grade'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGradeAssignment(): MutationResult<
  AssignmentSubmission,
  { input: GradeAssignmentInput }
> {
  const [gradeAssignmentMutation, { loading, error, reset }] = useMutation<GradeAssignmentResponse>(
    GRADE_ASSIGNMENT,
    {
      errorPolicy: 'all',
      // Update cache after successful grading
      update: (cache: ApolloCache, { data }) => {
        if (data?.gradeAssignment) {
          // Update submission in cache
          const submissionId = cache.identify({
            __typename: 'AssignmentSubmission',
            id: data.gradeAssignment.id,
          });
          if (submissionId) {
            cache.modify({
              id: submissionId,
              fields: {
                grade: () => data.gradeAssignment.grade,
                feedback: () => data.gradeAssignment.feedback,
                gradedAt: () => data.gradeAssignment.gradedAt,
                gradedBy: () => data.gradeAssignment.gradedBy,
                status: () => data.gradeAssignment.status,
              },
            });
          }
        }
      },
    }
  );

  const mutate = useCallback(
    async (variables: { input: GradeAssignmentInput }): Promise<AssignmentSubmission> => {
      const result = await gradeAssignmentMutation({ variables });
      if (!result.data?.gradeAssignment) {
        throw new Error('Failed to grade assignment');
      }
      return result.data.gradeAssignment;
    },
    [gradeAssignmentMutation]
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for fetching quiz data with questions
 *
 * @param quizId - The quiz ID to fetch
 * @returns Query result with quiz data
 */
export function useQuiz(quizId: string): QueryResult<Quiz> {
  const { data, loading, error, refetch } = useQuery<GetQuizResponse>(GET_QUIZ, {
    variables: { id: quizId },
    skip: !quizId,
    errorPolicy: 'all',
  });

  return {
    data: data?.quiz,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching assignment data with submissions
 *
 * @param assignmentId - The assignment ID to fetch
 * @returns Query result with assignment data
 */
export function useAssignment(assignmentId: string): QueryResult<Assignment> {
  const { data, loading, error, refetch } = useQuery<GetAssignmentResponse>(GET_ASSIGNMENT, {
    variables: { id: assignmentId },
    skip: !assignmentId,
    errorPolicy: 'all',
  });

  return {
    data: data?.assignment,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching quiz analytics and reporting data
 *
 * @param quizId - The quiz ID to get analytics for
 * @param dateRange - Optional date range filter
 * @returns Query result with quiz analytics
 *
 * @example
 * ```tsx
 * function QuizAnalyticsDashboard({ quizId }: { quizId: string }) {
 *   const { data: analytics, loading, error } = useQuizAnalytics(quizId, {
 *     startDate: '2024-01-01',
 *     endDate: '2024-12-31'
 *   });
 *
 *   if (loading) return <div>Loading analytics...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!analytics) return <div>No analytics data available</div>;
 *
 *   return (
 *     <div>
 *       <h2>Quiz Analytics</h2>
 *       <div>Total Attempts: {analytics.totalAttempts}</div>
 *       <div>Average Score: {analytics.averageScore}%</div>
 *       <div>Pass Rate: {analytics.passRate}%</div>
 *       <div>Average Time: {analytics.averageTimeSpent} minutes</div>
 *
 *       <h3>Question Performance</h3>
 *       {analytics.questionAnalytics.map(qa => (
 *         <div key={qa.questionId}>
 *           Question {qa.questionId}: {qa.correctAnswerRate}% correct
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useQuizAnalytics(
  quizId: string,
  dateRange?: { startDate: string; endDate: string }
): QueryResult<any> {
  const { data, loading, error, refetch } = useQuery(GET_QUIZ_ANALYTICS, {
    variables: {
      quizId,
      dateRange: dateRange
        ? {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          }
        : undefined,
    },
    skip: !quizId,
    errorPolicy: 'all',
  });

  return {
    data: data?.quizAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching assignment analytics and reporting data
 *
 * @param assignmentId - The assignment ID to get analytics for
 * @param dateRange - Optional date range filter
 * @returns Query result with assignment analytics
 *
 * @example
 * ```tsx
 * function AssignmentAnalyticsDashboard({ assignmentId }: { assignmentId: string }) {
 *   const { data: analytics, loading, error } = useAssignmentAnalytics(assignmentId);
 *
 *   if (loading) return <div>Loading analytics...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!analytics) return <div>No analytics data available</div>;
 *
 *   return (
 *     <div>
 *       <h2>Assignment Analytics</h2>
 *       <div>Total Submissions: {analytics.totalSubmissions}</div>
 *       <div>Average Grade: {analytics.averageGrade}%</div>
 *       <div>Submission Rate: {analytics.submissionRate}%</div>
 *       <div>Late Submissions: {analytics.lateSubmissions.count} ({analytics.lateSubmissions.percentage}%)</div>
 *
 *       <h3>Grade Distribution</h3>
 *       {analytics.gradeDistribution.map(grade => (
 *         <div key={grade.range}>
 *           {grade.range}: {grade.count} students
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssignmentAnalytics(
  assignmentId: string,
  dateRange?: { startDate: string; endDate: string }
): QueryResult<any> {
  const { data, loading, error, refetch } = useQuery(GET_ASSIGNMENT_ANALYTICS, {
    variables: {
      assignmentId,
      dateRange: dateRange
        ? {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          }
        : undefined,
    },
    skip: !assignmentId,
    errorPolicy: 'all',
  });

  return {
    data: data?.assignmentAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for tracking student assessment progress across courses
 *
 * @param studentId - The student ID to track progress for
 * @param courseId - Optional course ID to filter by specific course
 * @returns Query result with student progress data
 *
 * @example
 * ```tsx
 * function StudentProgressDashboard({ studentId, courseId }: { studentId: string; courseId?: string }) {
 *   const { data: progress, loading, error } = useStudentAssessmentProgress(studentId, courseId);
 *
 *   if (loading) return <div>Loading progress...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!progress) return <div>No progress data available</div>;
 *
 *   return (
 *     <div>
 *       <h2>Assessment Progress</h2>
 *       <div>Quiz Progress: {progress.completedQuizzes}/{progress.totalQuizzes} ({progress.averageQuizScore}% avg)</div>
 *       <div>Assignment Progress: {progress.submittedAssignments}/{progress.totalAssignments} ({progress.averageAssignmentGrade}% avg)</div>
 *       <div>Overall Progress: {progress.overallProgress}%</div>
 *
 *       <h3>Recent Activity</h3>
 *       {progress.recentActivity.map((activity, index) => (
 *         <div key={index}>
 *           {activity.type}: {activity.title} - Score: {activity.score}% ({activity.completedAt})
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStudentAssessmentProgress(
  studentId: string,
  courseId?: string
): QueryResult<any> {
  const { data, loading, error, refetch } = useQuery(GET_STUDENT_ASSESSMENT_PROGRESS, {
    variables: { studentId, courseId },
    skip: !studentId,
    errorPolicy: 'all',
  });

  return {
    data: data?.studentAssessmentProgress,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for tracking assessment attempts and time management
 *
 * @param assessmentId - The assessment (quiz/assignment) ID
 * @param studentId - The student ID to track attempts for
 * @returns Query result with attempt tracking data
 *
 * @example
 * ```tsx
 * function AttemptTracker({ assessmentId, studentId }: { assessmentId: string; studentId: string }) {
 *   const { data: attempts, loading, error } = useAssessmentAttempts(assessmentId, studentId);
 *
 *   if (loading) return <div>Loading attempts...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!attempts || attempts.length === 0) return <div>No attempts found</div>;
 *
 *   return (
 *     <div>
 *       <h2>Assessment Attempts</h2>
 *       {attempts.map(attempt => (
 *         <div key={attempt.id}>
 *           <h3>Attempt #{attempt.attemptNumber}</h3>
 *           <div>Started: {new Date(attempt.startedAt).toLocaleString()}</div>
 *           <div>Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'In Progress'}</div>
 *           <div>Score: {attempt.score}%</div>
 *           <div>Time Spent: {Math.floor(attempt.timeSpent / 60)} minutes</div>
 *           <div>Status: {attempt.status}</div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssessmentAttempts(assessmentId: string, studentId: string): QueryResult<any[]> {
  const { data, loading, error, refetch } = useQuery(GET_ASSESSMENT_ATTEMPTS, {
    variables: { assessmentId, studentId },
    skip: !assessmentId || !studentId,
    errorPolicy: 'all',
  });

  return {
    data: data?.assessmentAttempts || [],
    loading,
    error,
    refetch,
  };
}
