import { describe, expect, it } from 'vitest';

import { senderKeyDistributionSchema } from '../sender-key.schema.js';

describe('senderKeyDistributionSchema', () => {
  it('accepts a distribution share', () => {
    const parsed = senderKeyDistributionSchema.parse({
      chatId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c2',
      chainKeyId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c3',
      senderDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c1',
      recipientDeviceId: '0199a6c7-9b1e-7f3a-b2c4-d5e6f7a8b9c4',
      wrappedChainKey: 'd3JhcHBlZA==',
    });
    expect(parsed.chainKeyId).toBeDefined();
  });
});
