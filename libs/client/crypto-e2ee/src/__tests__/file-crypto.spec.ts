import { describe, expect, it } from 'vitest';

import { decryptFileBytes, encryptFileBytes } from '../file-crypto.js';

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('file-crypto', () => {
  it('round-trips file bytes through a fresh content key', async () => {
    const original = text('fake-png-bytes-'.repeat(100));

    const encrypted = await encryptFileBytes(original);

    expect(encrypted.ciphertext).not.toEqual(original);
    expect(encrypted.ciphertext.length).toBe(original.length + 16);
    const back = await decryptFileBytes(encrypted.ciphertext, encrypted.keyB64, encrypted.ivB64);
    expect(back).toEqual(original);
  });

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptFileBytes(text('secret'));

    const tampered = Uint8Array.from(encrypted.ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      decryptFileBytes(tampered, encrypted.keyB64, encrypted.ivB64),
    ).rejects.toThrow();
  });

  it('rejects the wrong content key', async () => {
    const encrypted = await encryptFileBytes(text('secret'));
    const other = await encryptFileBytes(text('other'));

    await expect(
      decryptFileBytes(encrypted.ciphertext, other.keyB64, encrypted.ivB64),
    ).rejects.toThrow();
  });
});
