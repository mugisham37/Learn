/**
 * Announcement Service Interface
 *
 * Defines business operations for course announcements
 */

import type { Announcement, CreateAnnouncementData } from '../../domain/entities/Announcement.js';

export interface IAnnouncementService {
  /**
   * Create a new announcement with educator authorization
   */
  createAnnouncement(
    courseId: string,
    educatorId: string,
    data: CreateAnnouncementData
  ): Promise<AnnouncementCreationResult>;

  /**
   * Schedule an announcement for future publication
   */
  scheduleAnnouncement(
    courseId: string,
    educatorId: string,
    data: CreateAnnouncementData & { scheduledFor: Date }
  ): Promise<AnnouncementCreationResult>;

  /**
   * Get announcements for a course
   */
  getCourseAnnouncements(
    courseId: string,
    options?: {
      includeScheduled?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Announcement[]>;

  /**
   * Get announcements by educator
   */
  getEducatorAnnouncements(
    educatorId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Announcement[]>;

  /**
   * Update an announcement
   */
  updateAnnouncement(
    announcementId: string,
    educatorId: string,
    data: Partial<CreateAnnouncementData>
  ): Promise<AnnouncementUpdateResult>;

  /**
   * Delete an announcement
   */
  deleteAnnouncement(
    announcementId: string,
    educatorId: string
  ): Promise<AnnouncementDeletionResult>;

  /**
   * Publish scheduled announcements that are ready
   */
  publishScheduledAnnouncements(): Promise<PublishScheduledResult>;

  /**
   * Get announcement by ID with authorization check
   */
  getAnnouncementById(announcementId: string, userId: string): Promise<Announcement | null>;
}

export interface AnnouncementCreationResult {
  success: boolean;
  announcement?: Announcement;
  error?: string;
}

export interface AnnouncementUpdateResult {
  success: boolean;
  announcement?: Announcement;
  error?: string;
}

export interface AnnouncementDeletionResult {
  success: boolean;
  error?: string;
}

export interface PublishScheduledResult {
  success: boolean;
  publishedCount: number;
  errors: string[];
}
