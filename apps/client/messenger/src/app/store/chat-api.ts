import { API_ROUTES } from '@org/common';
import { api } from './api';

export interface ChatMember {
  userId: string;
  role:   string;
}

export interface Message {
  id:        string;
  chatId:    string;
  senderId:  string;
  text:      string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id:        string;
  type:      'DIRECT' | 'GROUP' | 'CHANNEL';
  name:      string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  members:   ChatMember[];
  messages:  Message[]; // last message only
}

export const chatApi = api.injectEndpoints({
  endpoints: (build) => ({
    getChats: build.query<Chat[], void>({
      query: () => API_ROUTES.chats.root,
      providesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    createDirectChat: build.mutation<Chat, { targetUserId: string }>({
      query: (body) => ({
        url:    API_ROUTES.chats.direct,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Chat', id: 'LIST' }],
    }),

    getMessages: build.query<Message[], string>({
      query: (chatId) => API_ROUTES.chats.messages(chatId),
      providesTags: (_result, _err, chatId) => [{ type: 'Message', id: chatId }],
    }),

    sendMessage: build.mutation<Message, { chatId: string; text: string }>({
      query: ({ chatId, text }) => ({
        url:    API_ROUTES.chats.messages(chatId),
        method: 'POST',
        body:   { text },
      }),
    }),
  }),
});

export const {
  useGetChatsQuery,
  useCreateDirectChatMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
} = chatApi;
