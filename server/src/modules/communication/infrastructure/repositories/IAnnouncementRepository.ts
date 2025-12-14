/**
 * Announcement Repository Interface
 *
 * Defines data access operations for announcements
 */

import type { Announcement, AnnouncementData } from '../../domain/entities/Announcement.js';

export interface IAnnouncementRepository {
  /**
   * Create a new announcement
   */
  create(data: AnnouncementData): Promise<Announcement>;

  /**
   * Find announcement by ID
   */
  findById(id: string): Promise<Announcement | null>;

  /**
   * Find announcements by course ID
   */
  findByCourseId(
    courseId: string,
    options?: {
      includeScheduled?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Announcement[]>;

  /**
   * Find announcements by educator ID
   */
  findByEducatorId(
    educatorId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Announcement[]>;

  /**
   * Find scheduled announcements ready to be published
   */
  findScheduledReadyToPublish(): Promise<Announcement[]>;

  /**
   * Update announcement
   */
  update(id: string, data: Partial<AnnouncementData>): Promise<Announcement>;

  /**
   * Mark announcement as published
   */
  markAsPublished(id: string, publishedAt?: Date): Promise<Announcement>;

  /**
   * Delete announcement
   */
  delete(id: string): Promise<void>;

  /**
   * Count announcements by course ID
   */
  countByCourseId(courseId: string): Promise<number>;
}
