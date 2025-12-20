/**
 * Chat and Messaging State Management
 * 
 * Provides comprehensive state management for chat and messaging with:
 * - Conversation state management with real-time updates
 * - Message composition state with draft saving
 * - Typing indicators and presence management
 * - Message history and pagination state
 * 
 * Requirements: 10.4
 */

import { useCallback, useReducer, useEffect, useRef } from 'react';
import { User } from '../../types/entities';

// Message Types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: User;
  content: string;
  type: 'text' | 'file' | 'image' | 'system';
  timestamp: Date;
  editedAt?: Date;
  replyTo?: string;
  reactions: MessageReaction[];
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
  };
}

export interface MessageReaction {
  emoji: string;
  users: User[];
  count: number;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'course' | 'support';
  name?: string;
  description?: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isArchived: boolean;
  isMuted: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    courseId?: string;
    groupId?: string;
  };
}

export interface MessageDraft {
  conversationId: string;
  content: string;
  replyTo?: string;
  files?: File[];
  lastUpdated: Date;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  user: User;
  timestamp: Date;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  isTyping: boolean;
}

export interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  
  // Messages
  messagesByConversation: Record<string, Message[]>;
  isLoadingMessages: boolean;
  hasMoreMessages: Record<string, boolean>;
  
  // Drafts
  drafts: Record<string, MessageDraft>;
  
  // Typing indicators
  typingIndicators: TypingIndicator[];
  
  // User presence
  userPresence: Record<string, UserPresence>;
  
  // UI state
  isConversationListVisible: boolean;
  searchQuery: string;
  filteredConversations: Conversation[];
  
  // Real-time connection
  isConnected: boolean;
  connectionError: string | null;
  
  // Message composition
  isComposing: boolean;
  composingConversationId: string | null;
  replyingToMessage: Message | null;
  
  // File uploads
  uploadingFiles: Record<string, { file: File; progress: number; status: 'uploading' | 'completed' | 'failed' }>;
}

export interface ChatActions {
  // Conversation operations
  loadConversations: () => Promise<void>;
  createConversation: (participants: User[], type: Conversation['type'], metadata?: Record<string, unknown>) => Promise<string>;
  archiveConversation: (conversationId: string) => void;
  muteConversation: (conversationId: string, muted: boolean) => void;
  setActiveConversation: (conversationId: string | null) => void;
  markConversationAsRead: (conversationId: string) => void;
  
