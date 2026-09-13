import { mock } from 'jest-mock-extended';

import type { IUserRepository } from '../../interfaces/user.interface';
import { mockUserReturn } from '../../__tests__/fixtures/user.fixtures';
import { UserService } from '../user.service';

describe('UserService cache', () => {
  const repoMock = mock<IUserRepository>();
  const redisMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  let service: UserService;
  let logger: { debug: jest.Mock; log: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new UserService(repoMock, redisMock as never);
    logger = { debug: jest.fn(), log: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it('serves getById from cache on hit', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify(mockUserReturn));
    await expect(service.getById('user-1')).resolves.toEqual(
      JSON.parse(JSON.stringify(mockUserReturn)),
    );
    expect(repoMock.findById).not.toHaveBeenCalled();
  });

  it('fills cache on miss and invalidates on update', async () => {
    redisMock.get.mockResolvedValue(null);
    repoMock.findById.mockResolvedValue(mockUserReturn);
    await service.getById('user-1');
    expect(redisMock.set).toHaveBeenCalledWith(
      'user:profile:user-1',
      expect.any(String),
      'EX',
      60,
    );
    repoMock.update.mockResolvedValue(mockUserReturn);
    await service.update('user-1', { displayName: 'New' });
    expect(redisMock.del).toHaveBeenCalledWith('user:profile:user-1');
  });

  it('falls back to repo when Redis is down', async () => {
    redisMock.get.mockRejectedValue(new Error('down'));
    repoMock.findById.mockResolvedValue(mockUserReturn);
    await expect(service.getById('user-1')).resolves.toEqual(mockUserReturn);
  });

  it('never writes raw identifiers to logs', async () => {
    redisMock.get.mockResolvedValue(null);
    repoMock.findById.mockResolvedValue(null);
    await expect(service.getById('user-secret-id')).rejects.toThrow();
    repoMock.upsert.mockResolvedValue({
      id: 'user-secret-id',
      name: 'secret-name',
      displayName: null,
      avatarUrl: null,
      bio: null,
    });
    await service.createFromEvent({
      id: 'user-secret-id',
      email: 'secret@example.com',
      name: 'secret-name',
    });
    const payload = JSON.stringify([logger.debug.mock.calls, logger.log.mock.calls]);
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('secret@example.com');
    expect(payload).not.toContain('secret-name');
  });
});
