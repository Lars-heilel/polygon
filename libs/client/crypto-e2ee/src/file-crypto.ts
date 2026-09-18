import { bytesToBase64 } from './device-keys.js';

export interface EncryptedFile {
  /** Ciphertext bytes (AES-256-GCM): the only form ever uploaded. */
  ciphertext: Uint8Array<ArrayBuffer>;
  /** Base64 content key — travels inside message envelopes, never to storage. */
  keyB64: string;
  /** Base64 IV for the file encryption. */
  ivB64: string;
}

const b64ToBytes = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importFileKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBytes(keyB64), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt file bytes with a fresh random content key. The returned key
 * must be distributed through message envelopes (`fileKeys`), never stored
 * server-side alongside the ciphertext.
 */
export async function encryptFileBytes(
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<EncryptedFile> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return { ciphertext, keyB64: bytesToBase64(rawKey), ivB64: bytesToBase64(iv) };
}

/** Reverse of `encryptFileBytes`: recovers the original file bytes. */
export async function decryptFileBytes(
  ciphertext: Uint8Array<ArrayBuffer>,
  keyB64: string,
  ivB64: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await importFileKey(keyB64);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivB64) },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}
