import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { Message } from '@org/entities-message';

interface ChatState {
  activeChatId: string | null;
  activeMessageId: string | null;
  isTyping: boolean;
  lastReceivedMessage: Message | null;
}

interface ChatActions {
  setActiveChat: (chatId: string | null) => void;
  setActiveMessage: (messageId: string | null) => void;
  setIsTyping: (isTyping: boolean) => void;
  setLastReceivedMessage: (msg: Message) => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    activeChatId: null,
    activeMessageId: null,
    isTyping: false,
    lastReceivedMessage: null,
    setActiveChat: (chatId) => set({ activeChatId: chatId }),
    setActiveMessage: (messageId) => set({ activeMessageId: messageId }),
    setIsTyping: (isTyping) => set({ isTyping }),
    setLastReceivedMessage: (msg) => set({ lastReceivedMessage: msg }),
    reset: () =>
      set({
        activeChatId: null,
        activeMessageId: null,
        isTyping: false,
        lastReceivedMessage: null,
      }),
  })),
);

// Selectors
export const selectActiveChatId = (s: ChatStore) => s.activeChatId;
export const selectActiveMessageId = (s: ChatStore) => s.activeMessageId;
export const selectIsTyping = (s: ChatStore) => s.isTyping;
export const selectLastReceivedMessage = (s: ChatStore) => s.lastReceivedMessage;
