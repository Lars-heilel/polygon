import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearPersistedDeviceKeys,
  clearPersistedDeviceKeysForTests,
  loadPersistedDeviceKeys,
  persistOwnDeviceKeys,
} from '../device-key-store.js';
import { clearOwnDeviceKeys, registerOwnDeviceKeys } from '../device-keys.js';
import { generateDeviceKeys } from '../device-keys.js';

async function testKeys() {
  const { identityKeyPair, signedPrekeyPair } = await generateDeviceKeys();
  const oneTime = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  return {
    deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
    identityPrivate: identityKeyPair.privateKey,
    signedPrekeyPrivate: signedPrekeyPair.privateKey,
    oneTimePrivates: new Map([['b3Rw', oneTime.privateKey]]),
  };
}

afterEach(async () => {
  clearOwnDeviceKeys();
  clearPersistedDeviceKeysForTests();
  await clearPersistedDeviceKeys();
});

describe('device-key-store', () => {
  it('round-trips own device keys through IndexedDB across a memory wipe', async () => {
    const keys = await testKeys();
    await persistOwnDeviceKeys(keys);

    // Simulate a page reload: module memory is gone, IndexedDB survives.
    clearOwnDeviceKeys();

    const loaded = await loadPersistedDeviceKeys();
    expect(loaded?.deviceId).toBe(keys.deviceId);
    expect(loaded?.identityPrivate).toBeInstanceOf(CryptoKey);
    expect(loaded?.signedPrekeyPrivate).toBeInstanceOf(CryptoKey);
    expect(loaded?.oneTimePrivates?.get('b3Rw')).toBeInstanceOf(CryptoKey);

    // Hydrated keys must be usable for real derivation.
    registerOwnDeviceKeys(loaded!);
    const { importPublicKey } = await import('../device-keys.js');
    const peer = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const peerPub = await importPublicKey(
      Buffer.from(await crypto.subtle.exportKey('raw', peer.publicKey)).toString('base64'),
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerPub },
      loaded!.identityPrivate,
      256,
    );
    expect(new Uint8Array(bits)).toHaveLength(32);
  });

  it('returns null when nothing was persisted', async () => {
    await expect(loadPersistedDeviceKeys()).resolves.toBeNull();
  });
});
