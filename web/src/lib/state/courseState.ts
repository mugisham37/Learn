/**
 * Course Editor State Management
 *
 * Provides comprehensive state management for course editing with:
 * - Undo/redo functionality for all course changes
 * - Auto-save with conflict resolution
 * - Module and lesson reordering state management
 * - Draft state persistence and recovery
 *
 * Requirements: 10.1
 */

import { useCallback, useReducer, useRef, useEffect } from 'react';
import { Course, CourseModule, Lesson } from '../../types/entities';

// State Types
export interface CourseEditorState {
  // Current course data
  course: Partial<Course> | null;
  originalCourse: Course | null;

  // Edit state
  isDirty: boolean;
  isAutoSaving: boolean;
  lastSaved: Date | null;

  // Undo/Redo state
  history: CourseSnapshot[];
  historyIndex: number;
  maxHistorySize: number;

  // Conflict resolution
  hasConflicts: boolean;
  conflictData: Course | null;

  // Draft management
  draftId: string | null;
  isDraft: boolean;
}

export interface CourseSnapshot {
  id: string;
  timestamp: Date;
  action: string;
  course: Partial<Course>;
}

export interface CourseEditorActions {
  // Course operations
  loadCourse: (course: Course) => void;
  createNewCourse: () => void;
  updateCourse: (updates: Partial<Course>) => void;

  // Module operations
  addModule: (module: Omit<CourseModule, 'id' | 'courseId'>) => void;
  updateModule: (moduleId: string, updates: Partial<CourseModule>) => void;
  deleteModule: (moduleId: string) => void;
  reorderModules: (moduleIds: string[]) => void;