  // Message operations
  loadMessages: (conversationId: string, before?: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, replyTo?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  
  // Draft operations
  saveDraft: (conversationId: string, content: string, replyTo?: string) => void;
  loadDraft: (conversationId: string) => MessageDraft | null;
  clearDraft: (conversationId: string) => void;
  
  // Typing indicators
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  
  // File operations
  uploadFile: (conversationId: string, file: File) => Promise<void>;
  cancelFileUpload: (conversationId: string, fileName: string) => void;
  
  // Search and filtering
  searchConversations: (query: string) => void;
  filterConversations: (filter: 'all' | 'unread' | 'archived' | 'muted') => void;
  
  // UI operations
  toggleConversationList: () => void;
  setReplyingTo: (message: Message | null) => void;
  
  // Real-time operations
  handleIncomingMessage: (message: Message) => void;
  handleTypingIndicator: (indicator: TypingIndicator) => void;
  handleUserPresenceUpdate: (presence: UserPresence) => void;
  handleConnectionStatusChange: (connected: boolean, error?: string) => void;
}

// Action Types
type ChatAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: { conversationId: string; messages: Message[]; hasMore: boolean } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SAVE_DRAFT'; payload: MessageDraft }
  | { type: 'CLEAR_DRAFT'; payload: string }
  | { type: 'SET_TYPING_INDICATORS'; payload: TypingIndicator[] }
  | { type: 'ADD_TYPING_INDICATOR'; payload: TypingIndicator }
  | { type: 'REMOVE_TYPING_INDICATOR'; payload: { conversationId: string; userId: string } }
  | { type: 'SET_USER_PRESENCE'; payload: UserPresence }
  | { type: 'SET_CONNECTION_STATUS'; payload: { connected: boolean; error?: string } }
  | { type: 'SET_CONVERSATION_LIST_VISIBLE'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTERED_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_REPLYING_TO'; payload: Message | null }
  | { type: 'SET_UPLOADING_FILE'; payload: { conversationId: string; fileName: string; file: File; progress: number; status: 'uploading' | 'completed' | 'failed' } }
  | { type: 'REMOVE_UPLOADING_FILE'; payload: { conversationId: string; fileName: string } };

// Initial State
const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  isLoadingMessages: false,
  hasMoreMessages: {},
  drafts: {},
  typingIndicators: [],
  userPresence: {},
  isConversationListVisible: true,
  searchQuery: '',
  filteredConversations: [],
  isConnected: false,
  connectionError: null,
  isComposing: false,
  composingConversationId: null,
  replyingToMessage: null,
  uploadingFiles: {},
};

// Utility Functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function sortConversationsByLastMessage(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessage?.timestamp || a.updatedAt;
    const bTime = b.lastMessage?.timestamp || b.updatedAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

function filterConversations(conversations: Conversation[], query: string): Conversation[] {
  if (!query.trim()) return conversations;
  
  const lowerQuery = query.toLowerCase();
  return conversations.filter(conversation => 
    conversation.name?.toLowerCase().includes(lowerQuery) ||
    conversation.participants.some(participant => 
      participant.profile?.fullName?.toLowerCase().includes(lowerQuery) ||
      participant.email.toLowerCase().includes(lowerQuery)
    ) ||
    conversation.lastMessage?.content.toLowerCase().includes(lowerQuery)
  );
}

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      const sortedConversations = sortConversationsByLastMessage(action.payload);
      return {
        ...state,
        conversations: sortedConversations,
        filteredConversations: filterConversations(sortedConversations, state.searchQuery),
      };

    case 'ADD_CONVERSATION':
      const newConversations = [action.payload, ...state.conversations];
      const sortedNew = sortConversationsByLastMessage(newConversations);
      return {
        ...state,
        conversations: sortedNew,
        filteredConversations: filterConversations(sortedNew, state.searchQuery),
      };

    case 'UPDATE_CONVERSATION':
      const updatedConversations = state.conversations.map(conv =>
        conv.id === action.payload.id
          ? { ...conv, ...action.payload.updates }
          : conv
      );
      const sortedUpdated = sortConversationsByLastMessage(updatedConversations);
      return {
        ...state,
        conversations: sortedUpdated,
        filteredConversations: filterConversations(sortedUpdated, state.searchQuery),
      };

