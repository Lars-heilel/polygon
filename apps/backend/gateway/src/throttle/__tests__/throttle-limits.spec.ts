import { USER_THROTTLE } from '../throttle-limits';

describe('USER_THROTTLE', () => {
  it('matches documented user limit', () => {
    expect(USER_THROTTLE).toEqual({ limit: 300, ttl: 60000 });
  });
});
