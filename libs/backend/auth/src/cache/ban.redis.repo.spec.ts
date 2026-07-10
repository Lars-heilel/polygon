import type Redis from 'ioredis';

import { BanRedisRepository } from './ban.redis.repo';

describe('BanRedisRepository', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
  };
  const repository = new BanRedisRepository(redis as unknown as Redis);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-08T12:00:00.000Z'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('sets a temporary marker with a millisecond TTL ending at bannedUntil', async () => {
    const marker = { reason: 'Abuse', bannedUntil: '2026-07-08T12:00:01.250Z' };

    await repository.set('credentials-1', marker);

    expect(redis.set).toHaveBeenCalledWith('ban:credentials-1', JSON.stringify(marker), 'PX', 1_250);
  });

  it('sets a permanent marker without an expiry option', async () => {
    const marker = { reason: 'Repeated abuse', bannedUntil: null };

    await repository.set('credentials-1', marker);

    expect(redis.set).toHaveBeenCalledWith('ban:credentials-1', JSON.stringify(marker));
  });

  it.each(['2026-07-08T12:00:00.000Z', '2026-07-08T11:59:59.999Z', 'not-a-date'])(
    'rejects a non-positive or invalid expiry (%s)',
    async (bannedUntil) => {
      await expect(repository.set('credentials-1', { reason: 'Abuse', bannedUntil })).rejects.toThrow(
        'bannedUntil must be in the future',
      );
      expect(redis.set).not.toHaveBeenCalled();
    },
  );

  it('gets a valid marker', async () => {
    const marker = { reason: 'Abuse', bannedUntil: null };
    redis.get.mockResolvedValue(JSON.stringify(marker));

    await expect(repository.get('credentials-1')).resolves.toEqual(marker);
    expect(redis.get).toHaveBeenCalledWith('ban:credentials-1');
  });

  it.each([
    'not-json',
    '{}',
    '{"reason":1,"bannedUntil":null}',
    '{"reason":"Abuse","bannedUntil":1}',
    '{"reason":"Abuse","bannedUntil":"not-a-date"}',
  ])(
    'returns null for a malformed marker (%s)',
    async (raw) => {
      redis.get.mockResolvedValue(raw);
      await expect(repository.get('credentials-1')).resolves.toBeNull();
    },
  );

  it('clears the exact marker key', async () => {
    await repository.clear('credentials-1');
    expect(redis.del).toHaveBeenCalledWith('ban:credentials-1');
  });

  it('acquires a per-target lock with a random ownership token and bounded lease', async () => {
    redis.set.mockResolvedValue('OK');

    const token = await repository.acquireLock('credentials-1', 30_000);

    expect(token).toEqual(expect.any(String));
    expect(token).not.toHaveLength(0);
    expect(redis.set).toHaveBeenCalledWith(
      'admin_lock:credentials-1',
      token,
      'PX',
      30_000,
      'NX',
    );
  });

  it('returns null when another operation owns the target lock', async () => {
    redis.set.mockResolvedValue(null);
    await expect(repository.acquireLock('credentials-1', 30_000)).resolves.toBeNull();
  });

  it('releases only the caller ownership token using compare-and-delete Lua', async () => {
    redis.eval.mockResolvedValue(1);

    await expect(repository.releaseLock('credentials-1', 'owner-token')).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1]) == ARGV[1]"),
      1,
      'admin_lock:credentials-1',
      'owner-token',
    );
  });

  it('reports lost ownership without deleting another owner lock', async () => {
    redis.eval.mockResolvedValue(0);
    await expect(repository.releaseLock('credentials-1', 'stale-token')).resolves.toBe(false);
  });

  it('renews only the caller ownership token using compare-and-pexpire Lua', async () => {
    redis.eval.mockResolvedValue(1);

    await expect(
      repository.renewAdminLock('credentials-1', 'owner-token', 30_000),
    ).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('pexpire', KEYS[1], ARGV[2])"),
      1,
      'admin_lock:credentials-1',
      'owner-token',
      30_000,
    );
  });

  it('reports lost ownership on renewal and rejects invalid leases', async () => {
    redis.eval.mockResolvedValue(0);
    await expect(
      repository.renewAdminLock('credentials-1', 'stale-token', 30_000),
    ).resolves.toBe(false);
    await expect(repository.renewAdminLock('credentials-1', 'owner-token', 0)).rejects.toThrow(
      'lock lease must be a positive integer',
    );
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });
});
