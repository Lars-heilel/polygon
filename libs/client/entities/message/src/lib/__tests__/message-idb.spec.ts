import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import type { Message } from '../../message.types.js';
import {
  evictOldMessages,
  peekCachedMessages,
  readCachedMessages,
  writeMessagesToCache,
} from '../message-idb.js';

const msg = (id: string, createdAt: string): Message => ({
  id,
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text: 'hi',
  hasLink: false,
  createdAt,
  updatedAt: createdAt,
  media: null,
  linkPreview: null,
  attachments: [],
  forwardContext: null,
  editedAt: null,
  deletedAt: null,
  deletedById: null,
});

describe('message-idb', () => {
  it('round-trips messages and evicts beyond the keep limit', async () => {
    await writeMessagesToCache('chat-1', [
      msg('1', '2026-09-14T10:00:00.000Z'),
      msg('2', '2026-09-14T10:01:00.000Z'),
      msg('3', '2026-09-14T10:02:00.000Z'),
    ]);
    await evictOldMessages('chat-1', 2);
    const back = await readCachedMessages('chat-1');
    expect(back.map((m) => m.id)).toEqual(['2', '3']);
  });

  it('mirrors writes synchronously for initialData peeks', async () => {
    expect(peekCachedMessages('chat-mirror')).toBeUndefined();
    await writeMessagesToCache('chat-mirror', [
      msg('1', '2026-09-14T10:00:00.000Z'),
      msg('2', '2026-09-14T10:01:00.000Z'),
    ]);
    expect(peekCachedMessages('chat-mirror')?.map((m) => m.id)).toEqual(['1', '2']);
  });
});
