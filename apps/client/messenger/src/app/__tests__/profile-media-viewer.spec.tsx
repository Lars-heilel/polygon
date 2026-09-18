import { encryptFileBytes } from '@org/crypto-e2ee';
import type { Message } from '@org/entities-message';
import { useDecryptedViewerItems } from '@org/features-user-profile/ui/profile-media-panel';
import { renderHook, waitFor } from '@testing-library/react';

const MEDIA_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';

function message(): Message {
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
  } as Message;
}

describe('useDecryptedViewerItems', () => {
  const realCreateObjectURL = URL.createObjectURL?.bind(URL);

  beforeEach(() => {
    // jsdom here has no WebCrypto subtle — borrow Node's.
    const nodeCrypto = jest.requireActual('node:crypto') as { webcrypto: Crypto };
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        value: nodeCrypto.webcrypto,
        configurable: true,
      });
    }
    URL.createObjectURL = jest.fn(() => 'blob:decrypted');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (realCreateObjectURL) URL.createObjectURL = realCreateObjectURL;
  });

  it('resolves blob sources for envelopes the device can decrypt', async () => {
    const original = new TextEncoder().encode('real-bytes');
    const encrypted = await encryptFileBytes(original);
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => encrypted.ciphertext.buffer,
    })) as unknown as typeof fetch;

    const msg = message();
    (msg as { fileKeys?: unknown[] }).fileKeys = [
      {
        mediaId: MEDIA_ID,
        key: encrypted.keyB64,
        iv: encrypted.ivB64,
        fileName: 'photo.png',
        mime: 'image/png',
      },
    ];
    const items = [
      { id: 'file-m-1', kind: 'file', message: msg, createdAt: msg.createdAt },
    ] as never;

    const { result } = renderHook(() => useDecryptedViewerItems(items));

    await waitFor(() => expect(result.current[0]?.src).toBe('blob:decrypted'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('keeps server sources for legacy media without file keys', async () => {
    const msg = message();
    const items = [
      { id: 'file-m-1', kind: 'file', message: msg, createdAt: msg.createdAt },
    ] as never;

    const { result } = renderHook(() => useDecryptedViewerItems(items));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]?.src).toBe('https://cdn.test/file.bin');
  });
});
