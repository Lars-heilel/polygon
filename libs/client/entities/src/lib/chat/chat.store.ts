import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Message, Chat } from './chat.api';

interface ChatState {
  activeChatId: string | null;
  activeMessageId: string | null;
  isTyping: boolean;
}

interface ChatActions {
  setActiveChat: (chatId: string | null) => void;
  setActiveMessage: (messageId: string | null) => void;
  setIsTyping: (isTyping: boolean) => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    activeChatId: null,
    activeMessageId: null,
    isTyping: false,
    setActiveChat: (chatId) => set({ activeChatId: chatId }),
    setActiveMessage: (messageId) => set({ activeMessageId: messageId }),
    setIsTyping: (isTyping) => set({ isTyping }),
    reset: () =>
      set({
        activeChatId: null,
        activeMessageId: null,
        isTyping: false,
      }),
  }))
);

// Selectors
export const selectActiveChatId = (s: ChatStore) => s.activeChatId;
export const selectActiveMessageId = (s: ChatStore) => s.activeMessageId;
export const selectIsTyping = (s: ChatStore) => s.isTyping;
