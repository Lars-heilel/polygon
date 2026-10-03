import { GatewayChatCacheService } from '../gateway-chat-cache.service';

describe('GatewayChatCacheService membership', () => {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    del: jest.fn(() => Promise.resolve(1)),
  };

  const svc = new GatewayChatCacheService(redis as never);

  it('misses before set, hits after set', async () => {
    await expect(svc.isMemberCached('c1', 'u1')).resolves.toBeNull();
    await svc.setMemberCached('c1', 'u1', 45);
    await expect(svc.isMemberCached('c1', 'u1')).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith('membership:c1:u1', '1', 'EX', 45);
  });

  it('falls back silently on redis failure', async () => {
    const failing = new GatewayChatCacheService({
      get: () => Promise.reject(new Error('down')),
    } as never);
    await expect(failing.isMemberCached('c1', 'u1')).resolves.toBeNull();
  });

  it('clears cached membership', async () => {
    await svc.clearMemberCached('c1', 'u1');
    expect(redis.del).toHaveBeenCalledWith('membership:c1:u1');
  });

  it('ignores redis failure on clear', async () => {
    const failing = new GatewayChatCacheService({
      del: () => Promise.reject(new Error('down')),
    } as never);
    await expect(failing.clearMemberCached('c1', 'u1')).resolves.toBeUndefined();
  });
});
