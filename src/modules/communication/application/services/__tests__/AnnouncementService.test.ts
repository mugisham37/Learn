/**
 * AnnouncementService Tests
 * 
 * Tests for announcement creation, scheduling, and notification delivery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnouncementService } from '../AnnouncementService.js';
import type { IAnnouncementRepository } from '../../../infrastructure/repositories/IAnnouncementRepository.js';
import type { Announcement, CreateAnnouncementData } from '../../../domain/entities/Announcement.js';

// Mock repository
const mockAnnouncementRepository: IAnnouncementRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCourseId: vi.fn(),
  findByEducatorId: vi.fn(),
  findScheduledReadyToPublish: vi.fn(),
  update: vi.fn(),
  markAsPublished: vi.fn(),
  delete: vi.fn(),
  countByCourseId: vi.fn(),
};

describe('AnnouncementService', () => {
  let announcementService: AnnouncementService;

  beforeEach(() => {
    vi.clearAllMocks();
    announcementService = new AnnouncementService(mockAnnouncementRepository);
  });

  describe('createAnnouncement', () => {
    it('should create an announcement successfully with valid data', async () => {
      const courseId = 'course-123';
      const educatorId = 'educator-456';
      const announcementData: CreateAnnouncementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement content.',
      };

      const mockAnnouncement: Announcement = {
        id: 'announcement-789',
        courseId,
        educatorId,
        title: announcementData.title,
        content: announcementData.content,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockAnnouncementRepository.create).mockResolvedValue(mockAnnouncement);

      const result = await announcementService.createAnnouncement(courseId, educatorId, announcementData);

      expect(result.success).toBe(true);
      expect(result.announcement).toEqual(mockAnnouncement);
      expect(mockAnnouncementRepository.create).toHaveBeenCalledWith({
        courseId,
        educatorId,
        title: announcementData.title,
        content: announcementData.content,
        scheduledFor: undefined,
      });
    });

    it('should return error for invalid announcement data', async () => {
      const courseId = 'course-123';
      const educatorId = 'educator-456';
      const invalidData: CreateAnnouncementData = {
        title: '', // Empty title should be invalid
        content: 'Valid content',
      };

      const result = await announcementService.createAnnouncement(courseId, educatorId, invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Title is required');
      expect(mockAnnouncementRepository.create).not.toHaveBeenCalled();
    });
  });
  describe('scheduleAnnouncement', () => {
    it('should schedule an announcement for future publication', async () => {
      const courseId = 'course-123';
      const educatorId = 'educator-456';
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const announcementData: CreateAnnouncementData & { scheduledFor: Date } = {
        title: 'Scheduled Announcement',
        content: 'This announcement will be published later.',
        scheduledFor: futureDate,
      };

      const mockAnnouncement: Announcement = {
        id: 'announcement-789',
        courseId,
        educatorId,
        title: announcementData.title,
        content: announcementData.content,
        scheduledFor: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockAnnouncementRepository.create).mockResolvedValue(mockAnnouncement);

      const result = await announcementService.scheduleAnnouncement(courseId, educatorId, announcementData);

      expect(result.success).toBe(true);
      expect(result.announcement).toEqual(mockAnnouncement);
      expect(mockAnnouncementRepository.create).toHaveBeenCalledWith({
        courseId,
        educatorId,
        title: announcementData.title,
        content: announcementData.content,
        scheduledFor: futureDate,
      });
    });

    it('should return error for past scheduled date', async () => {
      const courseId = 'course-123';
      const educatorId = 'educator-456';
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const announcementData: CreateAnnouncementData & { scheduledFor: Date } = {
        title: 'Invalid Scheduled Announcement',
        content: 'This should fail.',
        scheduledFor: pastDate,
      };

      const result = await announcementService.scheduleAnnouncement(courseId, educatorId, announcementData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scheduled date must be in the future');
      expect(mockAnnouncementRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getCourseAnnouncements', () => {
    it('should retrieve announcements for a course', async () => {
      const courseId = 'course-123';
      const mockAnnouncements: Announcement[] = [
        {
          id: 'announcement-1',
          courseId,
          educatorId: 'educator-456',
          title: 'First Announcement',
          content: 'First content',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'announcement-2',
          courseId,
          educatorId: 'educator-456',
          title: 'Second Announcement',
          content: 'Second content',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockAnnouncementRepository.findByCourseId).mockResolvedValue(mockAnnouncements);

      const result = await announcementService.getCourseAnnouncements(courseId);

      expect(result).toEqual(mockAnnouncements);
      expect(mockAnnouncementRepository.findByCourseId).toHaveBeenCalledWith(courseId, {});
    });
  });

  describe('publishScheduledAnnouncements', () => {
    it('should publish ready scheduled announcements', async () => {
      const readyAnnouncement: Announcement = {
        id: 'announcement-ready',
        courseId: 'course-123',
        educatorId: 'educator-456',
        title: 'Ready Announcement',
        content: 'Ready to be published',
        scheduledFor: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const publishedAnnouncement: Announcement = {
        ...readyAnnouncement,
        publishedAt: new Date(),
      };

      vi.mocked(mockAnnouncementRepository.findScheduledReadyToPublish).mockResolvedValue([readyAnnouncement]);
      vi.mocked(mockAnnouncementRepository.markAsPublished).mockResolvedValue(publishedAnnouncement);

      const result = await announcementService.publishScheduledAnnouncements();

      expect(result.success).toBe(true);
      expect(result.publishedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockAnnouncementRepository.markAsPublished).toHaveBeenCalledWith(readyAnnouncement.id);
    });
  });
});