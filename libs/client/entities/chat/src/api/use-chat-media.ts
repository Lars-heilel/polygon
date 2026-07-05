import { useInfiniteQuery } from '@tanstack/react-query';
import type { FileCategory } from '@org/common';
import { fetchChatMedia, type MediaFile, type MediaPage } from './chat-media.api.js';

const PAGE_SIZE = 50;

export function useChatMediaInfiniteQuery(chatId: string, category?: FileCategory) {
  return useInfiniteQuery<MediaPage>({
    queryKey: ['chat-media', chatId, category],
    queryFn: ({ pageParam }) =>
      fetchChatMedia(chatId, category, PAGE_SIZE, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * PAGE_SIZE;
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

export function groupMediaByDate(files: MediaFile[]): Map<string, MediaFile[]> {
  const groups = new Map<string, MediaFile[]>();
  for (const file of files) {
    const date = new Date(file.createdAt);
    const label = formatDateLabel(date);
    const existing = groups.get(label) ?? [];
    existing.push(file);
    groups.set(label, existing);
  }
  return groups;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const fileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (fileDate.getTime() === today.getTime()) return 'Today';
  if (fileDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
