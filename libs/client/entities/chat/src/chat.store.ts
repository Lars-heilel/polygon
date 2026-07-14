import type { Message as MessageBase } from '@org/common';
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

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
  setIsTyping: (userId: string, isTyping: boolean) => void;
  setLastReceivedMessage: (msg: Message) => void;
  incrementUnread: (chatId: string) => void;
  markChatRead: (chatId: string) => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        activeChatId: null,
        activeMessageId: null,
        typingUsers: {},
        lastReceivedMessage: null,
        unreadByChatId: {},
        setActiveChat: (chatId) => set({ activeChatId: chatId }),
        setActiveMessage: (messageId) => set({ activeMessageId: messageId }),
        setIsTyping: (userId, isTyping) =>
          set((state) => ({
            typingUsers: isTyping
              ? { ...state.typingUsers, [userId]: true }
              : Object.fromEntries(Object.entries(state.typingUsers).filter(([k]) => k !== userId)),
          })),
        setLastReceivedMessage: (msg) => set({ lastReceivedMessage: msg }),
        incrementUnread: (chatId) =>
          set((state) => ({
            unreadByChatId: {
              ...state.unreadByChatId,
              [chatId]: (state.unreadByChatId[chatId] ?? 0) + 1,
            },
          })),
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
        reset: () =>
          set({
            activeChatId: null,
            activeMessageId: null,
            typingUsers: {},
            lastReceivedMessage: null,
            unreadByChatId: {},
          }),
      }),
      {
        name: 'chat-unread-state',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ unreadByChatId: state.unreadByChatId }),
      },
    ),
  ),
);

// Selectors
export const selectActiveChatId = (s: ChatStore) => s.activeChatId;
export const selectActiveMessageId = (s: ChatStore) => s.activeMessageId;
export const selectIsUserTyping = (userId: string) => (s: ChatStore) =>
  s.typingUsers[userId] ?? false;
export const selectAnyTypingInChat = (members: string[]) => (s: ChatStore) =>
  members.some((id) => s.typingUsers[id]);
export const selectLastReceivedMessage = (s: ChatStore) => s.lastReceivedMessage;
export const selectUnreadByChatId = (s: ChatStore) => s.unreadByChatId;
