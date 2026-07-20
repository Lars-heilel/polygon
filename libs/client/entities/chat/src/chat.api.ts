import { API_ROUTES } from '@org/common';
import type { Chat as ChatBase, ChatMember as ChatMemberBase } from '@org/common';
import type { Message as MessageBase } from '@org/common';
import { authedFetch } from '@org/shared';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';

export type Message = Omit<MessageBase, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
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
  lastMessage: Message | null;
  unreadCount: number;
};

export const chatApi = {
  getChats: () => authedFetch<Chat[]>(API_ROUTES.chats.root),

  createDirectChat: (body: { targetUserId: string }) =>
    authedFetch<Chat>(API_ROUTES.chats.direct, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createSelfChat: () =>
    authedFetch<Chat>(API_ROUTES.chats.self, {
      method: 'POST',
    }),

  markRead: (chatId: string, body: { messageId?: string | null } = {}) =>
    authedFetch(API_ROUTES.chats.read(chatId), {
      method: 'POST',
      body: JSON.stringify(body),
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

export function useCreateDirectChatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.createDirectChat,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
