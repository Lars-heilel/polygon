import { encryptFileBytes } from '@org/crypto-e2ee';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '../../message.types.js';
import { useDecryptedMessageMedia } from '../use-decrypted-media.js';

const MEDIA_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    clientId: null,
    chatId: 'chat-1',
    senderId: 'user-2',
    kind: 'image',
    type: 'IMAGE',
    text: null,
    hasLink: false,
    createdAt: '2026-09-17T10:00:00.000Z',
    updatedAt: '2026-09-17T10:00:00.000Z',
    media: {
      fileId: MEDIA_ID,
      contentUrl: 'https://cdn.test/file.bin',
      thumbUrl: null,
      fileName: null,
      mime: null,
      size: 32,
      category: 'IMAGE',
      width: null,
      height: null,
      durationMs: null,
      waveform: null,
    },
    linkPreview: null,
    attachments: [],
    forwardContext: null,
    editedAt: null,
    deletedAt: null,
    deletedById: null,
    ...overrides,
  } as Message;
}

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => 'blob:decrypted');
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', {
    createObjectURL: createObjectURLMock,
    revokeObjectURL: revokeObjectURLMock,
  });
  fetchMock.mockReset();
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDecryptedMessageMedia', () => {
  it('passes legacy media through without fetching', () => {
    const { result } = renderHook(() => useDecryptedMessageMedia(message()));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.message.media?.contentUrl).toBe('https://cdn.test/file.bin');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('decrypts envelope media into a blob URL with envelope metadata', async () => {
    const original = new TextEncoder().encode('real-png-bytes');
    const encrypted = await encryptFileBytes(original);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => encrypted.ciphertext.buffer as ArrayBuffer,
    });
    const msg = message({
      fileKeys: [
        {
          mediaId: MEDIA_ID,
          key: encrypted.keyB64,
          iv: encrypted.ivB64,
          fileName: 'photo.png',
          mime: 'image/png',
        },
      ],
    });

    const { result } = renderHook(() => useDecryptedMessageMedia(msg));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.message.media?.contentUrl).toBe('blob:decrypted');
    expect(result.current.message.media?.fileName).toBe('photo.png');
    expect(result.current.message.media?.mime).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.test/file.bin');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the server URL when decryption fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('NETWORK_DOWN'));
    const msg = message({
      fileKeys: [
        { mediaId: MEDIA_ID, key: 'a2V5', iv: 'aXY', fileName: 'photo.png', mime: 'image/png' },
      ],
    });

    const { result } = renderHook(() => useDecryptedMessageMedia(msg));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.message.media?.contentUrl).toBe('https://cdn.test/file.bin');
  });
});
