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
import { removeMessageFromPages, updateMessageInPages } from './message-cache.js';
import type { Message, MessagePage, RawMessage, RawMessagePage } from './message.types.js';

export type { Message, MessagePage, RawMessage, RawMessagePage };

export type DeleteMessageMode = 'ME' | 'EVERYONE';
export interface ForwardMessagesInput {
  sourceChatId: string;
  messageIds: string[];
}

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

  async editMessage(chatId: string, messageId: string, text: string): Promise<Message> {
    const raw = await authedFetch<RawMessage>(API_ROUTES.chats.message(chatId, messageId), {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
    return normalizeMessage(raw);
  },

  async deleteMessage(
    chatId: string,
    messageId: string,
    mode: DeleteMessageMode,
  ): Promise<{ id: string; chatId: string }> {
    return authedFetch<{ id: string; chatId: string }>(API_ROUTES.chats.message(chatId, messageId), {
      method: 'DELETE',
      body: JSON.stringify({ mode }),
    });
  },

  async forwardMessages(targetChatId: string, input: ForwardMessagesInput): Promise<Message[]> {
    const raw = await authedFetch<RawMessage[]>(API_ROUTES.chats.forward(targetChatId), {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return raw.map(normalizeMessage);
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

export function useEditMessageMutation(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      messageApi.editMessage(chatId, messageId, text),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) =>
        updateMessageInPages(old, message),
      );
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useDeleteMessageMutation(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, mode }: { messageId: string; mode: DeleteMessageMode }) =>
      messageApi.deleteMessage(chatId, messageId, mode),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) =>
        removeMessageFromPages(old, id),
      );
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useForwardMessagesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetChatId, input }: { targetChatId: string; input: ForwardMessagesInput }) =>
      messageApi.forwardMessages(targetChatId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
