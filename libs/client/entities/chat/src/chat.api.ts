import { API_ROUTES } from '@org/common';
import type {
  Chat as ChatBase,
  ChatMember as ChatMemberBase,
} from '@org/common';
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';

import { authedFetch } from '@org/shared';
import type { Message } from '@org/entities-message';

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
