/**
 * Assessment Hooks
 * 
 * React hooks for assessment-related operations including quiz attempts,
 * assignment submissions, and grading workflows.
 */

import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { gql } from '@apollo/client';
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Quiz,
  QuizAttempt,
  Assignment,
  AssignmentSubmission,
  Question,
  QuizAnswer,
  StartQuizInput,
  SubmitQuizAnswerInput,
  SubmitAssignmentInput,
  GradeAssignmentInput,
  QuizAttemptStatus,
  AssignmentSubmissionStatus,
} from '../types';

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

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: any;
  refetch: () => Promise<any>;
}

interface MutationResult<T> {
  mutate: (variables: any) => Promise<T>;
  loading: boolean;
  error: any;
  reset: () => void;
}

interface QuizSession {
  attempt: QuizAttempt | null;
  timeRemaining: number;
  autoSave: boolean;
  submitAnswer: (questionId: string, answer: any) => Promise<void>;
  submitQuiz: () => Promise<QuizAttempt>;
  loading: boolean;
  error: any;
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
export function useStartQuiz(): MutationResult<QuizAttempt> {
  const [startQuizMutation, { loading, error, reset }] = useMutation(START_QUIZ, {
    errorPolicy: 'all',
  });

  const mutate = useCallback(async (variables: { input: StartQuizInput }) => {
    const result = await startQuizMutation({ variables });
    return result.data?.startQuiz;
  }, [startQuizMutation]);

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
  const [submitQuizMutation, { loading: submitLoading, error: submitError }] = useMutation(SUBMIT_QUIZ);
  
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: attemptData, loading, error, refetch } = useQuery(GET_QUIZ_ATTEMPT, {
    variables: { id: attemptId },
    skip: !attemptId,
    errorPolicy: 'all',
    onCompleted: (data) => {
      if (data?.quizAttempt?.timeRemaining) {
        setTimeRemaining(data.quizAttempt.timeRemaining);
      }
    },
  });

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

  const submitAnswer = useCallback(async (questionId: string, answer: any) => {
    try {
      await submitAnswerMutation({
        variables: {
          input: {
            attemptId,
            questionId,
            answer,
          },
        },
      });
    } catch (err) {
      console.error('Failed to submit answer:', err);
      throw err;
    }
  }, [attemptId, submitAnswerMutation]);

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
    attempt: attemptData?.quizAttempt,
    timeRemaining,
    autoSave: true,
    submitAnswer,
    submitQuiz,
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
export function useSubmitAssignment(): MutationResult<AssignmentSubmission> {
  const [submitAssignmentMutation, { loading, error, reset }] = useMutation(SUBMIT_ASSIGNMENT, {
    errorPolicy: 'all',
    // Update cache after successful submission
    update: (cache, { data }) => {
      if (data?.submitAssignment) {
        const assignmentId = data.submitAssignment.assignment.id;
        
        // Update assignment submissions list
        cache.updateQuery(
          { query: GET_ASSIGNMENT, variables: { id: assignmentId } },
          (existingData) => {
            if (!existingData?.assignment) return existingData;
            
            return {
              assignment: {
                ...existingData.assignment,
                submissions: [
                  data.submitAssignment,
                  ...existingData.assignment.submissions,
                ],
              },
            };
          }
        );
      }
    },
  });

  const mutate = useCallback(async (variables: { input: SubmitAssignmentInput }) => {
    const result = await submitAssignmentMutation({ variables });
    return result.data?.submitAssignment;
  }, [submitAssignmentMutation]);

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
export function useGradeAssignment(): MutationResult<AssignmentSubmission> {
  const [gradeAssignmentMutation, { loading, error, reset }] = useMutation(GRADE_ASSIGNMENT, {
    errorPolicy: 'all',
    // Update cache after successful grading
    update: (cache, { data }) => {
      if (data?.gradeAssignment) {
        // Update submission in cache
        cache.modify({
          id: cache.identify(data.gradeAssignment),
          fields: {
            grade: () => data.gradeAssignment.grade,
            feedback: () => data.gradeAssignment.feedback,
            gradedAt: () => data.gradeAssignment.gradedAt,
            gradedBy: () => data.gradeAssignment.gradedBy,
            status: () => data.gradeAssignment.status,
          },
        });
      }
    },
  });

  const mutate = useCallback(async (variables: { input: GradeAssignmentInput }) => {
    const result = await gradeAssignmentMutation({ variables });
    return result.data?.gradeAssignment;
  }, [gradeAssignmentMutation]);

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
  const { data, loading, error, refetch } = useQuery(GET_QUIZ, {
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
  const { data, loading, error, refetch } = useQuery(GET_ASSIGNMENT, {
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