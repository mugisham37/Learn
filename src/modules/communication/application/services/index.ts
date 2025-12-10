/**
 * Communication Application Services
 * 
 * Exports all application services for the communication module
 */

export type { IMessagingService, MessageContent, MessageAttachment, MessageResult, ConversationResult } from './IMessagingService.js';
export { MessagingService } from './MessagingService.js';

export type { 
  IDiscussionService,
  CreateThreadDTO,
  CreateReplyDTO,
  VotePostDTO,
  MarkSolutionDTO,
  ThreadCreationResult,
  ReplyCreationResult,
  VoteResult,
  SolutionResult
} from './IDiscussionService.js';
export { DiscussionService } from './DiscussionService.js';

export type {
  IAnnouncementService,
  AnnouncementCreationResult,
  AnnouncementUpdateResult,
  AnnouncementDeletionResult,
  PublishScheduledResult
} from './IAnnouncementService.js';
export { AnnouncementService } from './AnnouncementService.js';