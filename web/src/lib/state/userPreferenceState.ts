/**
 * User Preference Management State
 * 
 * Provides comprehensive state management for user preferences with:
 * - User preference state with automatic persistence
 * - Notification preference management
 * - Theme and display preference handling
 * - Preference synchronization across devices
 * 
 * Requirements: 10.5
 */

import { useCallback, useReducer, useEffect, useRef } from 'react';

// Preference Types
export interface NotificationPreferences {
  email: {
    courseUpdates: boolean;
    assignmentDue: boolean;
    messageReceived: boolean;
    discussionReply: boolean;
    systemAnnouncements: boolean;
    marketingEmails: boolean;
  };
  push: {
    courseUpdates: boolean;
    assignmentDue: boolean;
    messageReceived: boolean;
    discussionReply: boolean;
    systemAnnouncements: boolean;
  };
  inApp: {
    courseUpdates: boolean;
    assignmentDue: boolean;
    messageReceived: boolean;
    discussionReply: boolean;
    systemAnnouncements: boolean;
    soundEnabled: boolean;
  };
  digest: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:MM format
    timezone: string;
  };
}

export interface DisplayPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  currency: string;
  compactMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
}

export interface LearningPreferences {
  autoplay: boolean;
  playbackSpeed: number;
  subtitles: boolean;
  subtitleLanguage: string;
  videoQuality: 'auto' | '720p' | '1080p';
  downloadQuality: 'low' | 'medium' | 'high';
  offlineMode: boolean;
  progressTracking: boolean;
  reminderFrequency: 'none' | 'daily' | 'weekly';
  studyGoal: {
    enabled: boolean;
    hoursPerWeek: number;
    daysPerWeek: number[];
    reminderTime: string;
  };
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'students' | 'private';
  showProgress: boolean;
  showCertificates: boolean;
  allowMessages: 'everyone' | 'enrolled' | 'none';
  dataCollection: boolean;
  analytics: boolean;
  thirdPartyIntegrations: boolean;
}

export interface AccessibilityPreferences {
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  skipLinks: boolean;
  alternativeText: boolean;
  captionsRequired: boolean;
  audioDescriptions: boolean;
  colorBlindnessSupport: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  display: DisplayPreferences;
  learning: LearningPreferences;
  privacy: PrivacyPreferences;
  accessibility: AccessibilityPreferences;
  lastSynced: Date | null;
  version: number;
}

export interface PreferenceState {
  preferences: UserPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncError: string | null;
  deviceId: string;
  conflictResolution: {
    hasConflict: boolean;
    localVersion: UserPreferences | null;
    remoteVersion: UserPreferences | null;
  };
}

export interface PreferenceActions {
  // Notification preferences
  updateNotificationPreferences: (updates: Partial<NotificationPreferences>) => void;
  toggleEmailNotification: (type: keyof NotificationPreferences['email']) => void;
  togglePushNotification: (type: keyof NotificationPreferences['push']) => void;
  toggleInAppNotification: (type: keyof NotificationPreferences['inApp']) => void;
  updateDigestSettings: (settings: Partial<NotificationPreferences['digest']>) => void;
  
  // Display preferences
  updateDisplayPreferences: (updates: Partial<DisplayPreferences>) => void;
  setTheme: (theme: DisplayPreferences['theme']) => void;
  setLanguage: (language: string) => void;
  setTimezone: (timezone: string) => void;
  setFontSize: (fontSize: DisplayPreferences['fontSize']) => void;
  
  // Learning preferences
  updateLearningPreferences: (updates: Partial<LearningPreferences>) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVideoQuality: (quality: LearningPreferences['videoQuality']) => void;
  updateStudyGoal: (goal: Partial<LearningPreferences['studyGoal']>) => void;
  
  // Privacy preferences
  updatePrivacyPreferences: (updates: Partial<PrivacyPreferences>) => void;
  setProfileVisibility: (visibility: PrivacyPreferences['profileVisibility']) => void;
  
