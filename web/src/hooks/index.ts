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
  // Authentication Hooks
  useLogin,
  useRegister,
  useLogout,
  useVerifyEmail,
  useRequestPasswordReset,
  useResetPassword,
  useRefreshToken,
  // Permission and Role Hooks
  useUserPermissions,
  useUserOwnership,
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
  useMyCertificates,
  useVerifyCertificate,
  useCheckEnrollmentEligibility,
  useCheckLessonAccess,
  useWithdrawEnrollment,
  useCompleteLesson,
  useResetLessonProgress,
  useRegenerateCertificate,
  useEnrollmentAnalytics,
} from './useEnrollments';

// Content Management Hooks
export {
  useFileUpload,
  useVideoUpload,
  useStreamingUrl,
  useUploadProgress,
  useVideoAsset,
  useFileAsset,
  useAssetManagement,
  useVideoProcessingStatus,
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

// Payment Processing Hooks
export {
  usePayments,
  useStripeCheckout,
  usePaymentHistory,
  usePayment,
  useSubscriptionManagement,
  useSubscription,
  useRefundProcessing,
  useRefund,
  usePaymentMethods,
  useInvoices,
} from './usePayments';

// Search Module Hooks
export {
  useSearch,
  useFacetedSearch,
  useAutocomplete,
  useTrendingSearches,
  useSearchLessons,
  useSearchAnalytics,
  useSearchOptimization,
} from './useSearch';