import type { UserSearchResult } from '@org/common';
import type { ISearchProvider } from '@org/core';

jest.mock('@org/core', () => ({
  SEARCH_PROVIDER_TOKEN: Symbol('SEARCH_PROVIDER'),
  REDIS_CLIENT: 'REDIS_CLIENT',
}));

import { SearchService } from '../search.service';

const user = (overrides: Partial<UserSearchResult> = {}): UserSearchResult => ({
  id: '0197f96c-b278-7f64-a32f-d44a57f6726b',
  name: 'alice',
  displayName: null,
  avatarUrl: null,
  ...overrides,
});

describe('SearchService', () => {
  let provider: {
    configureIndex: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    getById: jest.Mock;
    search: jest.Mock;
    clearIndex: jest.Mock;
    bulkUpsert: jest.Mock;
  };
  let redis: { set: jest.Mock; del: jest.Mock };
  let service: SearchService;
  let logger: { log: jest.Mock; warn: jest.Mock };

  beforeEach(() => {
    provider = {
      configureIndex: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      search: jest.fn(),
      clearIndex: jest.fn(),
      bulkUpsert: jest.fn(),
    };
    redis = { set: jest.fn(), del: jest.fn() };
    service = new SearchService(provider as unknown as ISearchProvider, redis as never);
    logger = { log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it('indexes a user on registered/updated (upsert is idempotent)', async () => {
    await service.indexUser(user());
    expect(provider.upsert).toHaveBeenCalledWith('users', user());
  });

  it('serializes concurrent reindexes with a Redis lock', async () => {
    redis.set.mockResolvedValueOnce('OK');
    await service.reindexUsers([user()]);
    expect(redis.set).toHaveBeenCalledWith(
      'search:reindex:lock',
      expect.any(String),
      'EX',
      300,
      'NX',
    );
    expect(provider.clearIndex).toHaveBeenCalledWith('users');
    expect(provider.bulkUpsert).toHaveBeenCalledWith('users', [user()]);
    expect(redis.del).toHaveBeenCalledWith('search:reindex:lock');
  });

  it('skips reindex when the lock is held', async () => {
    redis.set.mockResolvedValueOnce(null);
    await service.reindexUsers([user()]);
    expect(provider.clearIndex).not.toHaveBeenCalled();
    expect(provider.bulkUpsert).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('never writes raw identifiers to logs', async () => {
    redis.set.mockResolvedValueOnce('OK');
    await service.indexUser({ ...user(), id: 'user-secret-id', name: 'secret-name' });
    await service.removeUser('user-secret-id');
    const payload = JSON.stringify([logger.log.mock.calls, logger.warn.mock.calls]);
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('secret-name');
  });
});
