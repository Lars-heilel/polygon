import { Test } from '@nestjs/testing';

import { SenderKeyService } from '../sender-key.service.js';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

const CHAT_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2';
const CHAIN_KEY_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3';
const SENDER_DEVICE_ID = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1';
const RECIPIENT_A = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4';
const RECIPIENT_B = '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c5';

async function service(): Promise<SenderKeyService> {
  const module = await Test.createTestingModule({
    providers: [SenderKeyService],
  }).compile();
  return module.get(SenderKeyService);
}

describe('SenderKeyService', () => {
  it('stores one share per recipient device', async () => {
    const svc = await service();
    await svc.distributeShares([
      {
        chatId: CHAT_ID,
        chainKeyId: CHAIN_KEY_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        recipientDeviceId: RECIPIENT_A,
        wrappedChainKey: 'd3JhcHBlZA==',
      },
      {
        chatId: CHAT_ID,
        chainKeyId: CHAIN_KEY_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        recipientDeviceId: RECIPIENT_B,
        wrappedChainKey: 'b3RoZXI=',
      },
    ]);

    await expect(svc.getShare(CHAT_ID, RECIPIENT_A)).resolves.toMatchObject({
      chainKeyId: CHAIN_KEY_ID,
      wrappedChainKey: 'd3JhcHBlZA==',
    });
    await expect(svc.getShare(CHAT_ID, RECIPIENT_B)).resolves.toMatchObject({
      chainKeyId: CHAIN_KEY_ID,
      wrappedChainKey: 'b3RoZXI=',
    });
  });

  it('rotates to a new chainKeyId and revokes only the removed device', async () => {
    const svc = await service();
    await svc.distributeShares([
      {
        chatId: CHAT_ID,
        chainKeyId: CHAIN_KEY_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        recipientDeviceId: RECIPIENT_A,
        wrappedChainKey: 'd3JhcHBlZA==',
      },
      {
        chatId: CHAT_ID,
        chainKeyId: CHAIN_KEY_ID,
        senderDeviceId: SENDER_DEVICE_ID,
        recipientDeviceId: RECIPIENT_B,
        wrappedChainKey: 'b3RoZXI=',
      },
    ]);

    const rotated = await svc.rotateChain(CHAT_ID, [RECIPIENT_A]);

    expect(rotated.chainKeyId).not.toBe(CHAIN_KEY_ID);
    await expect(svc.getShare(CHAT_ID, RECIPIENT_A)).resolves.toBeNull();
    await expect(svc.getShare(CHAT_ID, RECIPIENT_B)).resolves.toMatchObject({
      chainKeyId: CHAIN_KEY_ID,
    });
  });
});
