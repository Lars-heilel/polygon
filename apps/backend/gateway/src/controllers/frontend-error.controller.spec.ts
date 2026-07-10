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

  it('logs a structured frontend_error event without extra sensitive fields', () => {
    const result = controller.capture({
      app: 'messenger',
      route: '/chat',
      message: 'Render failed',
      stack: 'Error: Render failed',
      componentStack: 'at ChatPage',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-07-10T08:00:00.000Z',
    });

    expect(result).toEqual({ accepted: true });
    expect(loggerError).toHaveBeenCalledWith({
      eventType: 'frontend_error',
      app: 'messenger',
      route: '/chat',
      message: 'Render failed',
      stack: 'Error: Render failed',
      componentStack: 'at ChatPage',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-07-10T08:00:00.000Z',
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
