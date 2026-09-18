import { describe, expect, it } from 'vitest';

import { deviceSchema } from '../device.schema.js';

describe('deviceSchema', () => {
  it('accepts a valid device record', () => {
    const parsed = deviceSchema.parse({
      userId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
      deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      identityKey: 'YmFzZTY0LWtleQ==',
      registrationId: 42,
    });
    expect(parsed.registrationId).toBe(42);
  });

  it('rejects empty identityKey', () => {
    expect(() =>
      deviceSchema.parse({
        userId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
        deviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
        identityKey: '',
        registrationId: 42,
      }),
    ).toThrow();
  });
});

import { envelopeSchema, groupEnvelopeSchema } from '../envelope.schema.js';

describe('envelope fileKeys', () => {
  const base = {
    senderDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c0',
    recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
    ciphertext: 'Y2lwaGVy',
    iv: 'aXY',
    keyVersion: 0,
    ratchetHeader: 'cmF0Y2hldA==',
    ephemeralKey: 'ZXBo',
  };
  const fileKey = {
    mediaId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
    key: 'ZmlsZWtleQ==',
    iv: 'ZmlsZWl2',
    fileName: 'photo.png',
    mime: 'image/png',
  };

  it('accepts envelopes without fileKeys (backward compatible)', () => {
    expect(envelopeSchema.parse(base)).not.toHaveProperty('fileKeys');
  });

  it('accepts envelopes carrying file keys', () => {
    const parsed = envelopeSchema.parse({ ...base, fileKeys: [fileKey] });
    expect(parsed.fileKeys).toHaveLength(1);
    expect(parsed.fileKeys?.[0]?.fileName).toBe('photo.png');
  });

  it('rejects empty file key material', () => {
    expect(() =>
      envelopeSchema.parse({ ...base, fileKeys: [{ ...fileKey, key: '' }] }),
    ).toThrow();
  });

  it('rejects more than 10 file keys', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ ...fileKey, mediaId: `m-${i}` }));
    expect(() => envelopeSchema.parse({ ...base, fileKeys: many })).toThrow();
  });

  it('accepts file keys on group envelopes', () => {
    const parsed = groupEnvelopeSchema.parse({
      senderDeviceId: base.senderDeviceId,
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      counter: 0,
      ciphertext: 'Y2lwaGVy',
      iv: 'aXY',
      fileKeys: [fileKey],
    });
    expect(parsed.fileKeys).toHaveLength(1);
  });
});
