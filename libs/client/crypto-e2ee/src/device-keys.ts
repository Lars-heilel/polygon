export interface DeviceKeyPairs {
  identityKeyPair: CryptoKeyPair;
  signedPrekeyPair: CryptoKeyPair;
  registrationId: number;
}

export async function generateDeviceKeys(): Promise<DeviceKeyPairs> {
  const identityKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  );
  const signedPrekeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits'],
  );
  const registrationId = crypto.getRandomValues(new Uint16Array(1))[0] ?? 0;
  return { identityKeyPair, signedPrekeyPair, registrationId };
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return btoa(String.fromCharCode(...raw));
}

/**
 * Chunked binary→base64: argument spreading (`String.fromCharCode(...bytes)`)
 * overflows the call stack past ~100KB, so large ciphertexts must go through here.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export function importPublicKey(b64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}

const DEVICE_ID_STORAGE_KEY = 'polygon.e2ee.deviceId';

export function getOrCreateDeviceId(): string {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const existing = storage?.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Drop the stored device id and mint a fresh one. Used when the stored id
 * turned out to belong to another user (shared browser, stale storage) —
 * reusing it would hit the server ownership guard.
 */
export function resetDeviceId(): string {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const id = crypto.randomUUID();
    storage?.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
/**
 * Persist the enrolled device id so `senderDeviceId` stays stable across
 * reloads. The enrolled id is the primary path; the random
 * `getOrCreateDeviceId` fallback remains only for the non-enrolled edge.
 */
export function rememberDeviceId(deviceId: string): void {
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(
      DEVICE_ID_STORAGE_KEY,
      deviceId,
    );
  } catch {
    // Best-effort only (private mode / no DOM).
  }
}

export interface OwnDeviceKeyRefs {
  deviceId: string;
  identityPrivate: CryptoKey;
  signedPrekeyPrivate: CryptoKey;
  oneTimePrivate?: CryptoKey;
  /**
   * Private halves of the published one-time prekeys, keyed by their public
   * base64. The sender mixes dh3 into first-contact chains, so the recipient
   * must retain every private until its prekey is consumed (consume-once:
   * each entry is deleted after first use).
   */
  oneTimePrivates?: Map<string, CryptoKey>;
}

let ownDeviceKeys: OwnDeviceKeyRefs | null = null;

export function registerOwnDeviceKeys(keys: OwnDeviceKeyRefs): void {
  ownDeviceKeys = keys;
}

/** Public base64 ids of the retained one-time private halves (presence only). */
export function listOwnOneTimePublicKeys(): string[] {
  return [...(ownDeviceKeys?.oneTimePrivates?.keys() ?? [])];
}

/** Peek at a retained one-time private half without consuming it. */
export function getOwnOneTimePrivate(publicB64: string): CryptoKey | undefined {
  return ownDeviceKeys?.oneTimePrivates?.get(publicB64);
}

/**
 * Consume-once take: returns the private half for a published one-time
 * public key and deletes it so it can never be reused.
 */
export function consumeOwnOneTimePrivate(publicB64: string): CryptoKey | undefined {
  const privates = ownDeviceKeys?.oneTimePrivates;
  const key = privates?.get(publicB64);
  if (key) privates?.delete(publicB64);
  return key;
}

/**
 * Primary device-id path for `senderDeviceId`: the enrolled device id when
 * the client enrolled at login, otherwise the random-`getOrCreateDeviceId`
 * fallback for the non-enrolled edge (callers log a warn on fallback).
 */
export function getActiveDeviceId(): { deviceId: string; enrolled: boolean } {
  const own = ownDeviceKeys?.deviceId;
  if (own) return { deviceId: own, enrolled: true };
  return { deviceId: getOrCreateDeviceId(), enrolled: false };
}

export function getOwnDeviceKeys(): OwnDeviceKeyRefs | null {
  return ownDeviceKeys;
}

export function clearOwnDeviceKeys(): void {
  ownDeviceKeys = null;
}
