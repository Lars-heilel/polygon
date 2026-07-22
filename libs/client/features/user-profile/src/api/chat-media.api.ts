import { API_ROUTES } from '@org/common';
import type { ChatMediaFilter } from '@org/common';
import { authedFetch } from '@org/shared';

import { normalizeMessagePage, type MessagePage, type RawMessagePage } from '@org/entities-message';

export async function fetchChatMediaMessages(
  chatId: string,
  filter: ChatMediaFilter,
  cursor?: string,
  take = 50,
): Promise<MessagePage> {
  const params = new URLSearchParams({
    filter,
    take: String(take),
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const raw = await authedFetch<RawMessagePage>(`${API_ROUTES.chats.mediaMessages(chatId)}?${params.toString()}`);
  return normalizeMessagePage(raw);
}
