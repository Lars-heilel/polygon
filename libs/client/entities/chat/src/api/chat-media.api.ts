import { authedFetch } from '@org/shared';
import type { FileCategory } from '@org/common';

export interface MediaFile {
  id: string;
  url: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  uploaderId: string | null;
  chatId: string | null;
  createdAt: string;
}

export interface MediaPage {
  files: MediaFile[];
  total: number;
}

export function fetchChatMedia(
  chatId: string,
  category?: FileCategory,
  take = 50,
  skip = 0,
): Promise<MediaPage> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('take', String(take));
  params.set('skip', String(skip));
  return authedFetch<MediaPage>(`chats/${chatId}/media/history?${params.toString()}`);
}