    case 'SET_ACTIVE_CONVERSATION':
      return {
        ...state,
        activeConversationId: action.payload,
        replyingToMessage: null, // Clear reply when switching conversations
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [action.payload.conversationId]: action.payload.messages,
        },
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [action.payload.conversationId]: action.payload.hasMore,
        },
        isLoadingMessages: false,
      };

    case 'ADD_MESSAGE':
      const conversationId = action.payload.conversationId;
      const existingMessages = state.messagesByConversation[conversationId] || [];
      const newMessages = [...existingMessages, action.payload].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
        const conversationsWithNewMessage = state.conversations.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessage: action.payload,
            unreadCount: conv.id === state.activeConversationId ? 0 : conv.unreadCount + 1,
            updatedAt: action.payload.timestamp,
          };
        }
        return conv;
      });
      
      const sortedWithMessage = sortConversationsByLastMessage(conversationsWithNewMessage);
      
      return {
        ...state,
        conversations: sortedWithMessage,
        filteredConversations: filterConversations(sortedWithMessage, state.searchQuery),
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: newMessages,
        },
      };

    case 'UPDATE_MESSAGE':
      const updatedMessagesByConv = { ...state.messagesByConversation };
      
      Object.keys(updatedMessagesByConv).forEach(convId => {
        const messages = updatedMessagesByConv[convId];
        if (messages) {
          updatedMessagesByConv[convId] = messages.map(message =>
            message.id === action.payload.id
              ? { ...message, ...action.payload.updates }
              : message
          );
        }
      });
      
      return {
        ...state,
        messagesByConversation: updatedMessagesByConv,
      };

    case 'DELETE_MESSAGE':
      const filteredMessagesByConv = { ...state.messagesByConversation };
      
      Object.keys(filteredMessagesByConv).forEach(convId => {
        const messages = filteredMessagesByConv[convId];
        if (messages) {
          filteredMessagesByConv[convId] = messages.filter(
            message => message.id !== action.payload
          );
        }
      });
      
      return {
        ...state,
        messagesByConversation: filteredMessagesByConv,
      };

    case 'SET_LOADING_MESSAGES':
      return {
        ...state,
        isLoadingMessages: action.payload,
      };

    case 'SAVE_DRAFT':
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.payload.conversationId]: action.payload,
        },
      };

    case 'CLEAR_DRAFT':
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.payload]: _removedDraft, ...remainingDrafts } = state.drafts;
      return {
        ...state,
        drafts: remainingDrafts,
      };

    case 'SET_TYPING_INDICATORS':
      return {
        ...state,
        typingIndicators: action.payload,
      };

    case 'ADD_TYPING_INDICATOR':
      const existingIndicators = state.typingIndicators.filter(
        indicator => !(indicator.conversationId === action.payload.conversationId && 
                     indicator.userId === action.payload.userId)
      );
      return {
        ...state,
        typingIndicators: [...existingIndicators, action.payload],
      };

    case 'REMOVE_TYPING_INDICATOR':
      return {
        ...state,
        typingIndicators: state.typingIndicators.filter(
          indicator => !(indicator.conversationId === action.payload.conversationId && 
                        indicator.userId === action.payload.userId)
        ),
      };

    case 'SET_USER_PRESENCE':
      return {
        ...state,
        userPresence: {
          ...state.userPresence,
          [action.payload.userId]: action.payload,
        },
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.connected,
        connectionError: action.payload.error || null,
      };

    case 'SET_CONVERSATION_LIST_VISIBLE':
      return {
        ...state,
        isConversationListVisible: action.payload,
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
        filteredConversations: filterConversations(state.conversations, action.payload),
      };

    case 'SET_FILTERED_CONVERSATIONS':
      return {
        ...state,
        filteredConversations: action.payload,
      };

    case 'SET_REPLYING_TO':
      return {
        ...state,
        replyingToMessage: action.payload,
      };

    case 'SET_UPLOADING_FILE':
      return {
        ...state,
        uploadingFiles: {
          ...state.uploadingFiles,
          [`${action.payload.conversationId}-${action.payload.fileName}`]: {
            file: action.payload.file,
            progress: action.payload.progress,
            status: action.payload.status,
          },
        },
      };

    case 'REMOVE_UPLOADING_FILE':
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [`${action.payload.conversationId}-${action.payload.fileName}`]: _removedFile, ...remainingFiles } = state.uploadingFiles;
      return {
        ...state,
        uploadingFiles: remainingFiles,
      };

    default:
      return state;
  }
}

