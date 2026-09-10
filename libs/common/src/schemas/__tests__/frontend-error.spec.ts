import { frontendErrorSchema } from '../frontend-error';

describe('frontendErrorSchema', () => {
  it('accepts a bounded frontend error payload', () => {
    const payload = {
      app: 'messenger',
      route: '/chat?id=123',
      message: 'Render failed',
      stack: 'Error: Render failed',
      componentStack: 'at ChatPage',
      userAgent: 'Mozilla/5.0',
      timestamp: '2026-07-10T08:00:00.000Z',
    };

    expect(frontendErrorSchema.parse(payload)).toEqual(payload);
  });

  it('rejects unsupported app names and overlong messages', () => {
    expect(() =>
      frontendErrorSchema.parse({
        app: 'marketing',
        route: '/chat',
        message: 'x'.repeat(4097),
        timestamp: '2026-07-10T08:00:00.000Z',
      }),
    ).toThrow();
  });
});
