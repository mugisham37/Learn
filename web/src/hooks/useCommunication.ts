/**
 * Communication Hooks
 * 
 * React hooks for communication-related operations including messaging,
 * discussions, announcements, and real-time chat functionality.
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';
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
} from '../types';

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

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
  fetchMore?: (options: Record<string, unknown>) => Promise<unknown>;
}

interface MutationResult<T> {
  mutate: (variables: Record<string, unknown>) => Promise<T>;
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
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_CONVERSATIONS, {
    variables: { filter, pagination },
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    pollInterval: 30000, // Poll every 30 seconds for new conversations
  });

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
  const [sendMessageMutation, { loading: sendLoading, error: sendError }] = useMutation(SEND_MESSAGE);
  const [markReadMutation] = useMutation(MARK_MESSAGES_READ);
  const setTypingRef = useRef<((isTyping: boolean) => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch conversation messages
  const { data: conversationData, loading, error } = useQuery(GET_CONVERSATION_MESSAGES, {
    variables: { conversationId, pagination: { first: 50 } },
    skip: !conversationId,
    errorPolicy: 'all',
  });

  // Subscribe to new messages
  useSubscription(MESSAGE_SUBSCRIPTION, {
    variables: { conversationId },
    skip: !conversationId,
    onData: ({ subscriptionData, client }) => {
      if (subscriptionData.data?.messageAdded) {
        // Update cache with new message
        client.cache.updateQuery(
          { query: GET_CONVERSATION_MESSAGES, variables: { conversationId } },
          (existingData: { conversation?: { messages?: { edges?: Array<{ node: Message; cursor: string }> } } }) => {
            if (!existingData?.conversation?.messages) return existingData;
            
            return {
              conversation: {
                ...existingData.conversation,
                messages: {
                  ...existingData.conversation.messages,
                  edges: [
                    {
                      node: subscriptionData.data.messageAdded,
                      cursor: subscriptionData.data.messageAdded.id,
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
  useSubscription(TYPING_SUBSCRIPTION, {
    variables: { conversationId },
    skip: !conversationId,
    onData: ({ subscriptionData }) => {
      if (subscriptionData.data?.userTyping) {
        const { userId, isTyping } = subscriptionData.data.userTyping;
        
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

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    try {
      // Upload attachments first if any
      const uploadedAttachments: Array<{ fileName: string; fileKey: string; fileSize: number }> = [];
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
        optimisticResponse: {
          sendMessage: {
            __typename: 'Message',
            id: `temp-${Date.now()}`,
            content,
            sender: {
              __typename: 'User',
              id: 'current-user', // Would be replaced with actual user ID
              profile: {
                __typename: 'UserProfile',
                fullName: 'You',
                avatarUrl: null,
              },
            },
            conversation: {
              __typename: 'Conversation',
              id: conversationId,
              updatedAt: new Date().toISOString(),
            },
            sentAt: new Date().toISOString(),
            attachments: [],
          },
        },
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, [conversationId, sendMessageMutation]);

  const markAsRead = useCallback(async (messageIds: string[]) => {
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
  }, [conversationId, markReadMutation]);
  
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

  const messages = conversationData?.conversation?.messages?.edges?.map((edge: { node: Message }) => edge.node) || [];

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
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_DISCUSSION_THREADS, {
    variables: { courseId, filter, pagination },
    skip: !courseId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

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
export function useCreateThread(): MutationResult<DiscussionThread> {
  const [createThreadMutation, { loading, error, reset }] = useMutation(CREATE_THREAD, {
    errorPolicy: 'all',
    // Update cache after successful creation
    update: (cache, { data }) => {
      if (data?.createDiscussionThread) {
        const courseId = data.createDiscussionThread.course.id;
        
        // Add to threads list
        cache.updateQuery(
          { query: GET_DISCUSSION_THREADS, variables: { courseId } },
          (existingData: { discussionThreads?: ThreadConnection }) => {
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
  });

  const mutate = useCallback(async (variables: { input: CreateThreadInput }) => {
    const result = await createThreadMutation({ variables });
    return result.data?.createDiscussionThread;
  }, [createThreadMutation]);

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
export function useReplyToThread(): MutationResult<DiscussionReply> {
  const [replyToThreadMutation, { loading, error, reset }] = useMutation(REPLY_TO_THREAD, {
    errorPolicy: 'all',
    // Update cache after successful reply
    update: (cache, { data }) => {
      if (data?.replyToThread) {
        const threadId = data.replyToThread.thread.id;
        
        // Add to thread replies
        cache.updateQuery(
          { query: GET_THREAD_REPLIES, variables: { threadId } },
          (existingData: { discussionThread?: { replies?: { edges?: Array<{ node: DiscussionReply; cursor: string }> } } }) => {
            if (!existingData?.discussionThread?.replies) return existingData;
            
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
        cache.modify({
          id: cache.identify({ __typename: 'DiscussionThread', id: threadId }),
          fields: {
            replyCount: () => data.replyToThread.thread.replyCount,
          },
        });
      }
    },
  });

  const mutate = useCallback(async (variables: { input: ReplyToThreadInput }) => {
    const result = await replyToThreadMutation({ variables });
    return result.data?.replyToThread;
  }, [replyToThreadMutation]);

  return {
    mutate,
    loading,
    error,
    reset,
  };
}