  // Accessibility preferences
  updateAccessibilityPreferences: (updates: Partial<AccessibilityPreferences>) => void;
  
  // General operations
  savePreferences: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  resetToDefaults: () => void;
  exportPreferences: () => string;
  importPreferences: (data: string) => Promise<void>;
  
  // Sync operations
  syncPreferences: () => Promise<void>;
  resolveConflict: (resolution: 'keep-local' | 'keep-remote' | 'merge') => Promise<void>;
  
  // Utility operations
  getPreferenceValue: <T>(path: string) => T | undefined;
  setPreferenceValue: (path: string, value: unknown) => void;
}

// Action Types
type PreferenceAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PREFERENCES'; payload: UserPreferences }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: PreferenceState['syncStatus'] }
  | { type: 'SET_SYNC_ERROR'; payload: string | null }
  | { type: 'SET_CONFLICT'; payload: { localVersion: UserPreferences; remoteVersion: UserPreferences } }
  | { type: 'CLEAR_CONFLICT' }
  | { type: 'RESET_TO_DEFAULTS' };

// Default Preferences
const defaultPreferences: UserPreferences = {
  notifications: {
    email: {
      courseUpdates: true,
      assignmentDue: true,
      messageReceived: true,
      discussionReply: true,
      systemAnnouncements: true,
      marketingEmails: false,
    },
    push: {
      courseUpdates: true,
      assignmentDue: true,
      messageReceived: true,
      discussionReply: false,
      systemAnnouncements: true,
    },
    inApp: {
      courseUpdates: true,
      assignmentDue: true,
      messageReceived: true,
      discussionReply: true,
      systemAnnouncements: true,
      soundEnabled: true,
    },
    digest: {
      enabled: true,
      frequency: 'weekly',
      time: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  },
  display: {
    theme: 'system',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    currency: 'USD',
    compactMode: false,
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
  },
  learning: {
    autoplay: true,
    playbackSpeed: 1.0,
    subtitles: false,
    subtitleLanguage: 'en',
    videoQuality: 'auto',
    downloadQuality: 'medium',
    offlineMode: false,
    progressTracking: true,
    reminderFrequency: 'weekly',
    studyGoal: {
      enabled: false,
      hoursPerWeek: 5,
      daysPerWeek: [1, 2, 3, 4, 5], // Monday to Friday
      reminderTime: '19:00',
    },
  },
  privacy: {
    profileVisibility: 'students',
    showProgress: true,
    showCertificates: true,
    allowMessages: 'enrolled',
    dataCollection: true,
    analytics: true,
    thirdPartyIntegrations: false,
  },
  accessibility: {
    screenReader: false,
    keyboardNavigation: false,
    focusIndicators: false,
    skipLinks: false,
    alternativeText: false,
    captionsRequired: false,
    audioDescriptions: false,
    colorBlindnessSupport: 'none',
  },
  lastSynced: null,
  version: 1,
};

// Initial State
const initialState: PreferenceState = {
  preferences: defaultPreferences,
  isLoading: false,
  isSaving: false,
  error: null,
  hasUnsavedChanges: false,
  syncStatus: 'idle',
  lastSyncError: null,
  deviceId: generateDeviceId(),
  conflictResolution: {
    hasConflict: false,
    localVersion: null,
    remoteVersion: null,
  },
};

// Utility Functions
function generateDeviceId(): string {
  const stored = localStorage.getItem('device-id');
  if (stored) return stored;
  
  const deviceId = Math.random().toString(36).substring(2, 18);
  localStorage.setItem('device-id', deviceId);
  return deviceId;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] as Record<string, unknown> || {}, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

function getNestedValue<T = unknown>(obj: Record<string, unknown>, path: string): T | undefined {
  return path.split('.').reduce((current: unknown, key: string): unknown => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as T | undefined;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key] as Record<string, unknown>;
  }, obj);
  
  target[lastKey] = value;
  return { ...obj };
}

