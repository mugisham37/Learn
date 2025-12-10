/**
 * Announcement Repository Implementation
 * 
 * Implements data access operations for announcements using Drizzle ORM
 */

import { eq, and, desc, asc, lte, isNull, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { announcements } from '../../../../infrastructure/database/schema/communication.schema.js';
import type { IAnnouncementRepository } from './IAnnouncementRepository.js';
import type { Announcement, AnnouncementData } from '../../domain/entities/Announcement.js';

export class AnnouncementRepository implements IAnnouncementRepository {
  constructor(private db: NodePgDatabase<any>) {}

  async create(data: AnnouncementData): Promise<Announcement> {
    const [announcement] = await this.db
      .insert(announcements)
      .values({
        courseId: data.courseId,
        educatorId: data.educatorId,
        title: data.title,
        content: data.content,
        scheduledFor: data.scheduledFor,
        publishedAt: data.scheduledFor ? null : new Date(),
      })
      .returning();

    return this.mapToEntity(announcement);
  }

  async findById(id: string): Promise<Announcement | null> {
    const [announcement] = await this.db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    return announcement ? this.mapToEntity(announcement) : null;
  }

  async findByCourseId(
    courseId: string,
    options: {
      includeScheduled?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Announcement[]> {
    const { includeScheduled = false, limit = 50, offset = 0 } = options;

    let whereConditions = [eq(announcements.courseId, courseId)];

    if (!includeScheduled) {
      whereConditions.push(isNull(announcements.scheduledFor));
    }

    const results = await this.db
      .select()
      .from(announcements)
      .where(and(...whereConditions))
      .orderBy(desc(announcements.publishedAt), desc(announcements.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map(this.mapToEntity);
  }
  async findByEducatorId(
    educatorId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Announcement[]> {
    const { limit = 50, offset = 0 } = options;

    const results = await this.db
      .select()
      .from(announcements)
      .where(eq(announcements.educatorId, educatorId))
      .orderBy(desc(announcements.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map(this.mapToEntity);
  }

  async findScheduledReadyToPublish(): Promise<Announcement[]> {
    const now = new Date();
    
    const results = await this.db
      .select()
      .from(announcements)
      .where(
        and(
          lte(announcements.scheduledFor, now),
          isNull(announcements.publishedAt)
        )
      )
      .orderBy(asc(announcements.scheduledFor));

    return results.map(this.mapToEntity);
  }

  async update(id: string, data: Partial<AnnouncementData>): Promise<Announcement> {
    const [announcement] = await this.db
      .update(announcements)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();

    return this.mapToEntity(announcement);
  }

  async markAsPublished(id: string, publishedAt: Date = new Date()): Promise<Announcement> {
    const [announcement] = await this.db
      .update(announcements)
      .set({
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();

    return this.mapToEntity(announcement);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(announcements)
      .where(eq(announcements.id, id));
  }

  async countByCourseId(courseId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(announcements)
      .where(eq(announcements.courseId, courseId));

    return result.count;
  }

  private mapToEntity(row: any): Announcement {
    return {
      id: row.id,
      courseId: row.courseId,
      educatorId: row.educatorId,
      title: row.title,
      content: row.content,
      scheduledFor: row.scheduledFor,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}