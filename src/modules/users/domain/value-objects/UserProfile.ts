/**
 * UserProfile Value Object
 * 
 * Immutable value object representing user profile information.
 * Contains extended user data beyond core authentication details.
 * 
 * Requirements: 1.1
 */

/**
 * Notification preferences structure
 */
export interface NotificationPreferences {
  email?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
  push?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
  inApp?: {
    newMessage?: boolean;
    assignmentDue?: boolean;
    gradePosted?: boolean;
    courseUpdate?: boolean;
    announcement?: boolean;
    discussionReply?: boolean;
  };
}

/**
 * Privacy settings structure
 */
export interface PrivacySettings {
  profileVisibility?: 'public' | 'private' | 'connections';
  showEmail?: boolean;
  showEnrollments?: boolean;
  showAchievements?: boolean;
}

/**
 * UserProfile value object properties
 */
export interface UserProfileProps {
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  timezone: string;
  language: string;
  notificationPreferences?: NotificationPreferences;
  privacySettings?: PrivacySettings;
}

/**
 * UserProfile value object
 * 
 * Represents user profile information with validation.
 * Immutable once created - use update methods to create new instances.
 */
export class UserProfile {
  private readonly _fullName: string;
  private readonly _bio?: string;
  private readonly _avatarUrl?: string;
  private readonly _timezone: string;
  private readonly _language: string;
  private readonly _notificationPreferences: NotificationPreferences;
  private readonly _privacySettings: PrivacySettings;

  /**
   * Creates a new UserProfile value object
   * 
   * @param props - User profile properties
   */
  private constructor(props: UserProfileProps) {
    this._fullName = props.fullName;
    this._bio = props.bio;
    this._avatarUrl = props.avatarUrl;
    this._timezone = props.timezone;
    this._language = props.language;
    this._notificationPreferences = props.notificationPreferences || {};
    this._privacySettings = props.privacySettings || {};
  }

  /**
   * Factory method to create a UserProfile value object
   * 
   * @param props - User profile properties
   * @returns UserProfile value object
   * @throws Error if validation fails
   */
  static create(props: UserProfileProps): UserProfile {
    // Validate full name
    if (!props.fullName || props.fullName.trim().length === 0) {
      throw new Error('Full name is required');
    }

    if (props.fullName.trim().length > 255) {
      throw new Error('Full name cannot exceed 255 characters');
    }

    // Validate bio if provided
    if (props.bio !== undefined && props.bio !== null) {
      if (props.bio.length > 5000) {
        throw new Error('Bio cannot exceed 5000 characters');
      }
    }

    // Validate avatar URL if provided
    if (props.avatarUrl !== undefined && props.avatarUrl !== null) {
      if (props.avatarUrl.length > 500) {
        throw new Error('Avatar URL cannot exceed 500 characters');
      }
      // Basic URL format check
      try {
        new URL(props.avatarUrl);
      } catch {
        throw new Error('Avatar URL must be a valid URL');
      }
    }

    // Validate timezone
    if (!props.timezone || props.timezone.trim().length === 0) {
      throw new Error('Timezone is required');
    }

    // Validate language
    if (!props.language || props.language.trim().length === 0) {
      throw new Error('Language is required');
    }

    if (props.language.length > 10) {
      throw new Error('Language code cannot exceed 10 characters');
    }

    return new UserProfile(props);
  }

  /**
   * Gets the full name
   */
  get fullName(): string {
    return this._fullName;
  }

  /**
   * Gets the bio
   */
  get bio(): string | undefined {
    return this._bio || undefined;
  }

  /**
   * Gets the avatar URL
   */
  get avatarUrl(): string | undefined {
    return this._avatarUrl || undefined;
  }

  /**
   * Gets the timezone
   */
  get timezone(): string {
    return this._timezone;
  }

  /**
   * Gets the language
   */
  get language(): string {
    return this._language;
  }

  /**
   * Gets the notification preferences
   */
  get notificationPreferences(): NotificationPreferences {
    return this._notificationPreferences ? { ...this._notificationPreferences } : {};
  }

  /**
   * Gets the privacy settings
   */
  get privacySettings(): PrivacySettings {
    return this._privacySettings ? { ...this._privacySettings } : {};
  }

  /**
   * Creates a new UserProfile with updated full name
   * 
   * @param fullName - New full name
   * @returns New UserProfile instance
   */
  updateFullName(fullName: string): UserProfile {
    return UserProfile.create({
      fullName,
      bio: this._bio,
      avatarUrl: this._avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: this._notificationPreferences,
      privacySettings: this._privacySettings,
    });
  }

  /**
   * Creates a new UserProfile with updated bio
   * 
   * @param bio - New bio
   * @returns New UserProfile instance
   */
  updateBio(bio: string | undefined): UserProfile {
    return UserProfile.create({
      fullName: this._fullName,
      bio,
      avatarUrl: this._avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: this._notificationPreferences,
      privacySettings: this._privacySettings,
    });
  }

  /**
   * Creates a new UserProfile with updated avatar URL
   * 
   * @param avatarUrl - New avatar URL
   * @returns New UserProfile instance
   */
  updateAvatarUrl(avatarUrl: string | undefined): UserProfile {
    return UserProfile.create({
      fullName: this._fullName,
      bio: this._bio,
      avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: this._notificationPreferences,
      privacySettings: this._privacySettings,
    });
  }

  /**
   * Creates a new UserProfile with updated notification preferences
   * 
   * @param preferences - New notification preferences
   * @returns New UserProfile instance
   */
  updateNotificationPreferences(preferences: NotificationPreferences): UserProfile {
    return UserProfile.create({
      fullName: this._fullName,
      bio: this._bio,
      avatarUrl: this._avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: preferences,
      privacySettings: this._privacySettings,
    });
  }

  /**
   * Creates a new UserProfile with updated privacy settings
   * 
   * @param settings - New privacy settings
   * @returns New UserProfile instance
   */
  updatePrivacySettings(settings: PrivacySettings): UserProfile {
    return UserProfile.create({
      fullName: this._fullName,
      bio: this._bio,
      avatarUrl: this._avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: this._notificationPreferences,
      privacySettings: settings,
    });
  }

  /**
   * Converts to plain object for persistence
   * 
   * @returns Plain object representation
   */
  toObject(): UserProfileProps {
    return {
      fullName: this._fullName,
      bio: this._bio,
      avatarUrl: this._avatarUrl,
      timezone: this._timezone,
      language: this._language,
      notificationPreferences: this._notificationPreferences,
      privacySettings: this._privacySettings,
    };
  }

  /**
   * Returns JSON representation
   * 
   * @returns JSON object
   */
  toJSON(): UserProfileProps {
    return this.toObject();
  }
}
