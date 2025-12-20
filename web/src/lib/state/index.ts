/**
 * State Management Module Exports
 * 
 * This module provides comprehensive state management patterns for complex UI interactions
 * including course editing, search filtering, chat messaging, and user preferences.
 * 
 * All state management follows consistent patterns with:
 * - Reducer-based state management with useReducer
 * - Automatic persistence where appropriate
 * - Real-time synchronization capabilities
 * - Conflict resolution for concurrent updates
 * - Comprehensive error handling and recovery
 */

// Global state provider and hooks
export { StateProvider, useAppState, useStateManager } from './provider';

// Course Editor State Management
export {
  useCourseEditor,
  getCourseEditorDrafts,
  clearAllCourseEditorDrafts,
  type CourseEditorState,
  type CourseEditorActions,
  type CourseSnapshot,
} from './courseState';

// Search and Filter State Management
export {
  useSearch,
  getSearchSuggestions,
  getPopularSearches,
  type SearchState,
  type SearchActions,
  type SearchFilters,
  type SearchFacets,
  type SearchHistory,
  type SavedSearch,
} from './searchState';

// Chat and Messaging State Management
export {
  useChat,
  getConversationDisplayName,
  getUnreadMessageCount,
  formatMessageTimestamp,
  type ChatState,
  type ChatActions,
  type Message,
  type Conversation,
  type MessageDraft,
  type TypingIndicator,
  type UserPresence,
} from './chatState';

// User Preference Management
export {
  useUserPreferences,
  getPreferenceCategories,
  validatePreferences,
  type PreferenceState,
  type PreferenceActions,
  type UserPreferences,
  type NotificationPreferences,
  type DisplayPreferences,
  type LearningPreferences,
  type PrivacyPreferences,
  type AccessibilityPreferences,
} from './userPreferenceState';