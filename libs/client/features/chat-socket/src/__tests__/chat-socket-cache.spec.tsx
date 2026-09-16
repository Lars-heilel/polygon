import { type ReactNode, createElement } from 'react';

import {
  clearOwnDeviceKeys,
  encryptToDevice,
  getOrInitSession,
  registerOwnDeviceKeys,
} from '@org/crypto-e2ee';
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
    clearOwnDeviceKeys();
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

  it('decrypts a real 1:1 envelope into the query cache and IndexedDB', async () => {
    const recipientIdentity = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const recipientSigned = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const exportPub = async (key: CryptoKey) =>
      btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));
    const recipientDeviceId = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';
    registerOwnDeviceKeys({
      deviceId: recipientDeviceId,
      identityPrivate: recipientIdentity.privateKey,
      signedPrekeyPrivate: recipientSigned.privateKey,
    });
    const session = await getOrInitSession({
      deviceId: recipientDeviceId,
      identityKey: await exportPub(recipientIdentity.publicKey),
      signedPrekey: await exportPub(recipientSigned.publicKey),
      signedPrekeySignature: 'c2ln',
      oneTimePrekey: null,
    });
    const envelope = await encryptToDevice(
      'secret live',
      session,
      '00000000-0000-0000-0000-000000000000',
    );

    renderHook(() => useChatSocket('chat-e2ee'), { wrapper });

    await act(async () => {
      emit(
        'message:new',
        rawMessage({ id: 'msg-e2ee-1', chatId: 'chat-e2ee', text: null, envelopes: [envelope] }),
      );
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{
        pages: { messages: { id: string; text: string | null }[] }[];
      }>(['messages', 'chat-e2ee']);
      expect(data?.pages.flatMap((p) => p.messages).find((m) => m.id === 'msg-e2ee-1')?.text).toBe(
        'secret live',
      );
    });
    const cached = await readCachedMessages('chat-e2ee');
    expect(cached.find((m) => m.id === 'msg-e2ee-1')?.text).toBe('secret live');
  });

  it('skips undecryptable envelopes without writing to the query cache or IndexedDB', async () => {
    renderHook(() => useChatSocket('chat-e2ee'), { wrapper });

    await act(async () => {
      emit(
        'message:new',
        rawMessage({
          id: 'msg-bad-1',
          chatId: 'chat-e2ee',
          text: null,
          envelopes: [
            {
              senderDeviceId: '00000000-0000-0000-0000-000000000000',
              chainKeyId: 'missing-chain',
              counter: 0,
              ciphertext: 'Y2lwaGVydGV4dA==',
              iv: 'aXYAAAAAAAAA',
            },
          ],
        }),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const data = queryClient.getQueryData<{
      pages: { messages: { id: string }[] }[];
    }>(['messages', 'chat-e2ee']);
    expect(data?.pages.flatMap((p) => p.messages).map((m) => m.id) ?? []).not.toContain(
      'msg-bad-1',
    );
    const cached = await readCachedMessages('chat-e2ee');
    expect(cached.map((m) => m.id)).not.toContain('msg-bad-1');
  });
});
