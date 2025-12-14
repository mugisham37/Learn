/**
 * Communication Repository Exports
 */

export type {
  IMessagingRepository,
  ConversationSummary,
  MessagePagination,
  CreateMessageDTO,
  UpdateMessageDTO,
  PaginatedResult as MessagingPaginatedResult,
} from './IMessagingRepository.js';
export { MessagingRepository } from './MessagingRepository.js';
export type {
  IDiscussionRepository,
  ThreadWithDetails,
  PostWithReplies,
  DiscussionPagination,
  ThreadFilter,
  ThreadSortBy,
  PaginatedResult as DiscussionPaginatedResult,
} from './IDiscussionRepository.js';
export { DiscussionRepository } from './DiscussionRepository.js';
export type { IAnnouncementRepository } from './IAnnouncementRepository.js';
export { AnnouncementRepository } from './AnnouncementRepository.js';
