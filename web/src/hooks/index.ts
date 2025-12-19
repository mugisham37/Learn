/**
 * Data Fetching Hooks
 * 
 * Domain-specific React hooks for all backend modules.
 * Provides consistent API patterns with loading states, optimistic updates,
 * and proper cleanup and error handling.
 */

// User Management Hooks
export {
  useCurrentUser,
  useUserById,
  useUpdateProfile,
  useNotificationPreferences,
} from './useUsers';

// Course Management Hooks
export {
  useCourses,
  useCourse,
  useMyCourses,
  useCreateCourse,
  useUpdateCourse,
  usePublishCourse,
} from './useCourses';

// Enrollment Tracking Hooks
export {
  useMyEnrollments,
  useEnrollmentProgress,
  useEnrollInCourse,
  useUpdateLessonProgress,
} from './useEnrollments';

// Content Management Hooks
export {
  useFileUpload,
  useVideoUpload,
  useStreamingUrl,
  useUploadProgress,
} from './useContent';

// Assessment Hooks
export {
  useStartQuiz,
  useQuizSession,
  useSubmitAssignment,
  useGradeAssignment,
  useQuiz,
  useAssignment,
} from './useAssessments';

// Communication Hooks
export {
  useConversations,
  useChatSession,
  useDiscussionThreads,
  useCreateThread,
  useReplyToThread,
} from './useCommunication';