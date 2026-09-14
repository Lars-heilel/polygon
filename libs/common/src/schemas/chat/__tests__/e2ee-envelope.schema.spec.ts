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
