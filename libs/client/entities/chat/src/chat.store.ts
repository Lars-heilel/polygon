import type { Message as MessageBase } from '@org/entities-message';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type Message = Omit<MessageBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

interface ChatState {
  activeChatId: string | null;
  activeMessageId: string | null;
  typingUsers: Record<string, boolean>;
  lastReceivedMessage: Message | null;
  unreadByChatId: Record<string, number>;
}

interface ChatActions {
  setActiveChat: (chatId: string | null) => void;
  setActiveMessage: (messageId: string | null) => void;
  setIsTyping: (userId: string, isTyping: boolean, ttlMs?: number) => void;
  setLastReceivedMessage: (msg: Message) => void;
  /**
   * @deprecated Unread is single-sourced from the server (`chat.unreadCount`).
   * Kept as transient in-memory state only; do not rely on it for rendering.
   */
  incrementUnread: (chatId: string) => void;
  /**
   * @deprecated Unread is single-sourced from the server (`chat.unreadCount`).
   * Kept as transient in-memory state only; do not rely on it for rendering.
   */
  markChatRead: (chatId: string) => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTypingTimer(userId: string): void {
  const existing = typingTimers.get(userId);
  if (existing) {
    clearTimeout(existing);
    typingTimers.delete(userId);
  }
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    activeChatId: null,
    activeMessageId: null,
    typingUsers: {},
    lastReceivedMessage: null,
    unreadByChatId: {},
    setActiveChat: (chatId) => set({ activeChatId: chatId }),
    setActiveMessage: (messageId) => set({ activeMessageId: messageId }),
    setIsTyping: (userId, isTyping, ttlMs = 3000) =>
      set((state) => {
        clearTypingTimer(userId);
        if (isTyping) {
          const timer = setTimeout(() => {
            useChatStore.getState().setIsTyping(userId, false);
          }, ttlMs);
          typingTimers.set(userId, timer);
          return { typingUsers: { ...state.typingUsers, [userId]: true } };
        }
        return {
          typingUsers: Object.fromEntries(
            Object.entries(state.typingUsers).filter(([k]) => k !== userId),
          ),
        };
      }),
    setLastReceivedMessage: (msg) => set({ lastReceivedMessage: msg }),
    /** @deprecated use server unreadCount */
    incrementUnread: (chatId) =>
      set((state) => ({
        unreadByChatId: {
          ...state.unreadByChatId,
          [chatId]: (state.unreadByChatId[chatId] ?? 0) + 1,
        },
      })),
    /** @deprecated use server unreadCount */
    markChatRead: (chatId) =>
      set((state) => {
        if (!(chatId in state.unreadByChatId)) {
          return state;
        }

        return {
          unreadByChatId: Object.fromEntries(
            Object.entries(state.unreadByChatId).filter(([key]) => key !== chatId),
          ),
        };
      }),
    reset: () => {
      for (const userId of Array.from(typingTimers.keys())) {
        clearTypingTimer(userId);
      }
      return set({
        activeChatId: null,
        activeMessageId: null,
        typingUsers: {},
        lastReceivedMessage: null,
        unreadByChatId: {},
      });
    },
  })),
);

// Migration: unread is single-sourced from the server now — drop the legacy
// persisted local counter so a stale `chat-unread-state` entry can never
// override `chat.unreadCount` again.
try {
  localStorage.removeItem('chat-unread-state');
} catch {
  // localStorage may be unavailable (SSR/tests) — nothing to migrate then.
}

// Selectors
export const selectActiveChatId = (s: ChatStore) => s.activeChatId;
export const selectActiveMessageId = (s: ChatStore) => s.activeMessageId;
export const selectIsUserTyping = (userId: string) => (s: ChatStore) =>
  s.typingUsers[userId] ?? false;
export const selectAnyTypingInChat = (members: string[]) => (s: ChatStore) =>
  members.some((id) => s.typingUsers[id]);
export const selectLastReceivedMessage = (s: ChatStore) => s.lastReceivedMessage;
/** @deprecated Unread is single-sourced from the server (`chat.unreadCount`). */
export const selectUnreadByChatId = (s: ChatStore) => s.unreadByChatId;
