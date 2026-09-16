import {
  clearOwnDeviceKeys,
  decryptFromDevice,
  encryptToDevice,
  getOrInitSession,
  listOwnOneTimePublicKeys,
  prepareDeviceEnrollment,
} from '@org/crypto-e2ee';
import { afterEach, describe, expect, it } from 'vitest';

import { decryptIncomingMessage, defaultSessionResolver } from '../../message-e2ee.js';
import type { RawMessage } from '../../message.types.js';

/**
 * Real-path first-contact spec: recipient enrolls (OTPK private halves
 * retained in-memory), the "server" consumes one published one-time prekey
 * into a bundle, the sender derives a dh3 session from that bundle, and the
 * recipient resolves its session via `defaultSessionResolver` — with no
 * hand-wired privates anywhere.
 */
describe('first-contact OTPK path (enrollment to decrypt)', () => {
  afterEach(() => {
    clearOwnDeviceKeys();
  });

  it('enrollment → consume → sender session → resolver session → decrypt succeeds', async () => {
    const enrollment = await prepareDeviceEnrollment();
    expect(listOwnOneTimePublicKeys()).toHaveLength(20);

    // Server side: first consume after publish returns a full bundle with
    // exactly one one-time prekey (consume-once).
    const consumedOneTime = enrollment.oneTimePrekeys[0] as string;
    const bundle = {
      deviceId: enrollment.deviceId,
      identityKey: enrollment.identityKey,
      signedPrekey: enrollment.signedPrekey,
      signedPrekeySignature: enrollment.signedPrekeySignature,
      oneTimePrekey: consumedOneTime,
    };

    const senderDeviceId = '00000000-0000-0000-0000-000000000000';
    const senderSession = await getOrInitSession(bundle);
    const envelope = await encryptToDevice('first contact', senderSession, senderDeviceId);

    const recipientSession = await defaultSessionResolver(envelope);
    expect(recipientSession).not.toBeNull();
    await expect(decryptFromDevice(envelope, recipientSession!)).resolves.toBe('first contact');

    // The used private half is consumed (deleted) exactly once.
    expect(listOwnOneTimePublicKeys()).toHaveLength(19);
    expect(listOwnOneTimePublicKeys()).not.toContain(consumedOneTime);
  });

  it('decrypts end to end through decryptIncomingMessage without hand-wired privates', async () => {
    const enrollment = await prepareDeviceEnrollment();
    const bundle = {
      deviceId: enrollment.deviceId,
      identityKey: enrollment.identityKey,
      signedPrekey: enrollment.signedPrekey,
      signedPrekeySignature: enrollment.signedPrekeySignature,
      oneTimePrekey: enrollment.oneTimePrekeys[3] as string,
    };
    const senderSession = await getOrInitSession(bundle);
    const envelope = await encryptToDevice(
      'hello real path',
      senderSession,
      '00000000-0000-0000-0000-000000000000',
    );

    const raw: RawMessage = {
      id: 'msg-real-path-1',
      clientId: null,
      chatId: 'otpk-path-chat',
      senderId: 'user-2',
      type: 'TEXT',
      text: null,
      hasLink: false,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      envelopes: [envelope],
    };

    // No explicit deviceId: resolves the enrolled device from own keys.
    const message = await decryptIncomingMessage(raw);
    expect(message.text).toBe('hello real path');
    expect(message.undecryptable).toBeUndefined();
  });
});
