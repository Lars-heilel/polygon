import { Logger } from '@nestjs/common';
import type { Request } from 'express';

import { extractClientMetadata } from './client-metadata.decorator';

describe('extractClientMetadata', () => {
  let verboseSpy: jest.SpyInstance;

  beforeEach(() => {
    verboseSpy = jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
  });

  afterEach(() => {
    verboseSpy.mockRestore();
  });

  it('does not write raw client metadata values to diagnostic logs', () => {
    const req = {
      headers: {
        'user-agent': 'Sensitive Browser User Agent',
        'x-forwarded-for': '203.0.113.40',
        'cf-ipcountry': 'Secret Country',
      },
      socket: {},
    } as unknown as Request;

    const metadata = extractClientMetadata(req);

    expect(metadata.ip).toBe('203.0.113.40');
    const loggedPayload = JSON.stringify(verboseSpy.mock.calls);
    expect(loggedPayload).not.toContain('203.0.113.40');
    expect(loggedPayload).not.toContain('Sensitive Browser User Agent');
    expect(loggedPayload).not.toContain('Secret Country');
  });
});
