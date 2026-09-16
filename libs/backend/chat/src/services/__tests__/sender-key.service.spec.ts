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

    await expect(svc.getShare(CHAT_ID, CHAIN_KEY_ID, RECIPIENT_A)).resolves.toMatchObject({
      chainKeyId: CHAIN_KEY_ID,
      wrappedChainKey: 'd3JhcHBlZA==',
    });
    await expect(svc.getShare(CHAT_ID, CHAIN_KEY_ID, RECIPIENT_B)).resolves.toMatchObject({
      chainKeyId: CHAIN_KEY_ID,
      wrappedChainKey: 'b3RoZXI=',
    });
    await expect(svc.getLatestChainId(CHAT_ID, SENDER_DEVICE_ID)).resolves.toBe(CHAIN_KEY_ID);
  });

  it('scopes share lookups by chainKeyId after rotation', async () => {
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
    // Removed device resolves nothing, not even for the old chain.
    await expect(svc.getShare(CHAT_ID, CHAIN_KEY_ID, RECIPIENT_A)).resolves.toBeNull();
    // Remaining device still resolves the old chain…
    await expect(svc.getShare(CHAT_ID, CHAIN_KEY_ID, RECIPIENT_B)).resolves.toMatchObject({
      wrappedChainKey: 'b3RoZXI=',
    });
    // …but the new chain has no share for them until redistribution.
    await expect(svc.getShare(CHAT_ID, rotated.chainKeyId, RECIPIENT_B)).resolves.toBeNull();
    // Latest chain with live shares is still the old one until redistribution.
    await expect(svc.getLatestChainId(CHAT_ID, SENDER_DEVICE_ID)).resolves.toBe(CHAIN_KEY_ID);
    await expect(svc.getLatestChainId(CHAT_ID, 'unknown-sender')).resolves.toBeNull();
  });

  it('treats an empty distribution batch as a no-op', async () => {
    const svc = await service();

    await expect(svc.distributeShares([])).resolves.toEqual([]);
  });

  it('mints a new chain id on rotation with no removed devices', async () => {
    const svc = await service();

    const rotated = await svc.rotateChain(CHAT_ID, []);

    expect(rotated.chainKeyId).toBeDefined();
    expect(typeof rotated.chainKeyId).toBe('string');
  });
});
