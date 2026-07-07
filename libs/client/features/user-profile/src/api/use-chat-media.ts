import { useInfiniteQuery } from '@tanstack/react-query';
import type { ChatMediaFilter } from '@org/common';
import { extractLinks } from '@org/shared';

import type { Message } from '@org/entities-message';

import { fetchChatMediaMessages } from './chat-media.api.js';

const PAGE_SIZE = 50;

export type ChatMediaEntry =
  | { id: string; kind: 'file'; message: Message; createdAt: string }
  | { id: string; kind: 'link'; message: Message; createdAt: string; url: string };

export function useChatMediaMessages(chatId: string, filter: ChatMediaFilter) {
  return useInfiniteQuery({
    queryKey: ['chat-media-messages', chatId, filter],
    queryFn: ({ pageParam }) =>
      fetchChatMediaMessages(chatId, filter, pageParam as string | undefined, PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function buildChatMediaEntries(messages: Message[]): ChatMediaEntry[] {
  const items: ChatMediaEntry[] = [];

  for (const message of messages) {
    if (message.fileId) {
      if (message.fileCategory === 'VOICE') {
        continue;
      }

      items.push({
        id: `file-${message.id}`,
        kind: 'file',
        message,
        createdAt: message.createdAt,
      });
    }

    if (message.text) {
      for (const url of extractLinks(message.text)) {
        items.push({
          id: `link-${message.id}-${url}`,
          kind: 'link',
          message,
          createdAt: message.createdAt,
          url,
        });
      }
    }
  }

  return items.sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ));
}

export function groupMediaEntriesByDate(items: ChatMediaEntry[]): Map<string, ChatMediaEntry[]> {
  const groups = new Map<string, ChatMediaEntry[]>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const label = formatDateLabel(date);
    const current = groups.get(label) ?? [];
    current.push(item);
    groups.set(label, current);
  }

  return groups;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDate.getTime() === today.getTime()) return 'Today';
  if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
