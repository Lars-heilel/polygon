import { decryptFileBytes } from '@org/crypto-e2ee';
import { describe, expect, it } from 'vitest';

import { prepareFileForUpload } from '../upload-chat-file.api.js';

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(blob);
  });
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

describe('prepareFileForUpload', () => {
  it('passes files through untouched for legacy chats', async () => {
    const file = new File(['plain-bytes'], 'doc.txt', { type: 'text/plain' });

    const prepared = await prepareFileForUpload(file, {
      name: file.name,
      mime: file.type,
      e2eeEnabled: false,
    });

    expect(prepared.encrypted).toBe(false);
    expect(prepared.contentKey).toBeUndefined();
    expect(prepared.name).toBe('doc.txt');
    expect(prepared.mime).toBe('text/plain');
    expect(prepared.size).toBe(file.size);
    await expect(blobText(prepared.blob)).resolves.toBe('plain-bytes');
  });

  it('encrypts bytes and redacts metadata for E2EE chats', async () => {
    const file = new File(['secret-bytes'], 'photo.png', { type: 'image/png' });

    const prepared = await prepareFileForUpload(file, {
      name: file.name,
      mime: file.type,
      e2eeEnabled: true,
    });

    expect(prepared.encrypted).toBe(true);
    expect(prepared.name).toBe('encrypted-file');
    expect(prepared.mime).toBe('application/octet-stream');
    expect(prepared.size).toBeGreaterThan(file.size);
    expect(prepared.contentKey).toBeDefined();

    const uploaded = await blobBytes(prepared.blob);
    expect(Buffer.from(uploaded).toString()).not.toContain('secret-bytes');
    const back = await decryptFileBytes(
      uploaded,
      prepared.contentKey!.keyB64,
      prepared.contentKey!.ivB64,
    );
    expect(Buffer.from(back).toString()).toBe('secret-bytes');
  });
});
