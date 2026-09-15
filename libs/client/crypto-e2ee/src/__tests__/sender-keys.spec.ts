import { describe, expect, it } from 'vitest';

import { bytesToBase64 } from '../device-keys.js';
import { createRecipientSession, createSessionFromPrekey } from '../ratchet-session.js';
import {
  createSenderKeyContext,
  decryptFromGroup,
  decryptWithChainKey,
  encryptForGroup,
  ensureGroupRecipients,
  getCurrentSenderKeyContext,
  rotateSenderKey,
  unwrapChainKey,
  wrapChainKeyForDevice,
} from '../sender-keys.js';

describe('sender keys', () => {
  it('advances the counter across two group messages', async () => {
    const ctx = await createSenderKeyContext('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2');
    const first = await encryptForGroup('one', ctx);
    const second = await encryptForGroup('two', ctx);

    expect(first.counter).toBe(0);
    expect(second.counter).toBe(1);
    expect(second.chainKeyId).toBe(first.chainKeyId);
    await expect(decryptFromGroup(first)).resolves.toBe('one');
    await expect(decryptFromGroup(second)).resolves.toBe('two');
  });

  it('rotates so the old chain cannot decrypt new messages', async () => {
    const chatId = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';
    const ctx = await createSenderKeyContext(chatId);
    const oldChainKey = ctx.chainKey;
    const before = await encryptForGroup('before', ctx);
    await expect(decryptFromGroup(before)).resolves.toBe('before');

    const next = await rotateSenderKey(chatId);
    expect(next.chainKeyId).not.toBe(ctx.chainKeyId);

    const after = await encryptForGroup('after', next);
    await expect(decryptFromGroup(after)).resolves.toBe('after');
    await expect(decryptWithChainKey(after, oldChainKey)).rejects.toThrow('E2EE_DECRYPT_FAILED');
  });
});

describe('sender-key distribution', () => {
  const CHAT_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';
  const SENDER_DEVICE = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';
  const RECIPIENT_DEVICE = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4';

  const genKey = () =>
    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const exportPub = async (key: CryptoKey) =>
    btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));

  it('wraps and unwraps a chain key through a 1:1 session', async () => {
    const recipientIdentity = await genKey();
    const recipientSigned = await genKey();
    const recipientOneTime = await genKey();
    const senderEphemeral = await genKey();
    const senderSession = await createSessionFromPrekey(
      {
        deviceId: RECIPIENT_DEVICE,
        identityKey: await exportPub(recipientIdentity.publicKey),
        signedPrekey: await exportPub(recipientSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: await exportPub(recipientOneTime.publicKey),
      },
      senderEphemeral.privateKey,
      await exportPub(senderEphemeral.publicKey),
    );

    const ctx = await createSenderKeyContext(CHAT_ID);
    const wrapped = await wrapChainKeyForDevice(ctx, senderSession, SENDER_DEVICE);
    expect(wrapped.ciphertext).not.toContain(ctx.chainKeyId);

    const recipientSession = await createRecipientSession({
      ephemeralKeyB64: wrapped.ephemeralKey,
      ownIdentityPrivate: recipientIdentity.privateKey,
      ownSignedPrekeyPrivate: recipientSigned.privateKey,
      ownOneTimePrivate: recipientOneTime.privateKey,
      theirDeviceId: SENDER_DEVICE,
    });
    const unwrapped = await unwrapChainKey(wrapped, recipientSession);
    expect(unwrapped.chainKeyId).toBe(ctx.chainKeyId);

    const env = await encryptForGroup('group hi', ctx);
    await expect(decryptWithChainKey(env, unwrapped.chainKey)).resolves.toBe('group hi');
    await expect(decryptFromGroup(env)).resolves.toBe('group hi');
  });
});

describe('ensureGroupRecipients', () => {
  it('throws E2EE_NO_RECIPIENT_KEYS for an E2EE chat without devices', () => {
    expect(() => ensureGroupRecipients([], true)).toThrow('E2EE_NO_RECIPIENT_KEYS');
  });

  it('passes for plaintext chats and non-empty device lists', () => {
    expect(() => ensureGroupRecipients([], false)).not.toThrow();
    expect(() =>
      ensureGroupRecipients(['0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4'], true),
    ).not.toThrow();
  });
});

describe('getCurrentSenderKeyContext', () => {
  it('tracks the latest chain per chat', async () => {
    const chatId = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9d1';
    expect(getCurrentSenderKeyContext(chatId)).toBeNull();
    const ctx = await createSenderKeyContext(chatId);
    expect(getCurrentSenderKeyContext(chatId)?.chainKeyId).toBe(ctx.chainKeyId);
    const next = await rotateSenderKey(chatId);
    expect(getCurrentSenderKeyContext(chatId)?.chainKeyId).toBe(next.chainKeyId);
  });
});

describe('bytesToBase64', () => {
  it('converts a 1MB buffer without stack overflow', () => {
    const big = new Uint8Array(1024 * 1024);
    for (let offset = 0; offset < big.length; offset += 65536) {
      big.set(crypto.getRandomValues(new Uint8Array(Math.min(65536, big.length - offset))), offset);
    }
    const b64 = bytesToBase64(big);
    expect(b64.length).toBe(Math.ceil(big.length / 3) * 4);
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back.length).toBe(big.length);
    expect(back.slice(0, 1024)).toEqual(big.slice(0, 1024));
    expect(back.slice(-1024)).toEqual(big.slice(-1024));
  });
});