// Reducer
function preferenceReducer(state: PreferenceState, action: PreferenceAction): PreferenceState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: action.payload,
        hasUnsavedChanges: false,
        error: null,
      };

    case 'UPDATE_PREFERENCES':
      const mergedPreferences = deepMerge(
        state.preferences as unknown as Record<string, unknown>, 
        action.payload as unknown as Record<string, unknown>
      ) as unknown as UserPreferences;
      return {
        ...state,
        preferences: {
          ...mergedPreferences,
          version: state.preferences.version + 1,
        },
        hasUnsavedChanges: true,
      };

    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    case 'SET_SYNC_STATUS':
      return {
        ...state,
        syncStatus: action.payload,
        lastSyncError: action.payload === 'synced' ? null : state.lastSyncError,
      };

    case 'SET_SYNC_ERROR':
      return {
        ...state,
        lastSyncError: action.payload,
        syncStatus: action.payload ? 'error' : state.syncStatus,
      };

    case 'SET_CONFLICT':
      return {
        ...state,
        conflictResolution: {
          hasConflict: true,
          localVersion: action.payload.localVersion,
          remoteVersion: action.payload.remoteVersion,
        },
      };

    case 'CLEAR_CONFLICT':
      return {
        ...state,
        conflictResolution: {
          hasConflict: false,
          localVersion: null,
          remoteVersion: null,
        },
      };

    case 'RESET_TO_DEFAULTS':
      return {
        ...state,
        preferences: {
          ...defaultPreferences,
          version: state.preferences.version + 1,
        } as UserPreferences,
        hasUnsavedChanges: true,
      };

    default:
      return state;
  }
}

