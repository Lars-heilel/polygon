import { API_ROUTES } from '@org/common';
import type { ChatMediaFilter } from '@org/common';
import { authedFetch } from '@org/shared';

import type { MessagePage } from '@org/entities-message';

export function fetchChatMediaMessages(
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

  return authedFetch<MessagePage>(`${API_ROUTES.chats.mediaMessages(chatId)}?${params.toString()}`);
}
