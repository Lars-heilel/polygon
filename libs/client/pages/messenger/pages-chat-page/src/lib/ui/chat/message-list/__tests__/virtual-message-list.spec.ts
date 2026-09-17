import { describe, expect, it } from 'vitest';

import { dedupeMessagesByKey } from '../virtual-message-list.js';

const msg = (overrides: Record<string, unknown>) => ({
  id: 'x',
  clientId: null,
  ...overrides,
});

describe('dedupeMessagesByKey', () => {
  it('collapses same-server-id entries keeping the last (freshest) state', () => {
    const shell = msg({ id: '79', text: null });
    const decrypted = msg({ id: '79', text: 'hi' });

    expect(dedupeMessagesByKey([shell, decrypted])).toEqual([decrypted]);
  });

  it('collapses optimistic + echo by clientId keeping server data', () => {
    const optimistic = msg({ id: 'client:1', clientId: 'c1', text: 'hi' });
    const echo = msg({ id: '79', clientId: 'c1', text: 'hi' });

    expect(dedupeMessagesByKey([optimistic, echo])).toEqual([echo]);
  });

  it('keeps distinct messages in order', () => {
    const a = msg({ id: '1', text: 'a' });
    const b = msg({ id: '2', text: 'b' });

    expect(dedupeMessagesByKey([a, b])).toEqual([a, b]);
  });
});
