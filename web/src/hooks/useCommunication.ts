/**
 * Communication Hooks
 *
 * React hooks for communication-related operations including messaging,
 * discussions, announcements, and real-time chat functionality.
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Message,
  DiscussionThread,
  DiscussionReply,
  CreateThreadInput,
  ReplyToThreadInput,
  ConversationFilter,
  ThreadFilter,
  PaginationInput,
  ConversationConnection,
  ThreadConnection,
  User,
} from '../types';
import type {
  Announcement,
  AnnouncementInput,
  UpdateAnnouncementInput,
  PresenceUpdate,
  PresenceStatus,
} from '../types/entities';
import type {
  GetConversationsResponse,
  GetConversationMessagesResponse,
  GetDiscussionThreadsResponse,
  GetThreadRepliesResponse,
  SendMessageResponse,
  CreateThreadResponse,
  ReplyToThreadResponse,
  MessageAddedSubscription,
  UserTypingSubscription,
  GetAnnouncementsResponse,
  CreateAnnouncementResponse,
  UpdateAnnouncementResponse,
  PublishAnnouncementResponse,
  DeleteAnnouncementResponse,
  GetCoursePresenceResponse,
  UpdatePresenceResponse,
  AnnouncementPublishedSubscription,
  UserPresenceSubscription,
  ThreadTypingSubscription,
} from '../types/graphql-responses';

// GraphQL Queries and Mutations
const GET_CONVERSATIONS = gql`
  query GetConversations($filter: ConversationFilter, $pagination: PaginationInput) {
    conversations(filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          participants {
            id
            profile {
              fullName
              avatarUrl
            }
          }
          lastMessage {
            id
            content
            sender {
              id
              profile {
                fullName
              }
            }
            sentAt
          }
          unreadCount
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

const GET_CONVERSATION_MESSAGES = gql`
  query GetConversationMessages($conversationId: ID!, $pagination: PaginationInput) {
    conversation(id: $conversationId) {
      id
      participants {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      messages(pagination: $pagination) {
        edges {
          node {
            id
            content
            sender {
              id
              profile {
                fullName
                avatarUrl
              }
            }
            sentAt
            readBy {
              id
              readAt
            }
            attachments {
              id
              fileName
              fileUrl
              fileSize
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
`;

const GET_DISCUSSION_THREADS = gql`
  query GetDiscussionThreads($courseId: ID!, $filter: ThreadFilter, $pagination: PaginationInput) {
    discussionThreads(courseId: $courseId, filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          title
          content
          author {
            id
            profile {
              fullName
              avatarUrl
            }
          }
          course {
            id
            title
          }
          lesson {
            id
            title
          }
          isPinned
          isLocked
          replyCount
          lastReply {
            id
            content
            author {
              id
              profile {
                fullName
              }
            }
            createdAt
          }
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

const GET_THREAD_REPLIES = gql`
  query GetThreadReplies($threadId: ID!, $pagination: PaginationInput) {
    discussionThread(id: $threadId) {
      id
      title
      content
      author {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      course {
        id
        title
      }
      lesson {
        id
        title
      }
      isPinned
      isLocked
      replies(pagination: $pagination) {
        edges {
          node {
            id
            content
            author {
              id
              profile {
                fullName
                avatarUrl
              }
            }
            parentReply {
              id
              author {
                id
                profile {
                  fullName
                }
              }
            }
            createdAt
            updatedAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
      createdAt
      updatedAt
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      sender {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      conversation {
        id
        updatedAt
      }
      sentAt
      attachments {
        id
        fileName
        fileUrl
        fileSize
      }
    }
  }
`;

const CREATE_THREAD = gql`
  mutation CreateThread($input: CreateThreadInput!) {
    createDiscussionThread(input: $input) {
      id
      title
      content
      author {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      course {
        id
        title
      }
      lesson {
        id
        title
      }
      replyCount
      createdAt
    }
  }
`;

const REPLY_TO_THREAD = gql`
  mutation ReplyToThread($input: ReplyToThreadInput!) {
    replyToThread(input: $input) {
      id
      content
      author {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      thread {
        id
        replyCount
      }
      parentReply {
        id
      }
      createdAt
    }
  }
`;

const MARK_MESSAGES_READ = gql`
  mutation MarkMessagesRead($conversationId: ID!, $messageIds: [ID!]) {
    markMessagesRead(conversationId: $conversationId, messageIds: $messageIds) {
      id
      unreadCount
    }
  }
`;

// Subscriptions
const MESSAGE_SUBSCRIPTION = gql`
  subscription OnNewMessage($conversationId: ID!) {
    messageAdded(conversationId: $conversationId) {
      id
      content
      sender {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      sentAt
      attachments {
        id
        fileName
        fileUrl
        fileSize
      }
    }
  }
`;

const TYPING_SUBSCRIPTION = gql`
  subscription OnTyping($conversationId: ID!) {
    userTyping(conversationId: $conversationId) {
      userId
      isTyping
      conversationId
    }
  }
`;

// Additional GraphQL Operations for Announcements
const GET_ANNOUNCEMENTS = gql`
  query GetAnnouncements(
    $courseId: ID!
    $filter: AnnouncementFilter
    $pagination: PaginationInput
  ) {
    announcements(courseId: $courseId, filter: $filter, pagination: $pagination) {
      edges {
        node {
          id
          title
          content
          educator {
            id
            profile {
              fullName
              avatarUrl
            }
          }
          course {
            id
            title
          }
          scheduledFor
          publishedAt
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

const CREATE_ANNOUNCEMENT = gql`
  mutation CreateAnnouncement($courseId: ID!, $input: AnnouncementInput!) {
    createAnnouncement(courseId: $courseId, input: $input) {
      id
      title
      content
      educator {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      course {
        id
        title
      }
      scheduledFor
      publishedAt
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_ANNOUNCEMENT = gql`
  mutation UpdateAnnouncement($announcementId: ID!, $input: UpdateAnnouncementInput!) {
    updateAnnouncement(announcementId: $announcementId, input: $input) {
      id
      title
      content
      scheduledFor
      publishedAt
      updatedAt
    }
  }
`;

const PUBLISH_ANNOUNCEMENT = gql`
  mutation PublishAnnouncement($announcementId: ID!) {
    publishAnnouncement(announcementId: $announcementId) {
      id
      publishedAt
      updatedAt
    }
  }
`;

const DELETE_ANNOUNCEMENT = gql`
  mutation DeleteAnnouncement($announcementId: ID!) {
    deleteAnnouncement(announcementId: $announcementId)
  }
`;

// Presence and Real-time Operations
const UPDATE_PRESENCE = gql`
  mutation UpdatePresence($status: PresenceStatus!, $courseId: ID) {
    updatePresence(status: $status, courseId: $courseId)
  }
`;

const GET_COURSE_PRESENCE = gql`
  query GetCoursePresence($courseId: ID!) {
    coursePresence(courseId: $courseId) {
      userId
      user {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      status
      courseId
      lastSeen
    }
  }
`;

const START_TYPING = gql`
  mutation StartTyping($conversationId: String, $threadId: ID) {
    startTyping(conversationId: $conversationId, threadId: $threadId)
  }
`;

const STOP_TYPING = gql`
  mutation StopTyping($conversationId: String, $threadId: ID) {
    stopTyping(conversationId: $conversationId, threadId: $threadId)
  }
`;

// Enhanced Subscriptions
const ANNOUNCEMENT_SUBSCRIPTION = gql`
  subscription OnAnnouncementPublished($courseId: ID!) {
    announcementPublished(courseId: $courseId) {
      id
      title
      content
      educator {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      course {
        id
        title
      }
      publishedAt
      createdAt
    }
  }
`;

const PRESENCE_SUBSCRIPTION = gql`
  subscription OnUserPresence($courseId: ID!) {
    userPresence(courseId: $courseId) {
      userId
      user {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      status
      courseId
      lastSeen
    }
  }
`;

const THREAD_TYPING_SUBSCRIPTION = gql`
  subscription OnThreadTyping($threadId: ID!) {
    typingIndicator(threadId: $threadId) {
      userId
      user {
        id
        profile {
          fullName
        }
      }
      threadId
      isTyping
    }
  }
`;

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
  fetchMore?: (options: Record<string, unknown>) => Promise<unknown>;
}

interface MutationResult<T, V = Record<string, unknown>> {
  mutate: (variables: V) => Promise<T>;
  loading: boolean;
  error: Error | undefined;
  reset: () => void;
}

interface ChatSession {
  messages: Message[];
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  markAsRead: (messageIds: string[]) => Promise<void>;
  typingUsers: string[];
  setTyping: (isTyping: boolean) => void;
  loading: boolean;
  error: Error | undefined;
}

interface PresenceManager {
  presenceList: PresenceUpdate[];
  updatePresence: (status: PresenceStatus, courseId?: string) => Promise<void>;
  loading: boolean;
  error: Error | undefined;
}

interface AnnouncementManager {
  announcements: Announcement[];
  createAnnouncement: (input: AnnouncementInput) => Promise<Announcement>;
  updateAnnouncement: (id: string, input: UpdateAnnouncementInput) => Promise<Announcement>;
  publishAnnouncement: (id: string) => Promise<Announcement>;
  deleteAnnouncement: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | undefined;
}

/**
 * Hook for fetching user conversations with real-time updates
 *
 * @param filter - Optional conversation filter criteria
 * @param pagination - Optional pagination parameters
 * @returns Query result with conversations data
 *
 * @example
 * ```tsx
 * function ConversationList() {
 *   const { data, loading, error, fetchMore } = useConversations({
 *     filter: { unreadOnly: true },
 *     pagination: { first: 20 }
 *   });
 *
 *   if (loading) return <div>Loading conversations...</div>;
 *   if (error) return <div>Error loading conversations</div>;
 *
 *   return (
 *     <div>
 *       {data?.edges.map(({ node: conversation }) => (
 *         <ConversationItem key={conversation.id} conversation={conversation} />
 *       ))}
 *       {data?.pageInfo.hasNextPage && (
 *         <button onClick={() => fetchMore({ variables: { pagination: { after: data.pageInfo.endCursor } } })}>
 *           Load More
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConversations(
  filter?: ConversationFilter,
  pagination?: PaginationInput
): QueryResult<ConversationConnection> {
  const { data, loading, error, refetch, fetchMore } = useQuery<GetConversationsResponse>(
    GET_CONVERSATIONS,
    {
      variables: { filter, pagination },
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
      pollInterval: 30000, // Poll every 30 seconds for new conversations
    }
  );

  return {
    data: data?.conversations,
    loading,
    error,
    refetch,
    fetchMore,
  };
}

/**
 * Hook for managing a chat session with real-time messaging
 *
 * @param conversationId - The conversation ID to manage
 * @returns Chat session management utilities
 *
 * @example
 * ```tsx
 * function ChatInterface({ conversationId }: { conversationId: string }) {
 *   const { messages, sendMessage, markAsRead, typingUsers, setTyping, loading, error } = useChatSession(conversationId);
 *   const [messageText, setMessageText] = useState('');
 *
 *   const handleSendMessage = async () => {
 *     if (messageText.trim()) {
 *       await sendMessage(messageText);
 *       setMessageText('');
 *     }
 *   };
 *
 *   const handleTyping = (isTyping: boolean) => {
 *     setTyping(isTyping);
 *   };
 *
 *   useEffect(() => {
 *     // Mark messages as read when they come into view
 *     const unreadMessages = messages.filter(msg => !msg.readBy.some(read => read.id === currentUserId));
 *     if (unreadMessages.length > 0) {
 *       markAsRead(unreadMessages.map(msg => msg.id));
 *     }
 *   }, [messages, markAsRead]);
 *
 *   return (
 *     <div>
 *       <div className="messages">
 *         {messages.map(message => (
 *           <MessageBubble key={message.id} message={message} />
 *         ))}
 *         {typingUsers.length > 0 && (
 *           <div>Users typing: {typingUsers.join(', ')}</div>
 *         )}
 *       </div>
 *       <div className="input">
 *         <input
 *           value={messageText}
 *           onChange={(e) => {
 *             setMessageText(e.target.value);
 *             handleTyping(e.target.value.length > 0);
 *           }}
 *           onBlur={() => handleTyping(false)}
 *           placeholder="Type a message..."
 *         />
 *         <button onClick={handleSendMessage} disabled={loading}>
 *           Send
 *         </button>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChatSession(conversationId: string): ChatSession {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sendMessageMutation, { loading: sendLoading, error: sendError }] =
    useMutation<SendMessageResponse>(SEND_MESSAGE);
  const [markReadMutation] = useMutation(MARK_MESSAGES_READ);
  const setTypingRef = useRef<((isTyping: boolean) => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch conversation messages
  const {
    data: conversationData,
    loading,
    error,
  } = useQuery<GetConversationMessagesResponse>(GET_CONVERSATION_MESSAGES, {
    variables: { conversationId, pagination: { first: 50 } },
    skip: !conversationId,
    errorPolicy: 'all',
  });

  // Subscribe to new messages
  useSubscription<MessageAddedSubscription>(MESSAGE_SUBSCRIPTION, {
    variables: { conversationId },
    skip: !conversationId,
    onData: ({ data, client }) => {
      if (data.data?.messageAdded) {
        // Update cache with new message
        client.cache.updateQuery<GetConversationMessagesResponse>(
          { query: GET_CONVERSATION_MESSAGES, variables: { conversationId } },
          (existingData: GetConversationMessagesResponse | null) => {
            if (!existingData?.conversation?.messages?.edges) return existingData;

            return {
              conversation: {
                ...existingData.conversation,
                messages: {
                  ...existingData.conversation.messages,
                  edges: [
                    {
                      node: data.data!.messageAdded,
                      cursor: data.data!.messageAdded.id,
                      __typename: 'MessageEdge',
                    },
                    ...existingData.conversation.messages.edges,
                  ],
                },
              },
            };
          }
        );
      }
    },
  });

  // Subscribe to typing indicators
  useSubscription<UserTypingSubscription>(TYPING_SUBSCRIPTION, {
    variables: { conversationId },
    skip: !conversationId,
    onData: ({ data }) => {
      if (data.data?.userTyping) {
        const { userId, isTyping } = data.data.userTyping;

        setTypingUsers(prev => {
          if (isTyping) {
            return prev.includes(userId) ? prev : [...prev, userId];
          } else {
            return prev.filter(id => id !== userId);
          }
        });
      }
    },
  });

  const sendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      try {
        // Upload attachments first if any
        const uploadedAttachments: Array<{ fileName: string; fileKey: string; fileSize: number }> =
          [];
        if (attachments && attachments.length > 0) {
          // TODO: Implement file upload for attachments
          // This would use the useFileUpload hook
        }

        await sendMessageMutation({
          variables: {
            input: {
              conversationId,
              content,
              attachments: uploadedAttachments,
            },
          },
        });
      } catch (err) {
        console.error('Failed to send message:', err);
        throw err;
      }
    },
    [conversationId, sendMessageMutation]
  );

  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      try {
        await markReadMutation({
          variables: {
            conversationId,
            messageIds,
          },
        });
      } catch (err) {
        console.error('Failed to mark messages as read:', err);
      }
    },
    [conversationId, markReadMutation]
  );

  const setTyping = useCallback((isTyping: boolean) => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      // Send typing indicator
      // TODO: Implement typing mutation

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        if (setTypingRef.current) {
          setTypingRef.current(false);
        }
      }, 3000);
    } else {
      // Send stop typing indicator
      // TODO: Implement stop typing mutation
    }
  }, []);

  // Set the ref in useEffect to avoid setting it during render
  useEffect(() => {
    setTypingRef.current = setTyping;
  }, [setTyping]);

  const messages =
    conversationData?.conversation?.messages?.edges?.map((edge: { node: Message }) => edge.node) ||
    [];

  return {
    messages,
    sendMessage,
    markAsRead,
    typingUsers,
    setTyping,
    loading: loading || sendLoading,
    error: error || sendError,
  };
}

/**
 * Hook for fetching discussion threads in a course
 *
 * @param courseId - The course ID to fetch threads for
 * @param filter - Optional thread filter criteria
 * @param pagination - Optional pagination parameters
 * @returns Query result with discussion threads
 *
 * @example
 * ```tsx
 * function DiscussionBoard({ courseId }: { courseId: string }) {
 *   const { data, loading, error, fetchMore } = useDiscussionThreads(courseId, {
 *     filter: { isPinned: true },
 *     pagination: { first: 20 }
 *   });
 *
 *   if (loading) return <div>Loading discussions...</div>;
 *   if (error) return <div>Error loading discussions</div>;
 *
 *   return (
 *     <div>
 *       <h2>Course Discussions</h2>
 *       {data?.edges.map(({ node: thread }) => (
 *         <ThreadPreview key={thread.id} thread={thread} />
 *       ))}
 *       {data?.pageInfo.hasNextPage && (
 *         <button onClick={() => fetchMore({ variables: { pagination: { after: data.pageInfo.endCursor } } })}>
 *           Load More
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDiscussionThreads(
  courseId: string,
  filter?: ThreadFilter,
  pagination?: PaginationInput
): QueryResult<ThreadConnection> {
  const { data, loading, error, refetch, fetchMore } = useQuery<GetDiscussionThreadsResponse>(
    GET_DISCUSSION_THREADS,
    {
      variables: { courseId, filter, pagination },
      skip: !courseId,
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    }
  );

  return {
    data: data?.discussionThreads,
    loading,
    error,
    refetch,
    fetchMore,
  };
}

/**
 * Hook for creating a new discussion thread
 *
 * @returns Mutation function for creating threads
 *
 * @example
 * ```tsx
 * function CreateThreadForm({ courseId }: { courseId: string }) {
 *   const { mutate: createThread, loading, error } = useCreateThread();
 *
 *   const handleSubmit = async (formData: { title: string; content: string; lessonId?: string }) => {
 *     try {
 *       const newThread = await createThread({
 *         input: {
 *           courseId,
 *           title: formData.title,
 *           content: formData.content,
 *           lessonId: formData.lessonId,
 *         }
 *       });
 *
 *       // Navigate to the new thread
 *       router.push(`/discussions/${newThread.id}`);
 *     } catch (err) {
 *       console.error('Failed to create thread:', err);
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input placeholder="Thread title..." />
 *       <textarea placeholder="Start the discussion..." />
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Creating...' : 'Create Thread'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateThread(): MutationResult<DiscussionThread, { input: CreateThreadInput }> {
  const [createThreadMutation, { loading, error, reset }] = useMutation<CreateThreadResponse>(
    CREATE_THREAD,
    {
      errorPolicy: 'all',
      // Update cache after successful creation
      update: (cache: ApolloCache, { data }) => {
        if (data?.createDiscussionThread) {
          const courseId = data.createDiscussionThread.course.id;

          // Add to threads list
          cache.updateQuery<GetDiscussionThreadsResponse>(
            { query: GET_DISCUSSION_THREADS, variables: { courseId } },
            (existingData: GetDiscussionThreadsResponse | null) => {
              if (!existingData?.discussionThreads) return existingData;

              return {
                discussionThreads: {
                  ...existingData.discussionThreads,
                  edges: [
                    {
                      node: data.createDiscussionThread,
                      cursor: data.createDiscussionThread.id,
                      __typename: 'ThreadEdge',
                    },
                    ...existingData.discussionThreads.edges,
                  ],
                  totalCount: existingData.discussionThreads.totalCount + 1,
                },
              };
            }
          );
        }
      },
    }
  );

  const mutate = useCallback(
    async (variables: { input: CreateThreadInput }): Promise<DiscussionThread> => {
      const result = await createThreadMutation({ variables });
      if (!result.data?.createDiscussionThread) {
        throw new Error('Failed to create thread');
      }
      return result.data.createDiscussionThread;
    },
    [createThreadMutation]
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for replying to discussion threads
 *
 * @returns Mutation function for creating replies
 *
 * @example
 * ```tsx
 * function ReplyForm({ threadId, parentReplyId }: { threadId: string; parentReplyId?: string }) {
 *   const { mutate: replyToThread, loading, error } = useReplyToThread();
 *
 *   const handleSubmit = async (content: string) => {
 *     try {
 *       const reply = await replyToThread({
 *         input: {
 *           threadId,
 *           content,
 *           parentReplyId,
 *         }
 *       });
 *
 *       console.log('Reply posted:', reply);
 *     } catch (err) {
 *       console.error('Failed to post reply:', err);
 *     }
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <textarea placeholder="Write your reply..." />
 *       <button type="submit" disabled={loading}>
 *         {loading ? 'Posting...' : 'Post Reply'}
 *       </button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useReplyToThread(): MutationResult<DiscussionReply, { input: ReplyToThreadInput }> {
  const [replyToThreadMutation, { loading, error, reset }] = useMutation<ReplyToThreadResponse>(
    REPLY_TO_THREAD,
    {
      errorPolicy: 'all',
      // Update cache after successful reply
      update: (cache: ApolloCache, { data }) => {
        if (data?.replyToThread) {
          const threadId = data.replyToThread.thread.id;

          // Add to thread replies
          cache.updateQuery<GetThreadRepliesResponse>(
            { query: GET_THREAD_REPLIES, variables: { threadId } },
            (existingData: GetThreadRepliesResponse | null) => {
              if (!existingData?.discussionThread?.replies?.edges) return existingData;

              return {
                discussionThread: {
                  ...existingData.discussionThread,
                  replies: {
                    ...existingData.discussionThread.replies,
                    edges: [
                      ...existingData.discussionThread.replies.edges,
                      {
                        node: data.replyToThread,
                        cursor: data.replyToThread.id,
                        __typename: 'ReplyEdge',
                      },
                    ],
                  },
                },
              };
            }
          );

          // Update thread reply count
          const threadCacheId = cache.identify({ __typename: 'DiscussionThread', id: threadId });
          if (threadCacheId) {
            cache.modify({
              id: threadCacheId,
              fields: {
                replyCount: () => data.replyToThread.thread.replyCount,
              },
            });
          }
        }
      },
    }
  );

  const mutate = useCallback(
    async (variables: { input: ReplyToThreadInput }): Promise<DiscussionReply> => {
      const result = await replyToThreadMutation({ variables });
      if (!result.data?.replyToThread) {
        throw new Error('Failed to reply to thread');
      }
      return result.data.replyToThread;
    },
    [replyToThreadMutation]
  );

  return {
    mutate,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for managing course announcements
 *
 * @param courseId - The course ID to manage announcements for
 * @returns Announcement management utilities
 *
 * @example
 * ```tsx
 * function AnnouncementManager({ courseId }: { courseId: string }) {
 *   const {
 *     announcements,
 *     createAnnouncement,
 *     updateAnnouncement,
 *     publishAnnouncement,
 *     deleteAnnouncement,
 *     loading,
 *     error
 *   } = useAnnouncements(courseId);
 *
 *   const handleCreateAnnouncement = async (data: { title: string; content: string; scheduledFor?: Date }) => {
 *     try {
 *       const announcement = await createAnnouncement({
 *         title: data.title,
 *         content: data.content,
 *         scheduledFor: data.scheduledFor?.toISOString(),
 *       });
 *       console.log('Announcement created:', announcement);
 *     } catch (err) {
 *       console.error('Failed to create announcement:', err);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <h2>Course Announcements</h2>
 *       {announcements.map(announcement => (
 *         <AnnouncementCard
 *           key={announcement.id}
 *           announcement={announcement}
 *           onUpdate={(input) => updateAnnouncement(announcement.id, input)}
 *           onPublish={() => publishAnnouncement(announcement.id)}
 *           onDelete={() => deleteAnnouncement(announcement.id)}
 *         />
 *       ))}
 *       <CreateAnnouncementForm onSubmit={handleCreateAnnouncement} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnnouncements(courseId: string): AnnouncementManager {
  const [createAnnouncementMutation, { loading: createLoading, error: createError }] =
    useMutation<CreateAnnouncementResponse>(CREATE_ANNOUNCEMENT);
  const [updateAnnouncementMutation, { loading: updateLoading, error: updateError }] =
    useMutation<UpdateAnnouncementResponse>(UPDATE_ANNOUNCEMENT);
  const [publishAnnouncementMutation, { loading: publishLoading, error: publishError }] =
    useMutation<PublishAnnouncementResponse>(PUBLISH_ANNOUNCEMENT);
  const [deleteAnnouncementMutation, { loading: deleteLoading, error: deleteError }] =
    useMutation<DeleteAnnouncementResponse>(DELETE_ANNOUNCEMENT);

  // Fetch announcements
  const {
    data: announcementsData,
    loading: queryLoading,
    error: queryError,
  } = useQuery<GetAnnouncementsResponse>(GET_ANNOUNCEMENTS, {
    variables: { courseId, pagination: { first: 50 } },
    skip: !courseId,
    errorPolicy: 'all',
  });

  // Subscribe to new announcements
  useSubscription<AnnouncementPublishedSubscription>(ANNOUNCEMENT_SUBSCRIPTION, {
    variables: { courseId },
    skip: !courseId,
    onData: ({ data, client }) => {
      if (data.data?.announcementPublished) {
        // Update cache with new announcement
        client.cache.updateQuery<GetAnnouncementsResponse>(
          { query: GET_ANNOUNCEMENTS, variables: { courseId } },
          (existingData: GetAnnouncementsResponse | null) => {
            if (!existingData?.announcements?.edges) return existingData;

            return {
              announcements: {
                ...existingData.announcements,
                edges: [
                  {
                    node: data.data!.announcementPublished,
                    cursor: data.data!.announcementPublished.id,
                    __typename: 'AnnouncementEdge',
                  },
                  ...existingData.announcements.edges,
                ],
                totalCount: existingData.announcements.totalCount + 1,
              },
            };
          }
        );
      }
    },
  });

  const createAnnouncement = useCallback(
    async (input: AnnouncementInput): Promise<Announcement> => {
      const result = await createAnnouncementMutation({
        variables: { courseId, input },
      });
      if (!result.data?.createAnnouncement) {
        throw new Error('Failed to create announcement');
      }
      return result.data.createAnnouncement;
    },
    [courseId, createAnnouncementMutation]
  );

  const updateAnnouncement = useCallback(
    async (announcementId: string, input: UpdateAnnouncementInput): Promise<Announcement> => {
      const result = await updateAnnouncementMutation({
        variables: { announcementId, input },
      });
      if (!result.data?.updateAnnouncement) {
        throw new Error('Failed to update announcement');
      }
      return result.data.updateAnnouncement;
    },
    [updateAnnouncementMutation]
  );

  const publishAnnouncement = useCallback(
    async (announcementId: string): Promise<Announcement> => {
      const result = await publishAnnouncementMutation({
        variables: { announcementId },
      });
      if (!result.data?.publishAnnouncement) {
        throw new Error('Failed to publish announcement');
      }
      return result.data.publishAnnouncement;
    },
    [publishAnnouncementMutation]
  );

  const deleteAnnouncement = useCallback(
    async (announcementId: string): Promise<boolean> => {
      const result = await deleteAnnouncementMutation({
        variables: { announcementId },
      });
      return result.data?.deleteAnnouncement || false;
    },
    [deleteAnnouncementMutation]
  );

  const announcements =
    announcementsData?.announcements?.edges?.map((edge: { node: Announcement }) => edge.node) || [];
  const loading = queryLoading || createLoading || updateLoading || publishLoading || deleteLoading;
  const error = queryError || createError || updateError || publishError || deleteError;

  return {
    announcements,
    createAnnouncement,
    updateAnnouncement,
    publishAnnouncement,
    deleteAnnouncement,
    loading,
    error,
  };
}

/**
 * Hook for managing user presence in courses
 *
 * @param courseId - The course ID to track presence for
 * @returns Presence management utilities
 *
 * @example
 * ```tsx
 * function CoursePresence({ courseId }: { courseId: string }) {
 *   const { presenceList, updatePresence, loading, error } = usePresenceTracking(courseId);
 *
 *   useEffect(() => {
 *     // Set user as online when component mounts
 *     updatePresence('ONLINE', courseId);
 *
 *     // Set user as offline when component unmounts
 *     return () => {
 *       updatePresence('OFFLINE', courseId);
 *     };
 *   }, [courseId, updatePresence]);
 *
 *   const handleActivityChange = (isActive: boolean) => {
 *     updatePresence(isActive ? 'ONLINE' : 'AWAY', courseId);
 *   };
 *
 *   return (
 *     <div>
 *       <h3>Online Users ({presenceList.filter(p => p.status === 'ONLINE').length})</h3>
 *       {presenceList.map(presence => (
 *         <UserPresenceIndicator
 *           key={presence.userId}
 *           user={presence.user}
 *           status={presence.status}
 *           lastSeen={presence.lastSeen}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePresenceTracking(courseId: string): PresenceManager {
  const [updatePresenceMutation, { loading: mutationLoading, error: mutationError }] =
    useMutation<UpdatePresenceResponse>(UPDATE_PRESENCE);

  // Fetch current presence
  const {
    data: presenceData,
    loading: queryLoading,
    error: queryError,
  } = useQuery<GetCoursePresenceResponse>(GET_COURSE_PRESENCE, {
    variables: { courseId },
    skip: !courseId,
    errorPolicy: 'all',
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Subscribe to presence updates
  useSubscription<UserPresenceSubscription>(PRESENCE_SUBSCRIPTION, {
    variables: { courseId },
    skip: !courseId,
    onData: ({ data, client }) => {
      if (data.data?.userPresence) {
        // Update cache with presence change
        client.cache.updateQuery<GetCoursePresenceResponse>(
          { query: GET_COURSE_PRESENCE, variables: { courseId } },
          (existingData: GetCoursePresenceResponse | null) => {
            if (!existingData?.coursePresence) return existingData;

            const updatedPresence = data.data!.userPresence;
            const existingPresenceList = [...existingData.coursePresence];
            const existingIndex = existingPresenceList.findIndex(
              p => p.userId === updatedPresence.userId
            );

            if (existingIndex >= 0) {
              existingPresenceList[existingIndex] = updatedPresence;
            } else {
              existingPresenceList.push(updatedPresence);
            }

            return {
              coursePresence: existingPresenceList,
            };
          }
        );
      }
    },
  });

  const updatePresence = useCallback(
    async (status: PresenceStatus, targetCourseId?: string): Promise<void> => {
      try {
        await updatePresenceMutation({
          variables: {
            status,
            courseId: targetCourseId || courseId,
          },
        });
      } catch (err) {
        console.error('Failed to update presence:', err);
        throw err;
      }
    },
    [courseId, updatePresenceMutation]
  );

  const presenceList = presenceData?.coursePresence || [];
  const loading = queryLoading || mutationLoading;
  const error = queryError || mutationError;

  return {
    presenceList,
    updatePresence,
    loading,
    error,
  };
}

/**
 * Hook for managing typing indicators in discussion threads
 *
 * @param threadId - The thread ID to track typing for
 * @returns Typing indicator utilities
 *
 * @example
 * ```tsx
 * function ThreadReplyForm({ threadId }: { threadId: string }) {
 *   const { typingUsers, setTyping } = useThreadTyping(threadId);
 *   const [replyContent, setReplyContent] = useState('');
 *
 *   const handleContentChange = (content: string) => {
 *     setReplyContent(content);
 *     setTyping(content.length > 0);
 *   };
 *
 *   const handleBlur = () => {
 *     setTyping(false);
 *   };
 *
 *   return (
 *     <div>
 *       <textarea
 *         value={replyContent}
 *         onChange={(e) => handleContentChange(e.target.value)}
 *         onBlur={handleBlur}
 *         placeholder="Write your reply..."
 *       />
 *       {typingUsers.length > 0 && (
 *         <div className="typing-indicator">
 *           {typingUsers.map(user => user.profile.fullName).join(', ')}
 *           {typingUsers.length === 1 ? ' is' : ' are'} typing...
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useThreadTyping(threadId: string) {
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [startTypingMutation] = useMutation(START_TYPING);
  const [stopTypingMutation] = useMutation(STOP_TYPING);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to typing indicators
  useSubscription<ThreadTypingSubscription>(THREAD_TYPING_SUBSCRIPTION, {
    variables: { threadId },
    skip: !threadId,
    onData: ({ data }) => {
      if (data.data?.typingIndicator) {
        const { user, isTyping } = data.data.typingIndicator;

        setTypingUsers(prev => {
          if (isTyping) {
            return prev.find(u => u.id === user.id) ? prev : [...prev, user];
          } else {
            return prev.filter(u => u.id !== user.id);
          }
        });
      }
    },
  });

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      try {
        if (isTyping) {
          await startTypingMutation({
            variables: { threadId },
          });

          // Auto-stop typing after 3 seconds
          typingTimeoutRef.current = setTimeout(async () => {
            await stopTypingMutation({
              variables: { threadId },
            });
          }, 3000);
        } else {
          await stopTypingMutation({
            variables: { threadId },
          });
        }
      } catch (err) {
        console.error('Failed to update typing status:', err);
      }
    },
    [threadId, startTypingMutation, stopTypingMutation]
  );

  return {
    typingUsers,
    setTyping,
  };
}
