import { API_ROUTES } from '@org/common';
import type { Message as MessageBase } from '@org/common';
import {
  type InfiniteData,
  useMutation,
  useSuspenseInfiniteQuery,
  useQueryClient,
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

export const messageApi = {
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

export function useInfiniteMessagesQuery(chatId: string) {
  return useSuspenseInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => messageApi.getMessages(chatId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useSendMessageMutation(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => messageApi.sendMessage(chatId, text),
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
