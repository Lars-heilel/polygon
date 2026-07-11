import { Logger } from '@nestjs/common';

import { FrontendErrorController } from './frontend-error.controller';

describe('FrontendErrorController', () => {
  let controller: FrontendErrorController;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    controller = new FrontendErrorController();
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs only safe frontend_error metadata without free-text fields', () => {
    const result = controller.capture({
      app: 'messenger',
      route: '/chat',
      message: 'Render failed for email user@example.com with token=secret-token',
      stack: 'Error: Render failed\n    at token=secret-token',
      componentStack: 'at UserEmail(user@example.com)',
      userAgent: 'Mozilla/5.0 user@example.com',
      timestamp: '2026-07-10T08:00:00.000Z',
    });

    expect(result).toEqual({ accepted: true });
    expect(loggerError).toHaveBeenCalledWith({
      eventType: 'frontend_error',
      app: 'messenger',
      route: '/chat',
      timestamp: '2026-07-10T08:00:00.000Z',
      messageLength: 64,
      stackLength: 46,
      componentStackLength: 30,
      userAgentLength: 28,
      hasStack: true,
      hasComponentStack: true,
      hasUserAgent: true,
    });
  });

  it('rejects invalid payloads before logging', () => {
    expect(() =>
      controller.capture({
        app: 'messenger',
        route: '/chat',
        message: 'x'.repeat(4097),
        timestamp: '2026-07-10T08:00:00.000Z',
      }),
    ).toThrow();
    expect(loggerError).not.toHaveBeenCalled();
  });
});