// Custom Hook
export function useUserPreferences(): [PreferenceState, PreferenceActions] {
  const [state, dispatch] = useReducer(preferenceReducer, initialState);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const loadStoredPreferences = () => {
      try {
        const stored = localStorage.getItem('user-preferences');
        if (stored) {
          const preferences = JSON.parse(stored);
          preferences.lastSynced = preferences.lastSynced ? new Date(preferences.lastSynced) : null;
          dispatch({ type: 'SET_PREFERENCES', payload: preferences });
        }
      } catch (error) {
        console.error('Failed to load stored preferences:', error);
      }
    };

    loadStoredPreferences();
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (state.hasUnsavedChanges) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        localStorage.setItem('user-preferences', JSON.stringify(state.preferences));
        // savePreferences will be called from a separate effect
      }, 2000); // Auto-save after 2 seconds of inactivity
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.hasUnsavedChanges, state.preferences]);

  // Periodic sync
  useEffect(() => {
    const interval = setInterval(() => {
      // Sync will be handled by a separate effect after actions are defined
    }, 5 * 60 * 1000); // Sync every 5 minutes

    syncIntervalRef.current = interval;

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    const theme = state.preferences.display.theme;
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [state.preferences.display.theme]);

  // Apply accessibility preferences
  useEffect(() => {
    const { accessibility, display } = state.preferences;
    const root = document.documentElement;
    
    root.style.setProperty('--reduced-motion', display.reducedMotion ? '1' : '0');
    root.setAttribute('data-high-contrast', display.highContrast.toString());
    root.setAttribute('data-keyboard-navigation', accessibility.keyboardNavigation.toString());
    root.setAttribute('data-screen-reader', accessibility.screenReader.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferences.accessibility, state.preferences.display]); // More specific dependencies are better than the whole object

  // Actions
  const actions: PreferenceActions = {
    updateNotificationPreferences: useCallback((updates: Partial<NotificationPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { 
        notifications: {
          ...state.preferences.notifications,
          ...updates,
        }
      } });
    }, [state.preferences.notifications]),

    toggleEmailNotification: useCallback((type: keyof NotificationPreferences['email']) => {
      const currentValue = state.preferences.notifications.email[type];
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        notifications: {
          ...state.preferences.notifications,
          email: {
            ...state.preferences.notifications.email,
            [type]: !currentValue,
          },
        },
      }});
    }, [state.preferences.notifications]),

    togglePushNotification: useCallback((type: keyof NotificationPreferences['push']) => {
      const currentValue = state.preferences.notifications.push[type];
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        notifications: {
          ...state.preferences.notifications,
          push: {
            ...state.preferences.notifications.push,
            [type]: !currentValue,
          },
        },
      }});
    }, [state.preferences.notifications]),

    toggleInAppNotification: useCallback((type: keyof NotificationPreferences['inApp']) => {
      const currentValue = state.preferences.notifications.inApp[type];
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        notifications: {
          ...state.preferences.notifications,
          inApp: {
            ...state.preferences.notifications.inApp,
            [type]: !currentValue,
          },
        },
      }});
    }, [state.preferences.notifications]),

    updateDigestSettings: useCallback((settings: Partial<NotificationPreferences['digest']>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        notifications: {
          ...state.preferences.notifications,
          digest: {
            ...state.preferences.notifications.digest,
            ...settings,
          },
        },
      }});
    }, [state.preferences.notifications]),

    updateDisplayPreferences: useCallback((updates: Partial<DisplayPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { 
        display: {
          ...state.preferences.display,
          ...updates,
        }
      } });
    }, [state.preferences.display]),

    setTheme: useCallback((theme: DisplayPreferences['theme']) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        display: {
          ...state.preferences.display,
          theme,
        },
      }});
    }, [state.preferences.display]),

    setLanguage: useCallback((language: string) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        display: {
          ...state.preferences.display,
          language,
        },
      }});
    }, [state.preferences.display]),

    setTimezone: useCallback((timezone: string) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        display: {
          ...state.preferences.display,
          timezone,
        },
      }});
    }, [state.preferences.display]),

    setFontSize: useCallback((fontSize: DisplayPreferences['fontSize']) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        display: {
          ...state.preferences.display,
          fontSize,
        },
      }});
    }, [state.preferences.display]),

    updateLearningPreferences: useCallback((updates: Partial<LearningPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { 
        learning: {
          ...state.preferences.learning,
          ...updates,
        }
      } });
    }, [state.preferences.learning]),

    setPlaybackSpeed: useCallback((speed: number) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        learning: {
          ...state.preferences.learning,
          playbackSpeed: speed,
        },
      }});
    }, [state.preferences.learning]),

    setVideoQuality: useCallback((quality: LearningPreferences['videoQuality']) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        learning: {
          ...state.preferences.learning,
          videoQuality: quality,
        },
      }});
    }, [state.preferences.learning]),

    updateStudyGoal: useCallback((goal: Partial<LearningPreferences['studyGoal']>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        learning: {
          ...state.preferences.learning,
          studyGoal: {
            ...state.preferences.learning.studyGoal,
            ...goal,
          },
        },
      }});
    }, [state.preferences.learning]),

    updatePrivacyPreferences: useCallback((updates: Partial<PrivacyPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { 
        privacy: {
          ...state.preferences.privacy,
          ...updates,
        }
      } });
    }, [state.preferences.privacy]),

    setProfileVisibility: useCallback((visibility: PrivacyPreferences['profileVisibility']) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: {
        privacy: {
          ...state.preferences.privacy,
          profileVisibility: visibility,
        },
      }});
    }, [state.preferences.privacy]),

    updateAccessibilityPreferences: useCallback((updates: Partial<AccessibilityPreferences>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: { 
        accessibility: {
          ...state.preferences.accessibility,
          ...updates,
        }
      } });
    }, [state.preferences.accessibility]),

    savePreferences: useCallback(async () => {
      if (!state.hasUnsavedChanges) return;

      dispatch({ type: 'SET_SAVING', payload: true });

      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        const updatedPreferences = {
          ...state.preferences,
          lastSynced: new Date(),
        };

        dispatch({ type: 'SET_PREFERENCES', payload: updatedPreferences });
        localStorage.setItem('user-preferences', JSON.stringify(updatedPreferences));
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to save preferences' });
        console.error('Failed to save preferences:', error);
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false });
      }
    }, [state.hasUnsavedChanges, state.preferences]),

    loadPreferences: useCallback(async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // In a real implementation, this would call the GraphQL query
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        // For now, just use stored preferences
        const stored = localStorage.getItem('user-preferences');
        if (stored) {
          const preferences = JSON.parse(stored);
          preferences.lastSynced = preferences.lastSynced ? new Date(preferences.lastSynced) : null;
          dispatch({ type: 'SET_PREFERENCES', payload: preferences });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load preferences' });
        console.error('Failed to load preferences:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, []),

    resetToDefaults: useCallback(() => {
      dispatch({ type: 'RESET_TO_DEFAULTS' });
    }, []),

    exportPreferences: useCallback(() => {
      return JSON.stringify(state.preferences, null, 2);
    }, [state.preferences]),

    importPreferences: useCallback(async (data: string) => {
      try {
        const preferences = JSON.parse(data);
        
        // Validate the structure (basic validation)
        if (!preferences.notifications || !preferences.display || !preferences.learning) {
          throw new Error('Invalid preference data structure');
        }

        preferences.lastSynced = preferences.lastSynced ? new Date(preferences.lastSynced) : null;
        preferences.version = (preferences.version || 0) + 1;

        dispatch({ type: 'SET_PREFERENCES', payload: preferences });
        // Call savePreferences directly to avoid dependency issues
        dispatch({ type: 'SET_SAVING', payload: true });
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedPreferences = {
            ...preferences,
            lastSynced: new Date(),
          };
          dispatch({ type: 'SET_PREFERENCES', payload: updatedPreferences });
          localStorage.setItem('user-preferences', JSON.stringify(updatedPreferences));
        } catch (saveError) {
          dispatch({ type: 'SET_ERROR', payload: 'Failed to save preferences' });
          console.error('Failed to save preferences:', saveError);
        } finally {
          dispatch({ type: 'SET_SAVING', payload: false });
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to import preferences' });
        throw error;
      }
    }, []),

    syncPreferences: useCallback(async () => {
      if (state.syncStatus === 'syncing') return;

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      try {
        // In a real implementation, this would:
        // 1. Fetch remote preferences
        // 2. Compare versions
        // 3. Handle conflicts if necessary
        // 4. Sync changes

        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

        // Mock conflict detection
        const hasConflict = Math.random() < 0.1; // 10% chance of conflict for demo

        if (hasConflict) {
          const remoteVersion = {
            ...state.preferences,
            display: {
              ...state.preferences.display,
              theme: 'dark' as const, // Simulate a conflicting change
            },
            version: state.preferences.version + 1,
          };

          dispatch({ type: 'SET_CONFLICT', payload: {
            localVersion: state.preferences,
            remoteVersion,
          }});
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          dispatch({ type: 'SET_SYNC_ERROR', payload: 'Sync conflict detected' });
        } else {
          const syncedPreferences = {
            ...state.preferences,
            lastSynced: new Date(),
          };

          dispatch({ type: 'SET_PREFERENCES', payload: syncedPreferences });
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
        }
      } catch (error) {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        dispatch({ type: 'SET_SYNC_ERROR', payload: 'Sync failed' });
        console.error('Failed to sync preferences:', error);
      }
    }, [state.syncStatus, state.preferences]),

    resolveConflict: useCallback(async (resolution: 'keep-local' | 'keep-remote' | 'merge') => {
      if (!state.conflictResolution.hasConflict) return;

      const { localVersion, remoteVersion } = state.conflictResolution;
      if (!localVersion || !remoteVersion) return;

      let resolvedPreferences: UserPreferences;

      switch (resolution) {
        case 'keep-local':
          resolvedPreferences = { ...localVersion, version: localVersion.version + 1 };
          break;
        case 'keep-remote':
          resolvedPreferences = { ...remoteVersion, version: remoteVersion.version + 1 };
          break;
        case 'merge':
          resolvedPreferences = {
            ...deepMerge(
              remoteVersion as unknown as Record<string, unknown>, 
              localVersion as unknown as Record<string, unknown>
            ) as unknown as UserPreferences,
            version: Math.max(localVersion.version, remoteVersion.version) + 1,
          };
          break;
        default:
          return;
      }

      try {
        dispatch({ type: 'SET_PREFERENCES', payload: resolvedPreferences });
        dispatch({ type: 'CLEAR_CONFLICT' });
        // Call savePreferences logic directly to avoid dependency issues
        dispatch({ type: 'SET_SAVING', payload: true });
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedPreferences = {
            ...resolvedPreferences,
            lastSynced: new Date(),
          };
          dispatch({ type: 'SET_PREFERENCES', payload: updatedPreferences });
          localStorage.setItem('user-preferences', JSON.stringify(updatedPreferences));
        } catch (saveError) {
          dispatch({ type: 'SET_ERROR', payload: 'Failed to save preferences' });
          console.error('Failed to save preferences:', saveError);
        } finally {
          dispatch({ type: 'SET_SAVING', payload: false });
        }
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
        dispatch({ type: 'SET_SYNC_ERROR', payload: null });
      } catch (error) {
        dispatch({ type: 'SET_SYNC_ERROR', payload: 'Failed to resolve conflict' });
        console.error('Failed to resolve conflict:', error);
      }
    }, [state.conflictResolution]),

    getPreferenceValue: useCallback(<T>(path: string): T | undefined => {
      return getNestedValue<T>(state.preferences as unknown as Record<string, unknown>, path);
    }, [state.preferences]),

    setPreferenceValue: useCallback((path: string, value: unknown) => {
      const updatedPreferences = setNestedValue(
        state.preferences as unknown as Record<string, unknown>, 
        path, 
        value
      ) as unknown as UserPreferences;
      dispatch({ type: 'UPDATE_PREFERENCES', payload: updatedPreferences });
    }, [state.preferences]),
  };

  // Load preferences from server on mount - now that actions are defined
  useEffect(() => {
    actions.loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array since this should only run once on mount

  // Auto-save to server when localStorage is updated
  useEffect(() => {
    if (state.hasUnsavedChanges) {
      const timer = setTimeout(() => {
        actions.savePreferences();
      }, 3000); // Save to server 1 second after localStorage save

      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hasUnsavedChanges]); // actions intentionally omitted to prevent infinite re-renders

  // Periodic sync - now that actions are defined
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.syncStatus !== 'syncing') {
        actions.syncPreferences();
      }
    }, 5 * 60 * 1000); // Sync every 5 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.syncStatus]); // actions intentionally omitted to prevent infinite re-renders

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  return [state, actions];
}

