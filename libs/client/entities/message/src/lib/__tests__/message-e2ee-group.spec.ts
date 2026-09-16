import { createSenderKeyContext, encryptForGroup } from '@org/crypto-e2ee';
import { describe, expect, it } from 'vitest';

import { decryptIncomingMessage } from '../../message-e2ee.js';
import type { RawMessage } from '../../message.types.js';

const CHAT_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';
const SENDER_DEVICE_ID = '00000000-0000-0000-0000-000000000000';
const OWN_DEVICE_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';

function rawGroupMessage(
  chainKeyId: string,
  counter: number,
  ciphertext: string,
  iv: string,
): RawMessage {
  return {
    id: 'msg-group-1',
    clientId: null,
    chatId: CHAT_ID,
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
        chainKeyId,
        counter,
        ciphertext,
        iv,
      },
    ],
  };
}

describe('decryptIncomingMessage with group envelopes', () => {
  it('decrypts a group envelope via the sender-chain lookup', async () => {
    const ctx = await createSenderKeyContext(CHAT_ID);
    const envelope = await encryptForGroup('hello group', ctx);

    const message = await decryptIncomingMessage(
      rawGroupMessage(envelope.chainKeyId, envelope.counter, envelope.ciphertext, envelope.iv),
      OWN_DEVICE_ID,
    );

    expect(message.text).toBe('hello group');
    expect(message.undecryptable).toBeUndefined();
  });

  it('marks envelopes with an unknown chain as undecryptable with a retry payload', async () => {
    const message = await decryptIncomingMessage(
      rawGroupMessage('missing-chain', 0, 'Y2lwaGVydGV4dA==', 'aXYAAAAAAAAA'),
      OWN_DEVICE_ID,
    );

    expect(message.text).toBeNull();
    expect(message.undecryptable).toBe(true);
    expect(message.raw).toBeDefined();
  });
});
