/**
 * Announcement Domain Entity
 * 
 * Represents a course announcement from an educator to all enrolled students
 * Supports scheduling and notification delivery
 */

export interface Announcement {
  id: string;
  courseId: string;
  educatorId: string;
  title: string;
  content: string;
  scheduledFor?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnnouncementData {
  title: string;
  content: string;
  scheduledFor?: Date;
}

export interface AnnouncementData extends CreateAnnouncementData {
  courseId: string;
  educatorId: string;
}

/**
 * Validates announcement data
 */
export function validateAnnouncementData(data: CreateAnnouncementData): string[] {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (data.title && data.title.length > 255) {
    errors.push('Title must be 255 characters or less');
  }

  if (!data.content || data.content.trim().length === 0) {
    errors.push('Content is required');
  }

  if (data.content && data.content.length > 10000) {
    errors.push('Content must be 10000 characters or less');
  }

  if (data.scheduledFor && data.scheduledFor < new Date()) {
    errors.push('Scheduled date must be in the future');
  }

  return errors;
}

/**
 * Checks if an announcement is published
 */
export function isAnnouncementPublished(announcement: Announcement): boolean {
  return announcement.publishedAt !== null && announcement.publishedAt !== undefined;
}

/**
 * Checks if an announcement is scheduled for future publication
 */
export function isAnnouncementScheduled(announcement: Announcement): boolean {
  return announcement.scheduledFor !== null && 
         announcement.scheduledFor !== undefined && 
         announcement.scheduledFor > new Date() &&
         !isAnnouncementPublished(announcement);
}

/**
 * Checks if a scheduled announcement is ready to be published
 */
export function isAnnouncementReadyToPublish(announcement: Announcement): boolean {
  return announcement.scheduledFor !== null &&
         announcement.scheduledFor !== undefined &&
         announcement.scheduledFor <= new Date() &&
         !isAnnouncementPublished(announcement);
}