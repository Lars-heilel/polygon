import { API_ROUTES } from '@org/common';
import type { ChatMediaFilter } from '@org/common';
import {
  type MessagePage,
  type RawMessage,
  type RawMessagePage,
  decryptIncomingMessage,
  normalizeMessagePage,
} from '@org/entities-message';
import { authedFetch } from '@org/shared';

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

  const raw = await authedFetch<RawMessagePage>(
    `${API_ROUTES.chats.mediaMessages(chatId)}?${params.toString()}`,
  );
  const page = normalizeMessagePage(raw);
  // Same decrypt path as the message list: envelopes without plaintext
  // must resolve before any thumbnail or viewer touches media URLs.
  // Undecryptable entries keep their placeholder (retryable); anything
  // else falls back to the raw shell so media never silently vanishes.
  const messages = await Promise.all(
    page.messages.map(async (message) => {
      try {
        return await decryptIncomingMessage(message as unknown as RawMessage);
      } catch {
        return message;
      }
    }),
  );
  return { ...page, messages };
}
