import { Test } from '@nestjs/testing';

import { E2eeKeyService } from '../e2ee-key.service.js';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

describe('E2eeKeyService', () => {
  it('registers a device and consumes a one-time prekey once', async () => {
    const module = await Test.createTestingModule({
      providers: [E2eeKeyService],
    }).compile();
    const svc = module.get(E2eeKeyService);
    await svc.registerDevice({
      userId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
      deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      identityKey: 'aWtlaQ==',
      registrationId: 7,
    });
    const bundle = await svc.consumePrekeyBundle('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1');
    expect(bundle?.oneTimePrekey).toBeDefined();
  });
});
