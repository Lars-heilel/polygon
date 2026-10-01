import { throttleTracker } from '../user-throttle.tracker';

const sub = 'user-123';
const jwt = `header.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.sig`;

describe('throttleTracker', () => {
  it('keys authed user by sub and ip', () => {
    expect(throttleTracker({ headers: { cookie: `access_token=${jwt}` }, ip: '1.2.3.4' })).toBe(
      `user:${sub}:1.2.3.4`,
    );
  });

  it('falls back to ip for anonymous', () => {
    expect(throttleTracker({ headers: {}, ip: '5.6.7.8' })).toBe('ip:5.6.7.8');
  });

  it('falls back to ip for malformed token', () => {
    expect(throttleTracker({ headers: { cookie: 'access_token=not.a.jwt' }, ip: '9.9.9.9' })).toBe(
      'ip:9.9.9.9',
    );
  });
});
