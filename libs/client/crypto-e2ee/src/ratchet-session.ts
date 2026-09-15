import type { MessageEnvelope, PrekeyBundleRecord } from '@org/common';

export interface RatchetSession {
  sessionId: string;
  theirDeviceId: string;
  chainKey: CryptoKey;
  messageCounter: number;
}

export async function createSessionFromPrekey(
  theirBundle: PrekeyBundleRecord,
  ourEphemeralPrivate: CryptoKey,
  ourEphemeralPublicB64: string,
): Promise<RatchetSession> {
  const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const importPub = (s: string) =>
    crypto.subtle.importKey('raw', b64(s), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const dh1 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importPub(theirBundle.signedPrekey) },
    ourEphemeralPrivate,
    256,
  );
  const dh2 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importPub(theirBundle.identityKey) },
    ourEphemeralPrivate,
    256,
  );
  const parts = [new Uint8Array(dh1), new Uint8Array(dh2)];
  if (theirBundle.oneTimePrekey) {
    const dh3 = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: await importPub(theirBundle.oneTimePrekey) },
      ourEphemeralPrivate,
      256,
    );
    parts.push(new Uint8Array(dh3));
  }
  const secret = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    secret.set(part, offset);
    offset += part.length;
  }
  const chainKey = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
  void ourEphemeralPublicB64;
  return {
    sessionId: crypto.randomUUID(),
    theirDeviceId: theirBundle.deviceId,
    chainKey,
    messageCounter: 0,
  };
}

export async function encryptToDevice(
  plaintext: string,
  session: RatchetSession,
  senderDeviceId: string,
): Promise<MessageEnvelope> {
  const messageKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array([session.messageCounter]),
      info: new TextEncoder().encode('msg'),
    },
    session.chainKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    messageKey,
    new TextEncoder().encode(plaintext),
  );
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const env: MessageEnvelope = {
    senderDeviceId,
    recipientDeviceId: session.theirDeviceId,
    ciphertext: b64(new Uint8Array(ct)),
    iv: b64(iv),
    keyVersion: session.messageCounter,
    ratchetHeader: session.sessionId,
  };
  session.messageCounter += 1;
  return env;
}

export async function decryptFromDevice(
  envelope: MessageEnvelope,
  session: RatchetSession,
): Promise<string> {
  const messageKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array([envelope.keyVersion]),
      info: new TextEncoder().encode('msg'),
    },
    session.chainKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64(envelope.iv) },
      messageKey,
      b64(envelope.ciphertext),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('E2EE_DECRYPT_FAILED');
  }
}

const sessionsByDeviceId = new Map<string, RatchetSession>();

export async function getOrInitSession(theirBundle: PrekeyBundleRecord): Promise<RatchetSession> {
  const cached = sessionsByDeviceId.get(theirBundle.deviceId);
  if (cached) return cached;
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const ephemeralPublicB64 = btoa(
    String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey)),
    ),
  );
  const session = await createSessionFromPrekey(
    theirBundle,
    ephemeral.privateKey,
    ephemeralPublicB64,
  );
  sessionsByDeviceId.set(theirBundle.deviceId, session);
  return session;
}

export function listSessionDeviceIds(): string[] {
  return [...sessionsByDeviceId.keys()];
}
