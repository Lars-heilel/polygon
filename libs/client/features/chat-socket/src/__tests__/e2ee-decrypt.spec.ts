import { createSessionFromPrekey, encryptToDevice } from '@org/crypto-e2ee';
import { type RawMessage, decryptIncomingMessage } from '@org/entities-message';
import { describe, expect, it } from 'vitest';

const SENDER_DEVICE_ID = '00000000-0000-0000-0000-000000000000';
const RECIPIENT_DEVICE_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';

async function exportPub(key: CryptoKey): Promise<string> {
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));
}

function rawEnvelopeMessage(
  ciphertext: string,
  iv: string,
  keyVersion: number,
  ephemeralKey: string,
): RawMessage {
  return {
    id: 'msg-1',
    clientId: null,
    chatId: 'chat-1',
    senderId: 'user-1',
    type: 'TEXT',
    text: null,
    hasLink: false,
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    deletedById: null,
    envelopes: [
      {
        senderDeviceId: SENDER_DEVICE_ID,
        recipientDeviceId: RECIPIENT_DEVICE_ID,
        ciphertext,
        iv,
        keyVersion,
        ratchetHeader: 'session-1',
        ephemeralKey,
      },
    ],
  };
}

describe('decrypt on message:new', () => {
  it('decrypts an envelope addressed to this device into message text', async () => {
    const theirIdentity = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const theirSigned = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const session = await createSessionFromPrekey(
      {
        deviceId: RECIPIENT_DEVICE_ID,
        identityKey: await exportPub(theirIdentity.publicKey),
        signedPrekey: await exportPub(theirSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: null,
      },
      ephemeral.privateKey,
      await exportPub(ephemeral.publicKey),
    );
    const envelope = await encryptToDevice('hello e2ee', session, SENDER_DEVICE_ID);

    const message = await decryptIncomingMessage(
      rawEnvelopeMessage(
        envelope.ciphertext,
        envelope.iv,
        envelope.keyVersion,
        envelope.ephemeralKey,
      ),
      RECIPIENT_DEVICE_ID,
      async () => session,
    );

    expect(message.text).toBe('hello e2ee');
    expect(message.undecryptable).toBeUndefined();
  });

  it('renders the undecryptable placeholder when the envelope cannot be decrypted', async () => {
    const theirIdentity = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const theirSigned = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const session = await createSessionFromPrekey(
      {
        deviceId: RECIPIENT_DEVICE_ID,
        identityKey: await exportPub(theirIdentity.publicKey),
        signedPrekey: await exportPub(theirSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: null,
      },
      ephemeral.privateKey,
      await exportPub(ephemeral.publicKey),
    );
    const envelope = await encryptToDevice('secret', session, SENDER_DEVICE_ID);

    const message = await decryptIncomingMessage(
      rawEnvelopeMessage(
        `tampered${envelope.ciphertext}`,
        envelope.iv,
        envelope.keyVersion,
        envelope.ephemeralKey,
      ),
      RECIPIENT_DEVICE_ID,
      async () => session,
    );

    expect(message.text).toBeNull();
    expect(message.undecryptable).toBe(true);
  });

  it('propagates resolver network errors instead of masking them as undecryptable', async () => {
    const raw = rawEnvelopeMessage('Y2lwaGVydGV4dA==', 'aXY=', 0, 'ZXBoZW1lcmFs');

    await expect(
      decryptIncomingMessage(raw, RECIPIENT_DEVICE_ID, async () => {
        throw new Error('NETWORK_DOWN');
      }),
    ).rejects.toThrow('NETWORK_DOWN');
  });
});