// Custom Hook
export function useChat(): [ChatState, ChatActions] {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load drafts from localStorage on mount
  useEffect(() => {
    const savedDrafts = localStorage.getItem('chat-drafts');
    if (savedDrafts) {
      try {
        const drafts = JSON.parse(savedDrafts);
        Object.entries(drafts).forEach(([, draft]) => {
          const typedDraft = draft as MessageDraft & { lastUpdated: string };
          dispatch({ type: 'SAVE_DRAFT', payload: {
            ...typedDraft,
            lastUpdated: new Date(typedDraft.lastUpdated),
          }});
        });
      } catch (error) {
        console.error('Failed to load chat drafts:', error);
      }
    }
  }, []);

  // Save drafts to localStorage
  useEffect(() => {
    if (Object.keys(state.drafts).length > 0) {
      localStorage.setItem('chat-drafts', JSON.stringify(state.drafts));
    }
  }, [state.drafts]);

  // Clean up old typing indicators
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date();
      const validIndicators = state.typingIndicators.filter(
        indicator => now.getTime() - indicator.timestamp.getTime() < 10000 // 10 seconds
      );
      
      if (validIndicators.length !== state.typingIndicators.length) {
        dispatch({ type: 'SET_TYPING_INDICATORS', payload: validIndicators });
      }
    }, 5000);

    return () => clearInterval(cleanup);
  }, [state.typingIndicators]);

  // Actions
  const actions: ChatActions = {
    loadConversations: useCallback(async () => {
      try {
        // In a real implementation, this would call the GraphQL query
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Mock conversations
        const mockConversations: Conversation[] = [
          {
            id: 'conv-1',
            type: 'direct',
            participants: [],
            unreadCount: 2,
            isArchived: false,
            isMuted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
        
        dispatch({ type: 'SET_CONVERSATIONS', payload: mockConversations });
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    }, []),

    createConversation: useCallback(async (participants: User[], type: Conversation['type'], metadata?: Record<string, unknown>) => {
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        const newConversation: Conversation = {
          id: generateId(),
          type,
          participants,
          unreadCount: 0,
          isArchived: false,
          isMuted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(metadata && { metadata }),
        };
        
        dispatch({ type: 'ADD_CONVERSATION', payload: newConversation });
        return newConversation.id;
      } catch (error) {
        console.error('Failed to create conversation:', error);
        throw error;
      }
    }, []),

    archiveConversation: useCallback((conversationId: string) => {
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { 
        id: conversationId, 
        updates: { isArchived: true } 
      }});
    }, []),

    muteConversation: useCallback((conversationId: string, muted: boolean) => {
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { 
        id: conversationId, 
        updates: { isMuted: muted } 
      }});
    }, []),

    setActiveConversation: useCallback((conversationId: string | null) => {
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conversationId });
      
      // Mark as read when opening conversation
      if (conversationId) {
        dispatch({ type: 'UPDATE_CONVERSATION', payload: { 
          id: conversationId, 
          updates: { unreadCount: 0 } 
        }});
      }
    }, []),

    markConversationAsRead: useCallback((conversationId: string) => {
      dispatch({ type: 'UPDATE_CONVERSATION', payload: { 
        id: conversationId, 
        updates: { unreadCount: 0 } 
      }});
    }, []),

    loadMessages: useCallback(async (conversationId: string) => {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
      
      try {
        // In a real implementation, this would call the GraphQL query
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Mock messages
        const mockMessages: Message[] = [
          {
            id: 'msg-1',
            conversationId,
            senderId: 'user-1',
            sender: {} as User,
            content: 'Hello there!',
            type: 'text',
            timestamp: new Date(),
            reactions: [],
            status: 'read',
          },
        ];
        
        dispatch({ type: 'SET_MESSAGES', payload: { 
          conversationId, 
          messages: mockMessages, 
          hasMore: false 
        }});
      } catch (error) {
        console.error('Failed to load messages:', error);
        dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
      }
    }, []),

    sendMessage: useCallback(async (conversationId: string, content: string, replyTo?: string) => {
      const tempId = `temp-${generateId()}`;
      
      // Add optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        conversationId,
        senderId: 'current-user', // Would come from auth context
        sender: {} as User,
        content,
        type: 'text',
        timestamp: new Date(),
        reactions: [],
        status: 'sending',
        ...(replyTo && { replyTo }),
      };
      
      dispatch({ type: 'ADD_MESSAGE', payload: optimisticMessage });
      
      // Clear draft
      dispatch({ type: 'CLEAR_DRAFT', payload: conversationId });
      
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Update message status
        dispatch({ type: 'UPDATE_MESSAGE', payload: { 
          id: tempId, 
          updates: { status: 'sent' } 
        }});
      } catch (error) {
        dispatch({ type: 'UPDATE_MESSAGE', payload: { 
          id: tempId, 
          updates: { status: 'failed' } 
        }});
        console.error('Failed to send message:', error);
      }
    }, []),

    editMessage: useCallback(async (messageId: string, content: string) => {
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        dispatch({ type: 'UPDATE_MESSAGE', payload: { 
          id: messageId, 
          updates: { content, editedAt: new Date() } 
        }});
      } catch (error) {
        console.error('Failed to edit message:', error);
      }
    }, []),

    deleteMessage: useCallback(async (messageId: string) => {
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        dispatch({ type: 'DELETE_MESSAGE', payload: messageId });
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }, []),

    addReaction: useCallback(async (messageId: string, emoji: string) => {
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
        
        // This would be handled by the real-time subscription in practice
        console.log(`Added reaction ${emoji} to message ${messageId}`);
      } catch (error) {
        console.error('Failed to add reaction:', error);
      }
    }, []),

    removeReaction: useCallback(async (messageId: string, emoji: string) => {
      try {
        // In a real implementation, this would call the GraphQL mutation
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
        
        // This would be handled by the real-time subscription in practice
        console.log(`Removed reaction ${emoji} from message ${messageId}`);
      } catch (error) {
        console.error('Failed to remove reaction:', error);
      }
    }, []),

    saveDraft: useCallback((conversationId: string, content: string, replyTo?: string) => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
      
      draftSaveTimeoutRef.current = setTimeout(() => {
        const draft: MessageDraft = {
          conversationId,
          content,
          lastUpdated: new Date(),
          ...(replyTo && { replyTo }),
        };
        
        dispatch({ type: 'SAVE_DRAFT', payload: draft });
      }, 1000); // Debounce draft saving
    }, []),

    loadDraft: useCallback((conversationId: string) => {
      return state.drafts[conversationId] || null;
    }, [state.drafts]),

    clearDraft: useCallback((conversationId: string) => {
      dispatch({ type: 'CLEAR_DRAFT', payload: conversationId });
    }, []),

    startTyping: useCallback((conversationId: string) => {
      // In a real implementation, this would send a typing indicator via WebSocket
      console.log(`Started typing in conversation ${conversationId}`);
      
      // Clear existing timeout for this conversation
      if (typingTimeoutRef.current[conversationId]) {
        clearTimeout(typingTimeoutRef.current[conversationId]);
      }
      
      // Set timeout to stop typing after 5 seconds of inactivity
      typingTimeoutRef.current[conversationId] = setTimeout(() => {
        // In a real implementation, this would send a stop typing indicator via WebSocket
        console.log(`Stopped typing in conversation ${conversationId}`);
        
        if (typingTimeoutRef.current[conversationId]) {
          clearTimeout(typingTimeoutRef.current[conversationId]);
          delete typingTimeoutRef.current[conversationId];
        }
      }, 5000);
    }, []),

    stopTyping: useCallback((conversationId: string) => {
      // In a real implementation, this would send a stop typing indicator via WebSocket
      console.log(`Stopped typing in conversation ${conversationId}`);
      
      if (typingTimeoutRef.current[conversationId]) {
        clearTimeout(typingTimeoutRef.current[conversationId]);
        delete typingTimeoutRef.current[conversationId];
      }
    }, []),

    uploadFile: useCallback(async (conversationId: string, file: File) => {
      const fileName = file.name;
      
      // Start upload tracking
      dispatch({ type: 'SET_UPLOADING_FILE', payload: { 
        conversationId, 
        fileName, 
        file, 
        progress: 0, 
        status: 'uploading' 
      }});
      
      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          dispatch({ type: 'SET_UPLOADING_FILE', payload: { 
            conversationId, 
            fileName, 
            file, 
            progress, 
            status: 'uploading' 
          }});
        }
        
        // Mark as completed
        dispatch({ type: 'SET_UPLOADING_FILE', payload: { 
          conversationId, 
          fileName, 
          file, 
          progress: 100, 
          status: 'completed' 
        }});
        
        // Send file message
        const fileMessage: Message = {
          id: generateId(),
          conversationId,
          senderId: 'current-user',
          sender: {} as User,
          content: `Shared file: ${fileName}`,
          type: 'file',
          timestamp: new Date(),
          reactions: [],
          status: 'sent',
          metadata: {
            fileName,
            fileSize: file.size,
            fileUrl: 'https://example.com/file-url',
          },
        };
        
        dispatch({ type: 'ADD_MESSAGE', payload: fileMessage });
        
        // Clean up upload tracking
        setTimeout(() => {
          dispatch({ type: 'REMOVE_UPLOADING_FILE', payload: { conversationId, fileName } });
        }, 2000);
        
      } catch (error) {
        dispatch({ type: 'SET_UPLOADING_FILE', payload: { 
          conversationId, 
          fileName, 
          file, 
          progress: 0, 
          status: 'failed' 
        }});
        console.error('Failed to upload file:', error);
      }
    }, []),

    cancelFileUpload: useCallback((conversationId: string, fileName: string) => {
      dispatch({ type: 'REMOVE_UPLOADING_FILE', payload: { conversationId, fileName } });
    }, []),

    searchConversations: useCallback((query: string) => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
    }, []),

    filterConversations: useCallback((filter: 'all' | 'unread' | 'archived' | 'muted') => {
      let filtered = state.conversations;
      
      switch (filter) {
        case 'unread':
          filtered = state.conversations.filter(conv => conv.unreadCount > 0);
          break;
        case 'archived':
          filtered = state.conversations.filter(conv => conv.isArchived);
          break;
        case 'muted':
          filtered = state.conversations.filter(conv => conv.isMuted);
          break;
        default:
          filtered = state.conversations.filter(conv => !conv.isArchived);
      }
      
      dispatch({ type: 'SET_FILTERED_CONVERSATIONS', payload: filtered });
    }, [state.conversations]),

    toggleConversationList: useCallback(() => {
      dispatch({ type: 'SET_CONVERSATION_LIST_VISIBLE', payload: !state.isConversationListVisible });
    }, [state.isConversationListVisible]),

    setReplyingTo: useCallback((message: Message | null) => {
      dispatch({ type: 'SET_REPLYING_TO', payload: message });
    }, []),

    // Real-time event handlers
    handleIncomingMessage: useCallback((message: Message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
    }, []),

    handleTypingIndicator: useCallback((indicator: TypingIndicator) => {
      dispatch({ type: 'ADD_TYPING_INDICATOR', payload: indicator });
    }, []),

    handleUserPresenceUpdate: useCallback((presence: UserPresence) => {
      dispatch({ type: 'SET_USER_PRESENCE', payload: presence });
    }, []),

    handleConnectionStatusChange: useCallback((connected: boolean, error?: string) => {
      dispatch({ 
        type: 'SET_CONNECTION_STATUS', 
        payload: { 
          connected, 
          ...(error !== undefined && { error })
        } 
      });
    }, []),
  };

  // Cleanup on unmount
  useEffect(() => {
    const typingTimeouts = typingTimeoutRef.current;
    const draftSaveTimeout = draftSaveTimeoutRef.current;
    
    return () => {
      Object.values(typingTimeouts).forEach(timeout => clearTimeout(timeout));
      if (draftSaveTimeout) {
        clearTimeout(draftSaveTimeout);
      }
    };
  }, []);

  return [state, actions];
}

// Utility functions for external use
export function getConversationDisplayName(conversation: Conversation, currentUserId: string): string {
  if (conversation.name) {
    return conversation.name;
  }
  
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find(p => p.id !== currentUserId);
    return otherParticipant?.profile?.fullName || otherParticipant?.email || 'Unknown User';
  }
  
  return `${conversation.type} conversation`;
}

export function getUnreadMessageCount(conversations: Conversation[]): number {
  return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
}

export function formatMessageTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h ago`;
  } else {
    return timestamp.toLocaleDateString();
  }
}