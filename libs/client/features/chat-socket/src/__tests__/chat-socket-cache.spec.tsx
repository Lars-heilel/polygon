import { type ReactNode, createElement } from 'react';

import { queryClient } from '@org/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatSocket } from '../use-chat-socket.js';

const { listeners, mockSocket } = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: never) => void>>();
  const mockSocket = {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (payload: never) => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
    }),
    off: vi.fn((event: string, handler: (payload: never) => void) => {
      listeners.get(event)?.delete(handler);
    }),
  };
  return { listeners, mockSocket };
});

vi.mock('@org/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/shared')>();
  return { ...actual, socket: mockSocket };
});

vi.mock('@org/entities-chat', () => ({
  chatApi: { markRead: vi.fn(async () => undefined) },
  useChatStore: () => () => undefined,
}));

vi.mock('@org/entities-message', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/entities-message')>();
  return { ...actual };
});

const { readCachedMessages } = await import('@org/entities-message');

function emit(event: string, payload: unknown): void {
  for (const handler of listeners.get(event) ?? []) {
    handler(payload as never);
  }
}

const rawMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-live-1',
  clientId: null,
  chatId: 'chat-1',
  senderId: 'user-2',
  type: 'TEXT',
  text: 'live hello',
  hasLink: false,
  createdAt: '2026-09-14T10:05:00.000Z',
  updatedAt: '2026-09-14T10:05:00.000Z',
  editedAt: null,
  deletedAt: null,
  deletedById: null,
  ...overrides,
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useChatSocket live cache wiring', () => {
  beforeEach(() => {
    listeners.clear();
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('decrypts message:new into the query cache and IndexedDB', async () => {
    renderHook(() => useChatSocket('chat-1'), { wrapper });

    await act(async () => {
      emit('message:new', rawMessage());
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{ pages: { messages: { id: string }[] }[] }>([
        'messages',
        'chat-1',
      ]);
      expect(data?.pages[0]?.messages.map((m) => m.id)).toContain('msg-live-1');
    });
    const cached = await readCachedMessages('chat-1');
    expect(cached.map((m) => m.id)).toContain('msg-live-1');
  });

  it('applies message:updated and message:deleted to the query cache and IndexedDB', async () => {
    renderHook(() => useChatSocket('chat-1'), { wrapper });

    await act(async () => {
      emit('message:new', rawMessage());
    });
    await act(async () => {
      emit('message:updated', rawMessage({ text: 'edited live' }));
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{
        pages: { messages: { id: string; text: string | null }[] }[];
      }>(['messages', 'chat-1']);
      expect(data?.pages.flatMap((p) => p.messages).find((m) => m.id === 'msg-live-1')?.text).toBe(
        'edited live',
      );
    });

    await act(async () => {
      emit('message:deleted', { chatId: 'chat-1', messageId: 'msg-live-1' });
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{
        pages: { messages: { id: string }[] }[];
      }>(['messages', 'chat-1']);
      expect(data?.pages.flatMap((p) => p.messages).map((m) => m.id)).not.toContain('msg-live-1');
    });
    const cached = await readCachedMessages('chat-1');
    expect(cached.map((m) => m.id)).not.toContain('msg-live-1');
  });
});
