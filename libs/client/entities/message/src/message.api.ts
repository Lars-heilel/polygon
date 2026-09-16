import { useEffect } from 'react';

import { API_ROUTES } from '@org/common';
import { authedFetch, frontendLog } from '@org/shared';
import {
  type InfiniteData,
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from '@tanstack/react-query';

import {
  evictOldMessages,
  getLastSync,
  readCachedMessages,
  setLastSync,
  writeMessagesToCache,
} from './lib/message-idb.js';
import {
  appendMessageToPages,
  mergeDeltaIntoPages,
  removeMessageFromPages,
  updateMessageInPages,
} from './message-cache.js';
import { decryptIncomingMessage } from './message-e2ee.js';
import { normalizeMessage } from './message-normalizer.js';
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
    const messages = await Promise.all(raw.messages.map((m) => decryptIncomingMessage(m)));
    return { messages, nextCursor: raw.nextCursor };
  },

  async getDelta(
    chatId: string,
    params: { since: string; sinceId?: string; limit?: number },
  ): Promise<{ messages: Message[]; deletedIds: string[] }> {
    const search = new URLSearchParams({ since: params.since });
    if (params.sinceId) search.set('sinceId', params.sinceId);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const raw = await authedFetch<RawMessagePage & { deletedIds: string[] }>(
      `${API_ROUTES.chats.messagesDelta(chatId)}?${search.toString()}`,
    );
    const messages = await Promise.all(raw.messages.map((m) => decryptIncomingMessage(m)));
    return {
      messages,
      deletedIds: raw.deletedIds ?? [],
    };
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
    return authedFetch<{ id: string; chatId: string }>(
      API_ROUTES.chats.message(chatId, messageId),
      {
        method: 'DELETE',
        body: JSON.stringify({ mode }),
      },
    );
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
  const queryClient = useQueryClient();
  const query = useSuspenseInfiniteQuery({
    queryKey: ['messages', chatId],
    queryFn: ({ pageParam }) => messageApi.getMessages(chatId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
    gcTime: 10 * 60_000,
  });
  useEffect(() => {
    void syncChatDelta(chatId, queryClient).catch(() => undefined);
  }, [chatId, queryClient]);
  return query;
}

/**
 * Cold-start + delta-sync: seed `['messages', chatId]` from the IndexedDB
 * cache so the list renders instantly, then merge the server delta
 * (`getLastSync` → `getDelta` → decrypt → patch pages → rewrite cache).
 * `initialData` cannot be async for suspense queries, so the seed is applied
 * imperatively when the query is still empty.
 */
export async function syncChatDelta(
  chatId: string,
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  const cached = await readCachedMessages(chatId).catch(() => [] as Message[]);
  if (cached.length > 0) {
    queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) => {
      if (old && old.pages.some((p) => p.messages.length > 0)) return old;
      return { pages: [{ messages: cached, nextCursor: null }], pageParams: [undefined] };
    });
  }
  const lastSync = await getLastSync(chatId).catch(() => null);
  if (!lastSync) {
    const current = queryClient.getQueryData<InfiniteData<MessagePage>>(['messages', chatId]);
    const messages = current?.pages.flatMap((p) => p.messages) ?? cached;
    if (messages.length > 0) {
      await writeMessagesToCache(chatId, messages).catch(() => undefined);
      await evictOldMessages(chatId).catch(() => undefined);
      const newest = messages[messages.length - 1];
      if (newest) {
        await setLastSync(chatId, { since: newest.createdAt, sinceId: newest.id }).catch(
          () => undefined,
        );
      }
    }
    return;
  }
  let delta: { messages: Message[]; deletedIds: string[] };
  try {
    delta = await messageApi.getDelta(chatId, {
      since: lastSync.since,
      sinceId: lastSync.sinceId,
    });
  } catch (err) {
    frontendLog('warn', 'MessageDelta', 'delta_sync_failed', { hasChatId: !!chatId });
    throw err;
  }
  if (delta.messages.length === 0 && delta.deletedIds.length === 0) return;
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) =>
    mergeDeltaIntoPages(old, delta.messages, delta.deletedIds),
  );
  const merged =
    queryClient
      .getQueryData<InfiniteData<MessagePage>>(['messages', chatId])
      ?.pages.flatMap((p) => p.messages) ?? [];
  if (merged.length > 0) {
    await writeMessagesToCache(chatId, merged).catch(() => undefined);
    await evictOldMessages(chatId).catch(() => undefined);
    const newest = merged[merged.length - 1];
    if (newest) {
      await setLastSync(chatId, { since: newest.createdAt, sinceId: newest.id }).catch(
        () => undefined,
      );
    }
  }
}

export function useChatDeltaSync(chatId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    void syncChatDelta(chatId, queryClient).catch(() => undefined);
  }, [chatId, queryClient]);
}

/** Append a live socket message to page 0 and persist it to the cache. */
export function appendLiveMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  message: Message,
): void {
  queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', message.chatId], (old) =>
    appendMessageToPages(old, message),
  );
  void writeMessagesToCache(message.chatId, [message]).catch(() => undefined);
}

export function useEditMessageMutation(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) =>
      messageApi.editMessage(chatId, messageId, text),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessagePage>>(['messages', chatId], (old) =>
        updateMessageInPages<InfiniteData<MessagePage>, Message>(old, message),
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      queryClient.invalidateQueries({ queryKey: ['messages', variables.targetChatId] });
    },
  });
}
