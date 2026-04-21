import { API_ROUTES } from '@org/common';
import type {
  Chat as ChatBase,
  ChatMember as ChatMemberBase,
  Message as MessageBase,
} from '@org/common';
import {
  type InfiniteData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';

import { authedFetch } from '../api/authed-fetch';

export type Message = Omit<MessageBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
};

export type MemberProfile = {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type ChatMember = Omit<ChatMemberBase, 'joinedAt'> & {
  joinedAt: string;
  profile: MemberProfile | null;
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

  getMessages: (chatId: string, cursor?: string) => {
    const url = cursor
      ? `${API_ROUTES.chats.messages(chatId)}?cursor=${cursor}`
      : API_ROUTES.chats.messages(chatId);
    return authedFetch<MessagePage>(url);
  },

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

export function useGetChatsSuspenseQuery() {
  return useSuspenseQuery({
    queryKey: ['chats'],
    queryFn: chatApi.getChats,
  });
}

export function useInfiniteMessagesQuery(chatId: string) {
  return useSuspenseInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => chatApi.getMessages(chatId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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
      const snapshot = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);

      queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
        if (!old) return old;
        const optimistic = {
          id: crypto.randomUUID(),
          chatId,
          senderId: '',
          text,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Message;

        return {
          ...old,
          pages: old.pages.map((page, i) =>
            i === 0 ? { ...page, messages: [...page.messages, optimistic] } : page,
          ),
        };
      });

      return { snapshot };
    },
    onError: (_err, _text, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(['messages', chatId], ctx.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}
