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
  chatId: 'idb-chat-1',
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
    await writeMessagesToCache('idb-chat-1', [
      msg('1', '2026-09-14T10:00:00.000Z'),
      msg('2', '2026-09-14T10:01:00.000Z'),
      msg('3', '2026-09-14T10:02:00.000Z'),
    ]);
    await evictOldMessages('idb-chat-1', 2);
    const back = await readCachedMessages('idb-chat-1');
    expect(back.map((m) => m.id)).toEqual(['2', '3']);
  });

  it('mirrors writes synchronously for initialData peeks', async () => {
    expect(peekCachedMessages('idb-chat-mirror')).toBeUndefined();
    await writeMessagesToCache('idb-chat-mirror', [
      msg('1', '2026-09-14T10:00:00.000Z'),
      msg('2', '2026-09-14T10:01:00.000Z'),
    ]);
    expect(peekCachedMessages('idb-chat-mirror')?.map((m) => m.id)).toEqual(['1', '2']);
  });
});

describe('message-idb placeholders', () => {
  it('never persists undecryptable placeholders over readable entries', async () => {
    await writeMessagesToCache('idb-chat-ph', [msg('1', '2026-09-14T10:00:00.000Z')]);
    await writeMessagesToCache('idb-chat-ph', [
      { ...msg('1', '2026-09-14T10:00:00.000Z'), text: null, undecryptable: true },
    ]);
    const back = await readCachedMessages('idb-chat-ph');
    expect(back.map((m) => m.id)).toEqual(['1']);
    expect(back[0]?.text).toBe('hi');
    expect(peekCachedMessages('idb-chat-ph')?.[0]?.text).toBe('hi');
  });

  it('stores nothing when only placeholders arrive', async () => {
    await writeMessagesToCache('idb-chat-ph-empty', [
      { ...msg('9', '2026-09-14T10:00:00.000Z'), text: null, undecryptable: true },
    ]);
    expect(await readCachedMessages('idb-chat-ph-empty')).toEqual([]);
    expect(peekCachedMessages('idb-chat-ph-empty')).toBeUndefined();
  });
});