  // Lesson operations
  addLesson: (
    moduleId: string,
    lesson: Omit<Lesson, 'id' | 'module' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateLesson: (lessonId: string, updates: Partial<Lesson>) => void;
  deleteLesson: (lessonId: string) => void;
  reorderLessons: (moduleId: string, lessonIds: string[]) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Save operations
  save: () => Promise<void>;
  autoSave: () => Promise<void>;

  // Draft operations
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  deleteDraft: () => Promise<void>;

  // Conflict resolution
  resolveConflict: (resolution: 'keep-local' | 'keep-remote' | 'merge') => void;
}

// Action Types
type CourseEditorAction =
  | { type: 'LOAD_COURSE'; payload: Course }
  | { type: 'CREATE_NEW_COURSE' }
  | { type: 'UPDATE_COURSE'; payload: Partial<Course> }
  | { type: 'ADD_MODULE'; payload: CourseModule }
  | { type: 'UPDATE_MODULE'; payload: { moduleId: string; updates: Partial<CourseModule> } }
  | { type: 'DELETE_MODULE'; payload: string }
  | { type: 'REORDER_MODULES'; payload: string[] }
  | { type: 'ADD_LESSON'; payload: { moduleId: string; lesson: Lesson } }
  | { type: 'UPDATE_LESSON'; payload: { lessonId: string; updates: Partial<Lesson> } }
  | { type: 'DELETE_LESSON'; payload: string }
  | { type: 'REORDER_LESSONS'; payload: { moduleId: string; lessonIds: string[] } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_AUTO_SAVING'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: Date }
  | { type: 'SET_CONFLICTS'; payload: { hasConflicts: boolean; conflictData?: Course } }
  | { type: 'RESOLVE_CONFLICT'; payload: 'keep-local' | 'keep-remote' | 'merge' }
  | { type: 'SET_DRAFT'; payload: { draftId: string; isDraft: boolean } }
  | { type: 'CLEAR_DRAFT' };

// Initial State
const initialState: CourseEditorState = {
  course: null,
  originalCourse: null,
  isDirty: false,
  isAutoSaving: false,
  lastSaved: null,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  hasConflicts: false,
  conflictData: null,
  draftId: null,
  isDraft: false,
};

// Utility Functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createSnapshot(action: string, course: Partial<Course>): CourseSnapshot {
  return {
    id: generateId(),
    timestamp: new Date(),
    action,
    course: JSON.parse(JSON.stringify(course)), // Deep clone
  };
}

function addToHistory(
  state: CourseEditorState,
  action: string,
  course: Partial<Course>
): CourseEditorState {
  const snapshot = createSnapshot(action, course);
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(snapshot);

  // Limit history size
  if (newHistory.length > state.maxHistorySize) {
    newHistory.shift();
  }

  return {
    ...state,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

// Reducer
function courseEditorReducer(
  state: CourseEditorState,
  action: CourseEditorAction
): CourseEditorState {
  switch (action.type) {
    case 'LOAD_COURSE':
      return {
        ...state,
        course: { ...action.payload },
        originalCourse: action.payload,
        isDirty: false,
        history: [createSnapshot('LOAD_COURSE', action.payload)],
        historyIndex: 0,
      };

    case 'CREATE_NEW_COURSE':
      const newCourse: Partial<Course> = {
        title: '',
        description: '',
        category: '',
        difficulty: 'BEGINNER' as const,
        modules: [],
      };
      return {
        ...state,
        course: newCourse,
        originalCourse: null,
        isDirty: false,
        isDraft: true,
        history: [createSnapshot('CREATE_NEW_COURSE', newCourse)],
        historyIndex: 0,
      };

    case 'UPDATE_COURSE':
      if (!state.course) return state;

      const updatedCourse = { ...state.course, ...action.payload };
      const newState = addToHistory(state, 'UPDATE_COURSE', updatedCourse);

      return {
        ...newState,
        course: updatedCourse,
        isDirty: true,
      };

    case 'ADD_MODULE':
      if (!state.course) return state;

      const courseWithNewModule = {
        ...state.course,
        modules: [...(state.course.modules || []), action.payload],
      };
      const moduleState = addToHistory(state, 'ADD_MODULE', courseWithNewModule);

      return {
        ...moduleState,
        course: courseWithNewModule,
        isDirty: true,
      };

    case 'UPDATE_MODULE':
      if (!state.course?.modules) return state;

      const updatedModules = state.course.modules.map(module =>
        module.id === action.payload.moduleId ? { ...module, ...action.payload.updates } : module
      );

      const courseWithUpdatedModule = { ...state.course, modules: updatedModules };
      const updatedModuleState = addToHistory(state, 'UPDATE_MODULE', courseWithUpdatedModule);

      return {
        ...updatedModuleState,
        course: courseWithUpdatedModule,
        isDirty: true,
      };

    case 'DELETE_MODULE':
      if (!state.course?.modules) return state;

      const filteredModules = state.course.modules.filter(module => module.id !== action.payload);
      const courseWithDeletedModule = { ...state.course, modules: filteredModules };
      const deletedModuleState = addToHistory(state, 'DELETE_MODULE', courseWithDeletedModule);

      return {
        ...deletedModuleState,
        course: courseWithDeletedModule,
        isDirty: true,
      };

    case 'REORDER_MODULES':
      if (!state.course?.modules) return state;

      const reorderedModules = action.payload
        .map(moduleId => state.course?.modules?.find(module => module.id === moduleId))
        .filter((module): module is CourseModule => module !== undefined);

      const courseWithReorderedModules = { ...state.course, modules: reorderedModules };
      const reorderedState = addToHistory(state, 'REORDER_MODULES', courseWithReorderedModules);

      return {
        ...reorderedState,
        course: courseWithReorderedModules,
        isDirty: true,
      };

    case 'ADD_LESSON':
      if (!state.course?.modules) return state;

      const modulesWithNewLesson = state.course.modules.map(module =>
        module.id === action.payload.moduleId
          ? { ...module, lessons: [...(module.lessons || []), action.payload.lesson] }
          : module
      );

      const courseWithNewLesson = { ...state.course, modules: modulesWithNewLesson };
      const lessonState = addToHistory(state, 'ADD_LESSON', courseWithNewLesson);

      return {
        ...lessonState,
        course: courseWithNewLesson,
        isDirty: true,
      };

    case 'UPDATE_LESSON':
      if (!state.course?.modules) return state;

      const modulesWithUpdatedLesson = state.course.modules.map(module => ({
        ...module,
        lessons:
          module.lessons?.map(lesson =>
            lesson.id === action.payload.lessonId
              ? { ...lesson, ...action.payload.updates }
              : lesson
          ) || [],
      }));

      const courseWithUpdatedLesson = { ...state.course, modules: modulesWithUpdatedLesson };
      const updatedLessonState = addToHistory(state, 'UPDATE_LESSON', courseWithUpdatedLesson);

      return {
        ...updatedLessonState,
        course: courseWithUpdatedLesson,
        isDirty: true,
      };

    case 'DELETE_LESSON':
      if (!state.course?.modules) return state;

      const modulesWithDeletedLesson = state.course.modules.map(module => ({
        ...module,
        lessons: module.lessons?.filter(lesson => lesson.id !== action.payload) || [],
      }));

      const courseWithDeletedLesson = { ...state.course, modules: modulesWithDeletedLesson };
      const deletedLessonState = addToHistory(state, 'DELETE_LESSON', courseWithDeletedLesson);

      return {
        ...deletedLessonState,
        course: courseWithDeletedLesson,
        isDirty: true,
      };

    case 'REORDER_LESSONS':
      if (!state.course?.modules) return state;

      const modulesWithReorderedLessons = state.course.modules.map(module =>
        module.id === action.payload.moduleId
          ? {
              ...module,
              lessons: action.payload.lessonIds
                .map(lessonId => module.lessons?.find(lesson => lesson.id === lessonId))
                .filter((lesson): lesson is Lesson => lesson !== undefined),
            }
          : module
      );

      const courseWithReorderedLessons = { ...state.course, modules: modulesWithReorderedLessons };
      const reorderedLessonsState = addToHistory(
        state,
        'REORDER_LESSONS',
        courseWithReorderedLessons
      );

      return {
        ...reorderedLessonsState,
        course: courseWithReorderedLessons,
        isDirty: true,
      };

    case 'UNDO':
      if (state.historyIndex <= 0) return state;

      const prevIndex = state.historyIndex - 1;
      const prevSnapshot = state.history[prevIndex];

      if (!prevSnapshot) return state;

      return {
        ...state,
        course: { ...prevSnapshot.course },
        historyIndex: prevIndex,
        isDirty: prevIndex > 0, // Not dirty if we're back to the original
      };

    case 'REDO':
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextIndex = state.historyIndex + 1;
      const nextSnapshot = state.history[nextIndex];

      if (!nextSnapshot) return state;

      return {
        ...state,
        course: { ...nextSnapshot.course },
        historyIndex: nextIndex,
        isDirty: true,
      };

    case 'SET_AUTO_SAVING':
      return {
        ...state,
        isAutoSaving: action.payload,
      };

    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload,
        isDirty: false,
      };

    case 'SET_CONFLICTS':
      return {
        ...state,
        hasConflicts: action.payload.hasConflicts,
        conflictData: action.payload.conflictData || null,
      };

    case 'RESOLVE_CONFLICT':
      if (!state.conflictData) return state;

      let resolvedCourse: Partial<Course>;

      switch (action.payload) {
        case 'keep-local':
          resolvedCourse = state.course!;
          break;
        case 'keep-remote':
          resolvedCourse = state.conflictData;
          break;
        case 'merge':
          // Simple merge strategy - in practice, this would be more sophisticated
          resolvedCourse = { ...state.conflictData, ...state.course };
          break;
        default:
          return state;
      }

      const resolvedState = addToHistory(state, 'RESOLVE_CONFLICT', resolvedCourse);

      return {
        ...resolvedState,
        course: resolvedCourse,
        hasConflicts: false,
        conflictData: null,
        isDirty: true,
      };

    case 'SET_DRAFT':
      return {
        ...state,
        draftId: action.payload.draftId,
        isDraft: action.payload.isDraft,
      };

    case 'CLEAR_DRAFT':
      return {
        ...state,
        draftId: null,
        isDraft: false,
      };

    default:
      return state;
  }
}

// Custom Hook
export function useCourseEditor(): [CourseEditorState, CourseEditorActions] {
  const [state, dispatch] = useReducer(courseEditorReducer, initialState);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conflictCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!state.course || !state.isDirty || state.isAutoSaving) return;

    dispatch({ type: 'SET_AUTO_SAVING', payload: true });

    try {
      // In a real implementation, this would call the GraphQL mutation
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      dispatch({ type: 'SET_LAST_SAVED', payload: new Date() });

      // Save to localStorage as draft
      if (state.isDraft && state.course) {
        const draftKey = `course-draft-${state.draftId || 'new'}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            course: state.course,
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      dispatch({ type: 'SET_AUTO_SAVING', payload: false });
    }
  }, [state.course, state.isDirty, state.isAutoSaving, state.isDraft, state.draftId]);

  // Set up auto-save timer
  useEffect(() => {
    if (state.isDirty && !state.isAutoSaving) {
      autoSaveTimeoutRef.current = setTimeout(autoSave, 5000); // Auto-save after 5 seconds
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.isDirty, state.isAutoSaving, autoSave]);

  // Actions
  const actions: CourseEditorActions = {
    loadCourse: useCallback((course: Course) => {
      dispatch({ type: 'LOAD_COURSE', payload: course });
    }, []),

    createNewCourse: useCallback(() => {
      const draftId = generateId();
      dispatch({ type: 'CREATE_NEW_COURSE' });
      dispatch({ type: 'SET_DRAFT', payload: { draftId, isDraft: true } });
    }, []),

    updateCourse: useCallback((updates: Partial<Course>) => {
      dispatch({ type: 'UPDATE_COURSE', payload: updates });
    }, []),

    addModule: useCallback(
      (module: Omit<CourseModule, 'id' | 'course' | 'createdAt' | 'updatedAt'>) => {
        const newModule: CourseModule = {
          ...module,
          id: generateId(),
          course: state.course as Course,
          lessons: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_MODULE', payload: newModule });
      },
      [state.course]
    ),

    updateModule: useCallback((moduleId: string, updates: Partial<CourseModule>) => {
      dispatch({ type: 'UPDATE_MODULE', payload: { moduleId, updates } });
    }, []),

    deleteModule: useCallback((moduleId: string) => {
      dispatch({ type: 'DELETE_MODULE', payload: moduleId });
    }, []),

    reorderModules: useCallback((moduleIds: string[]) => {
      dispatch({ type: 'REORDER_MODULES', payload: moduleIds });
    }, []),

    addLesson: useCallback(
      (moduleId: string, lesson: Omit<Lesson, 'id' | 'module' | 'createdAt' | 'updatedAt'>) => {
        const targetModule = state.course?.modules?.find(m => m.id === moduleId);
        if (!targetModule) return;

        const newLesson: Lesson = {
          ...lesson,
          id: generateId(),
          module: targetModule,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_LESSON', payload: { moduleId, lesson: newLesson } });
      },
      [state.course?.modules]
    ),

    updateLesson: useCallback((lessonId: string, updates: Partial<Lesson>) => {
      dispatch({ type: 'UPDATE_LESSON', payload: { lessonId, updates } });
    }, []),

    deleteLesson: useCallback((lessonId: string) => {
      dispatch({ type: 'DELETE_LESSON', payload: lessonId });
    }, []),

    reorderLessons: useCallback((moduleId: string, lessonIds: string[]) => {
      dispatch({ type: 'REORDER_LESSONS', payload: { moduleId, lessonIds } });
    }, []),

    undo: useCallback(() => {
      dispatch({ type: 'UNDO' });
    }, []),

    redo: useCallback(() => {
      dispatch({ type: 'REDO' });
    }, []),

    canUndo: useCallback(() => {
      return state.historyIndex > 0;
    }, [state.historyIndex]),

    canRedo: useCallback(() => {
      return state.historyIndex < state.history.length - 1;
    }, [state.historyIndex, state.history.length]),

    save: useCallback(async () => {
      if (!state.course) return;

      try {
        // In a real implementation, this would call the appropriate GraphQL mutation
        // (createCourse or updateCourse based on whether it's a new course)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        dispatch({ type: 'SET_LAST_SAVED', payload: new Date() });

        if (state.isDraft) {
          dispatch({ type: 'CLEAR_DRAFT' });
          // Clear draft from localStorage
          const draftKey = `course-draft-${state.draftId}`;
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error('Save failed:', error);
        throw error;
      }
    }, [state.course, state.isDraft, state.draftId]),

    autoSave,

    saveDraft: useCallback(async () => {
      if (!state.course) return;

      const draftId = state.draftId || generateId();
      const draftKey = `course-draft-${draftId}`;

      const draftData = {
        course: state.course,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(draftKey, JSON.stringify(draftData));

      if (!state.draftId) {
        dispatch({ type: 'SET_DRAFT', payload: { draftId, isDraft: true } });
      }
    }, [state.course, state.draftId]),

    loadDraft: useCallback(async (draftId: string) => {
      const draftKey = `course-draft-${draftId}`;
      const draftData = localStorage.getItem(draftKey);

      if (draftData) {
        const { course } = JSON.parse(draftData);
        dispatch({ type: 'LOAD_COURSE', payload: course });
        dispatch({ type: 'SET_DRAFT', payload: { draftId, isDraft: true } });
      }
    }, []),

    deleteDraft: useCallback(async () => {
      if (state.draftId) {
        const draftKey = `course-draft-${state.draftId}`;
        localStorage.removeItem(draftKey);
        dispatch({ type: 'CLEAR_DRAFT' });
      }
    }, [state.draftId]),

    resolveConflict: useCallback((resolution: 'keep-local' | 'keep-remote' | 'merge') => {
      dispatch({ type: 'RESOLVE_CONFLICT', payload: resolution });
    }, []),
  };

  // Cleanup on unmount
  useEffect(() => {
    const autoSaveTimeout = autoSaveTimeoutRef.current;
    const conflictCheckInterval = conflictCheckIntervalRef.current;

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      if (conflictCheckInterval) {
        clearInterval(conflictCheckInterval);
      }
    };
  }, []);

  return [state, actions];
}

// Utility functions for external use
export function getCourseEditorDrafts(): Array<{
  id: string;
  course: Partial<Course>;
  timestamp: string;
}> {
  const drafts: Array<{ id: string; course: Partial<Course>; timestamp: string }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('course-draft-')) {
      const draftId = key.replace('course-draft-', '');
      const draftData = localStorage.getItem(key);

      if (draftData) {
        try {
          const { course, timestamp } = JSON.parse(draftData);
          drafts.push({ id: draftId, course, timestamp });
        } catch (error) {
          console.error('Failed to parse draft:', error);
        }
      }
    }
  }

  return drafts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function clearAllCourseEditorDrafts(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('course-draft-')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
