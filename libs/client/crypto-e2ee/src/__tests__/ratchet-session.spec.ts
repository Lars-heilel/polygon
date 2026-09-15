import { describe, expect, it } from 'vitest';

import {
  createRecipientSession,
  createSessionFromPrekey,
  decryptFromDevice,
  encryptToDevice,
} from '../ratchet-session.js';

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

  it('round-trips a counter above 255 without salt collision', async () => {
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
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ]);
    const session = await createSessionFromPrekey(
      {
        deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
        identityKey: await exportPub(theirIdentity.publicKey),
        signedPrekey: await exportPub(theirSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: null,
      },
      ephemeral.privateKey,
      await exportPub(ephemeral.publicKey),
    );
    session.messageCounter = 300;
    const env = await encryptToDevice(
      'high counter',
      session,
      '00000000-0000-0000-0000-000000000000',
    );
    expect(env.keyVersion).toBe(300);
    await expect(decryptFromDevice(env, session)).resolves.toBe('high counter');
  });
});

describe('cross-side 1:1 session', () => {
  const exportPub = async (key: CryptoKey) =>
    btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', key))));

  const genKey = () =>
    crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

  it('decrypts with a recipient session derived only from the envelope ephemeralKey', async () => {
    const recipientIdentity = await genKey();
    const recipientSigned = await genKey();
    const recipientOneTime = await genKey();
    const senderEphemeral = await genKey();
    const senderSession = await createSessionFromPrekey(
      {
        deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
        identityKey: await exportPub(recipientIdentity.publicKey),
        signedPrekey: await exportPub(recipientSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: await exportPub(recipientOneTime.publicKey),
      },
      senderEphemeral.privateKey,
      await exportPub(senderEphemeral.publicKey),
    );
    const env = await encryptToDevice(
      'cross-side hello',
      senderSession,
      '00000000-0000-0000-0000-000000000000',
    );
    expect(env.ephemeralKey).toBe(await exportPub(senderEphemeral.publicKey));

    const recipientSession = await createRecipientSession({
      ephemeralKeyB64: env.ephemeralKey,
      ownIdentityPrivate: recipientIdentity.privateKey,
      ownSignedPrekeyPrivate: recipientSigned.privateKey,
      ownOneTimePrivate: recipientOneTime.privateKey,
      theirDeviceId: '00000000-0000-0000-0000-000000000000',
    });
    expect(recipientSession).not.toBe(senderSession);
    await expect(decryptFromDevice(env, recipientSession)).resolves.toBe('cross-side hello');
  });

  it('decrypts a signed-only bundle without a one-time prekey', async () => {
    const recipientIdentity = await genKey();
    const recipientSigned = await genKey();
    const senderEphemeral = await genKey();
    const senderSession = await createSessionFromPrekey(
      {
        deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
        identityKey: await exportPub(recipientIdentity.publicKey),
        signedPrekey: await exportPub(recipientSigned.publicKey),
        signedPrekeySignature: 'c2ln',
        oneTimePrekey: null,
      },
      senderEphemeral.privateKey,
      await exportPub(senderEphemeral.publicKey),
    );
    const env = await encryptToDevice(
      'signed-only hello',
      senderSession,
      '00000000-0000-0000-0000-000000000000',
    );

    const recipientSession = await createRecipientSession({
      ephemeralKeyB64: env.ephemeralKey,
      ownIdentityPrivate: recipientIdentity.privateKey,
      ownSignedPrekeyPrivate: recipientSigned.privateKey,
      theirDeviceId: '00000000-0000-0000-0000-000000000000',
    });
    await expect(decryptFromDevice(env, recipientSession)).resolves.toBe('signed-only hello');
  });
});
