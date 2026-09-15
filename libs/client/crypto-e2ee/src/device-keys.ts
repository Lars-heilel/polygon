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

export interface OwnDeviceKeyRefs {
  deviceId: string;
  identityPrivate: CryptoKey;
  signedPrekeyPrivate: CryptoKey;
  oneTimePrivate?: CryptoKey;
}

let ownDeviceKeys: OwnDeviceKeyRefs | null = null;

export function registerOwnDeviceKeys(keys: OwnDeviceKeyRefs): void {
  ownDeviceKeys = keys;
}

export function getOwnDeviceKeys(): OwnDeviceKeyRefs | null {
  return ownDeviceKeys;
}

export function clearOwnDeviceKeys(): void {
  ownDeviceKeys = null;
}
