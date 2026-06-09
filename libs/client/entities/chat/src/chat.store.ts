import type { Message as MessageBase } from '@org/common';
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
}

interface ChatActions {
  setActiveChat: (chatId: string | null) => void;
  setActiveMessage: (messageId: string | null) => void;
  setIsTyping: (userId: string, isTyping: boolean) => void;
  setLastReceivedMessage: (msg: Message) => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    activeChatId: null,
    activeMessageId: null,
    typingUsers: {},
    lastReceivedMessage: null,
    setActiveChat: (chatId) => set({ activeChatId: chatId }),
    setActiveMessage: (messageId) => set({ activeMessageId: messageId }),
    setIsTyping: (userId, isTyping) =>
      set((state) => ({
        typingUsers: isTyping
          ? { ...state.typingUsers, [userId]: true }
          : Object.fromEntries(Object.entries(state.typingUsers).filter(([k]) => k !== userId)),
      })),
    setLastReceivedMessage: (msg) => set({ lastReceivedMessage: msg }),
    reset: () =>
      set({
        activeChatId: null,
        activeMessageId: null,
        typingUsers: {},
        lastReceivedMessage: null,
      }),
  })),
);

// Selectors
export const selectActiveChatId = (s: ChatStore) => s.activeChatId;
export const selectActiveMessageId = (s: ChatStore) => s.activeMessageId;
export const selectIsUserTyping = (userId: string) => (s: ChatStore) =>
  s.typingUsers[userId] ?? false;
export const selectAnyTypingInChat = (members: string[]) => (s: ChatStore) =>
  members.some((id) => s.typingUsers[id]);
export const selectLastReceivedMessage = (s: ChatStore) => s.lastReceivedMessage;