// Utility functions for external use
export function getPreferenceCategories(): Array<{ key: keyof UserPreferences; label: string; description: string }> {
  return [
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'Manage how and when you receive notifications',
    },
    {
      key: 'display',
      label: 'Display & Language',
      description: 'Customize the appearance and language settings',
    },
    {
      key: 'learning',
      label: 'Learning Experience',
      description: 'Configure your learning preferences and goals',
    },
    {
      key: 'privacy',
      label: 'Privacy & Sharing',
      description: 'Control your privacy and data sharing settings',
    },
    {
      key: 'accessibility',
      label: 'Accessibility',
      description: 'Accessibility features and accommodations',
    },
  ];
}

export function validatePreferences(preferences: Partial<UserPreferences>): string[] {
  const errors: string[] = [];

  // Validate playback speed
  if (preferences.learning?.playbackSpeed) {
    const speed = preferences.learning.playbackSpeed;
    if (speed < 0.25 || speed > 3.0) {
      errors.push('Playback speed must be between 0.25x and 3.0x');
    }
  }

  // Validate study goal hours
  if (preferences.learning?.studyGoal?.hoursPerWeek) {
    const hours = preferences.learning.studyGoal.hoursPerWeek;
    if (hours < 1 || hours > 168) {
      errors.push('Study goal hours must be between 1 and 168 hours per week');
    }
  }

  // Validate timezone
  if (preferences.display?.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: preferences.display.timezone });
    } catch {
      errors.push('Invalid timezone specified');
    }
  }

  return errors;
}