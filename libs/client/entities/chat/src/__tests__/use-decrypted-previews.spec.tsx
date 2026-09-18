import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createSessionFromPrekey,
  encryptToDevice,
  registerOwnDeviceKeys,
} from '@org/crypto-e2ee';

import { truncatePreviewText, useDecryptedPreviews } from '../use-decrypted-previews.js';

const MY_DEVICE = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d1';
const SENDER_DEVICE = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d2';

const genKey = () =>
  crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const exportPub = async (key: CryptoKey) =>
  btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));

/** A live 1:1 envelope for MY_DEVICE, encrypted by a remote sender. */
async function liveEnvelope(text: string) {
  const identity = await genKey();
  const signed = await genKey();
  const ephemeral = await genKey();
  registerOwnDeviceKeys({
    deviceId: MY_DEVICE,
    identityPrivate: identity.privateKey,
    signedPrekeyPrivate: signed.privateKey,
  });
  const session = await createSessionFromPrekey(
    {
      deviceId: MY_DEVICE,
      identityKey: await exportPub(identity.publicKey),
      signedPrekey: await exportPub(signed.publicKey),
      signedPrekeySignature: 'c2ln',
      oneTimePrekey: null,
    },
    ephemeral.privateKey,
    await exportPub(ephemeral.publicKey),
  );
  const envelope = await encryptToDevice(text, session, SENDER_DEVICE);
  return { ...envelope, recipientDeviceId: MY_DEVICE };
}

function chat(id: string, lastMessage: unknown) {
  return { id, lastMessage } as never;
}

describe('useDecryptedPreviews', () => {
  it('resolves readable text for envelopes the device can decrypt', async () => {
    const envelope = await liveEnvelope('hello preview');
    const { result } = renderHook(() =>
      useDecryptedPreviews([
        chat('chat-1', { id: 'm-1', chatId: 'chat-1', text: null, envelopes: [envelope] }),
      ]),
    );

    await waitFor(() => expect(result.current['chat-1']).toBe('hello preview'));
  });

  it('truncates long decrypted previews at 80 chars', () => {
    expect(truncatePreviewText(`  ${'x'.repeat(100)}  `)).toBe(`${'x'.repeat(80)}…`);
    expect(truncatePreviewText('short')).toBe('short');
  });

  it('leaves plaintext previews alone without touching crypto', async () => {
    const { result } = renderHook(() =>
      useDecryptedPreviews([chat('chat-1', { id: 'm-1', chatId: 'chat-1', text: 'plain hi' })]),
    );

    await waitFor(() => expect(result.current).toEqual({}));
    expect(result.current['chat-1']).toBeUndefined();
  });

  it('falls back silently when the envelope cannot be decrypted', async () => {
    const envelope = await liveEnvelope('unreadable');
    const tampered = { ...envelope, ciphertext: 'AAAA' };
    const { result } = renderHook(() =>
      useDecryptedPreviews([
        chat('chat-1', { id: 'm-1', chatId: 'chat-1', text: null, envelopes: [tampered] }),
      ]),
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current['chat-1']).toBeUndefined();
  });

  it('skips chats without envelopes', async () => {
    const { result } = renderHook(() =>
      useDecryptedPreviews([chat('chat-1', { id: 'm-1', chatId: 'chat-1', text: null })]),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toEqual({});
  });
});
