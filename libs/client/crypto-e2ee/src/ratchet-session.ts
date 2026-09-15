import type { MessageEnvelope, PrekeyBundleRecord } from '@org/common';

export const E2EE_DECRYPT_FAILED = 'E2EE_DECRYPT_FAILED';

export interface RatchetSession {
  sessionId: string;
  theirDeviceId: string;
  chainKey: CryptoKey;
  messageCounter: number;
  ephemeralPublicB64: string;
}

export interface RecipientSessionParams {
  ephemeralKeyB64: string;
  ownIdentityPrivate: CryptoKey;
  ownSignedPrekeyPrivate: CryptoKey;
  ownOneTimePrivate?: CryptoKey;
  theirDeviceId: string;
}

export interface ReceiveSessionKeys {
  identityPrivate: CryptoKey;
  signedPrekeyPrivate: CryptoKey;
  oneTimePrivate?: CryptoKey;
}

const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const importRawPublic = (s: string) =>
  crypto.subtle.importKey('raw', b64ToBytes(s), { name: 'ECDH', namedCurve: 'P-256' }, true, []);

function counterSalt(counter: number): Uint8Array<ArrayBuffer> {
  const salt: Uint8Array<ArrayBuffer> = new Uint8Array(4);
  new DataView(salt.buffer).setUint32(0, counter, false);
  return salt;
}

async function deriveChainKey(secretParts: Uint8Array[]): Promise<CryptoKey> {
  const secret = new Uint8Array(secretParts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of secretParts) {
    secret.set(part, offset);
    offset += part.length;
  }
  return crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
}

export async function createSessionFromPrekey(
  theirBundle: PrekeyBundleRecord,
  ourEphemeralPrivate: CryptoKey,
  ourEphemeralPublicB64: string,
): Promise<RatchetSession> {
  const dh1 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importRawPublic(theirBundle.signedPrekey) },
    ourEphemeralPrivate,
    256,
  );
  const dh2 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: await importRawPublic(theirBundle.identityKey) },
    ourEphemeralPrivate,
    256,
  );
  const parts = [new Uint8Array(dh1), new Uint8Array(dh2)];
  if (theirBundle.oneTimePrekey) {
    const dh3 = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: await importRawPublic(theirBundle.oneTimePrekey) },
      ourEphemeralPrivate,
      256,
    );
    parts.push(new Uint8Array(dh3));
  }
  const chainKey = await deriveChainKey(parts);
  return {
    sessionId: crypto.randomUUID(),
    theirDeviceId: theirBundle.deviceId,
    chainKey,
    messageCounter: 0,
    ephemeralPublicB64: ourEphemeralPublicB64,
  };
}

export async function createRecipientSession(
  params: RecipientSessionParams,
): Promise<RatchetSession> {
  const ephemeralPublic = await importRawPublic(params.ephemeralKeyB64);
  const dh1 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublic },
    params.ownSignedPrekeyPrivate,
    256,
  );
  const dh2 = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPublic },
    params.ownIdentityPrivate,
    256,
  );
  const parts = [new Uint8Array(dh1), new Uint8Array(dh2)];
  if (params.ownOneTimePrivate) {
    const dh3 = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: ephemeralPublic },
      params.ownOneTimePrivate,
      256,
    );
    parts.push(new Uint8Array(dh3));
  }
  const chainKey = await deriveChainKey(parts);
  return {
    sessionId: crypto.randomUUID(),
    theirDeviceId: params.theirDeviceId,
    chainKey,
    messageCounter: 0,
    ephemeralPublicB64: params.ephemeralKeyB64,
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
      salt: counterSalt(session.messageCounter),
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
    ephemeralKey: session.ephemeralPublicB64,
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
      salt: counterSalt(envelope.keyVersion),
      info: new TextEncoder().encode('msg'),
    },
    session.chainKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(envelope.iv) },
      messageKey,
      b64ToBytes(envelope.ciphertext),
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error(E2EE_DECRYPT_FAILED);
  }
}

const sendSessionsByDeviceId = new Map<string, RatchetSession>();
const receiveSessionsByEphemeral = new Map<string, RatchetSession>();

export async function getOrInitSession(theirBundle: PrekeyBundleRecord): Promise<RatchetSession> {
  const cached = sendSessionsByDeviceId.get(theirBundle.deviceId);
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
  sendSessionsByDeviceId.set(theirBundle.deviceId, session);
  return session;
}

export async function getOrInitReceiveSession(
  envelope: MessageEnvelope,
  keys: ReceiveSessionKeys,
): Promise<RatchetSession> {
  const cacheKey = `${envelope.senderDeviceId}:${envelope.ephemeralKey}`;
  const cached = receiveSessionsByEphemeral.get(cacheKey);
  if (cached) return cached;
  const session = await createRecipientSession({
    ephemeralKeyB64: envelope.ephemeralKey,
    ownIdentityPrivate: keys.identityPrivate,
    ownSignedPrekeyPrivate: keys.signedPrekeyPrivate,
    ownOneTimePrivate: keys.oneTimePrivate,
    theirDeviceId: envelope.senderDeviceId,
  });
  receiveSessionsByEphemeral.set(cacheKey, session);
  return session;
}

export function listSessionDeviceIds(): string[] {
  return [...sendSessionsByDeviceId.keys()];
}
