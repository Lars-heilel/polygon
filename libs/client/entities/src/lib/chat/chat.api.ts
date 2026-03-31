import { API_ROUTES } from '@org/common';
import type {
  Chat as ChatBase,
  ChatMember as ChatMemberBase,
  Message as MessageBase,
} from '@org/common';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authedFetch } from '../api/authed-fetch';

export type Message = Omit<MessageBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type ChatMember = Omit<ChatMemberBase, 'joinedAt'> & {
  joinedAt: string;
};

export type Chat = Omit<ChatBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  members: ChatMember[];
  messages: Message[];
};

export const chatApi = {
  getChats: () => authedFetch<Chat[]>(API_ROUTES.chats.root),

  createDirectChat: (body: { targetUserId: string }) =>
    authedFetch<Chat>(API_ROUTES.chats.direct, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMessages: (chatId: string) => authedFetch<Message[]>(API_ROUTES.chats.messages(chatId)),

  sendMessage: (chatId: string, text: string) =>
    authedFetch<Message>(API_ROUTES.chats.messages(chatId), {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

export function useGetChatsQuery() {
  return useQuery({
    queryKey: ['chats'],
    queryFn: chatApi.getChats,
  });
}

export function useGetMessagesQuery(chatId: string) {
  return useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => chatApi.getMessages(chatId),
    enabled: chatId.length > 0,
  });
}

export function useCreateDirectChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.createDirectChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useSendMessageMutation(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(chatId, text),
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ['messages', chatId] });
      const snapshot = queryClient.getQueryData<Message[]>(['messages', chatId]);
      queryClient.setQueryData<Message[]>(['messages', chatId], (old = []) => [
        ...old,
        {
          id: crypto.randomUUID(),
          chatId,
          text,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Message,
      ]);
      return { snapshot };
    },
    onError: (_err, _text, ctx) => {
      queryClient.setQueryData(['messages', chatId], ctx?.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}
