import { API_ROUTES } from '@org/common';
import { authedFetch } from '@org/shared';
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';

import { normalizeMessage, normalizeMessagePage } from './message-normalizer.js';
import type { Message, MessagePage, RawMessage, RawMessagePage } from './message.types.js';

export type { Message, MessagePage, RawMessage, RawMessagePage };

export const messageApi = {
  async getMessages(chatId: string, cursor?: string): Promise<MessagePage> {
    const url = cursor
      ? `${API_ROUTES.chats.messages(chatId)}?cursor=${cursor}`
      : API_ROUTES.chats.messages(chatId);
    const raw = await authedFetch<RawMessagePage>(url);
    return normalizeMessagePage(raw);
  },

  async sendMessage(chatId: string, text: string): Promise<Message> {
    const raw = await authedFetch<RawMessage>(API_ROUTES.chats.messages(chatId), {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return normalizeMessage(raw);
  },
};

export function useInfiniteMessagesQuery(chatId: string) {
  return useSuspenseInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => messageApi.getMessages(chatId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useMessagesQuery(chatId: string) {
  return useSuspenseQuery({
    queryKey: ['messages', chatId],
    queryFn: () => messageApi.getMessages(chatId),
    select: (data) => data.messages,
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
