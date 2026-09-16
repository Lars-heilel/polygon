import { QueryClient } from '@tanstack/react-query';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { messageApi, syncChatDelta } from '../../message.api.js';
import type { Message } from '../../message.types.js';
import { getLastSync, setLastSync } from '../message-idb.js';

const msg = (id: string, createdAt: string, text = 'hi'): Message => ({
  id,
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-1',
  kind: 'text',
  type: 'TEXT',
  text,
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

describe('syncChatDelta sync cursor', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.restoreAllMocks();
  });

  it('picks the max createdAt as since for out-of-order pages without a last sync', async () => {
    queryClient.setQueryData(['messages', 'chat-1'], {
      pages: [
        {
          messages: [
            msg('m3', '2026-09-14T10:02:00.000Z'),
            msg('m1', '2026-09-14T10:00:00.000Z'),
            msg('m2', '2026-09-14T10:01:00.000Z'),
          ],
          nextCursor: null,
        },
      ],
      pageParams: [undefined],
    });

    await syncChatDelta('chat-1', queryClient);

    await expect(getLastSync('chat-1')).resolves.toEqual({
      since: '2026-09-14T10:02:00.000Z',
      sinceId: 'm3',
    });
  });

  it('picks the max createdAt as since for an out-of-order delta', async () => {
    await setLastSync('chat-1', { since: '2026-09-14T09:00:00.000Z', sinceId: 'm0' });
    vi.spyOn(messageApi, 'getDelta').mockResolvedValue({
      messages: [
        msg('m5', '2026-09-14T10:05:00.000Z'),
        msg('m4', '2026-09-14T10:04:00.000Z'),
        msg('m6', '2026-09-14T10:06:00.000Z'),
      ],
      deletedIds: [],
    });

    await syncChatDelta('chat-1', queryClient);

    await expect(getLastSync('chat-1')).resolves.toEqual({
      since: '2026-09-14T10:06:00.000Z',
      sinceId: 'm6',
    });
  });
});
