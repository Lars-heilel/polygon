import { describe, expect, it } from 'vitest';

import { createSessionFromPrekey, decryptFromDevice, encryptToDevice } from '../ratchet-session.js';

describe('1:1 ratchet session', () => {
  it('encrypts and decrypts a round trip with advancing counter', async () => {
    const exportPub = async (key: CryptoKey) =>
      btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));
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
    const theirOneTime = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const session = await createSessionFromPrekey(
      {
        deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
        identityKey: await exportPub(theirIdentity.publicKey),
        signedPrekey: await exportPub(theirSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: await exportPub(theirOneTime.publicKey),
      },
      ephemeral.privateKey,
      await exportPub(ephemeral.publicKey),
    );
    const env = await encryptToDevice('hello', session, '00000000-0000-0000-0000-000000000000');
    expect(env.ciphertext).not.toBe('hello');
    const back = await decryptFromDevice(env, session);
    expect(back).toBe('hello');
    expect(env.keyVersion).toBe(0);
  });
});
