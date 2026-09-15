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
