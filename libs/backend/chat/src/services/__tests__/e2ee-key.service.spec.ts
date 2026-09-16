import { Test } from '@nestjs/testing';

import { E2eeKeyService } from '../e2ee-key.service.js';

jest.mock('meilisearch', () => ({ Meilisearch: class Meilisearch {} }));

const DEVICE = {
  userId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
  deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
  identityKey: 'aWtlaQ==',
  registrationId: 7,
};

async function service(): Promise<E2eeKeyService> {
  const module = await Test.createTestingModule({
    providers: [E2eeKeyService],
  }).compile();
  return module.get(E2eeKeyService);
}

describe('E2eeKeyService', () => {
  it('returns null when consuming before any prekeys are published', async () => {
    const svc = await service();
    await svc.registerDevice({ ...DEVICE });
    await expect(svc.consumePrekeyBundle(DEVICE.deviceId)).resolves.toBeNull();
  });

  it('returns a full bundle on first consume after publish', async () => {
    const svc = await service();
    await svc.registerDevice({ ...DEVICE });
    await svc.publishPrekeys({
      deviceId: DEVICE.deviceId,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    });
    const bundle = await svc.consumePrekeyBundle(DEVICE.deviceId);
    expect(bundle).toEqual(
      expect.objectContaining({
        deviceId: DEVICE.deviceId,
        identityKey: DEVICE.identityKey,
        signedPrekey: 'c3Bn',
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: 'b3Rw',
      }),
    );
  });

  it('falls back to a signed-prekey-only bundle once one-time prekeys are exhausted', async () => {
    const svc = await service();
    await svc.registerDevice({ ...DEVICE });
    await svc.publishPrekeys({
      deviceId: DEVICE.deviceId,
      signedPrekey: 'c3Bn',
      signedPrekeySignature: 'c2ln',
      oneTimePrekeys: ['b3Rw'],
    });
    await svc.consumePrekeyBundle(DEVICE.deviceId);
    const second = await svc.consumePrekeyBundle(DEVICE.deviceId);
    expect(second?.oneTimePrekey).toBeNull();
    expect(second?.signedPrekey).toBe('c3Bn');
  });

  it('returns the registered device and null for unknown devices', async () => {
    const svc = await service();
    await svc.registerDevice({ ...DEVICE });
    await expect(svc.getDevice(DEVICE.deviceId)).resolves.toEqual(
      expect.objectContaining({ deviceId: DEVICE.deviceId, userId: DEVICE.userId }),
    );
    await expect(svc.getDevice('0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c9')).resolves.toBeNull();
  });
});
