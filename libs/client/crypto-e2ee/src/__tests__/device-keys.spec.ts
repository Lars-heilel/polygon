import { describe, expect, it, vi } from 'vitest';

import { getOrCreateDeviceId, rememberDeviceId, resetDeviceId } from '../device-keys.js';

describe('device id storage', () => {
  it('resetDeviceId mints a fresh id different from the stored one', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    try {
      rememberDeviceId('old-device-id');
      expect(getOrCreateDeviceId()).toBe('old-device-id');
      const fresh = resetDeviceId();
      expect(fresh).not.toBe('old-device-id');
      expect(getOrCreateDeviceId()).toBe(fresh);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
