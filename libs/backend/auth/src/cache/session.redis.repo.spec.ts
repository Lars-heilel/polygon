import type Redis from 'ioredis';

import { SessionRedisRepository } from './session.redis.repo';

describe('SessionRedisRepository.removeAllForUser', () => {
  const transaction = { del: jest.fn(), exec: jest.fn() };
  const redis = { smembers: jest.fn(), multi: jest.fn(() => transaction) };
  const repository = new SessionRedisRepository(redis as unknown as Redis);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.del.mockReturnValue(transaction);
    transaction.exec.mockResolvedValue([]);
  });

  it('deletes every indexed session and the user session set in one transaction', async () => {
    redis.smembers.mockResolvedValue(['session-1', 'session-2']);

    await repository.removeAllForUser('user-1');

    expect(redis.smembers).toHaveBeenCalledWith('user_sessions:user-1');
    expect(transaction.del).toHaveBeenNthCalledWith(1, 'session:session-1');
    expect(transaction.del).toHaveBeenNthCalledWith(2, 'session:session-2');
    expect(transaction.del).toHaveBeenNthCalledWith(3, 'user_sessions:user-1');
    expect(transaction.exec).toHaveBeenCalledTimes(1);
  });

  it('still deletes the user session set and executes the transaction when it is empty', async () => {
    redis.smembers.mockResolvedValue([]);

    await repository.removeAllForUser('user-1');

    expect(transaction.del).toHaveBeenCalledTimes(1);
    expect(transaction.del).toHaveBeenCalledWith('user_sessions:user-1');
    expect(transaction.exec).toHaveBeenCalledTimes(1);
  });

  it('rejects when a transaction command fails', async () => {
    const commandError = new Error('Redis DEL failed');
    redis.smembers.mockResolvedValue(['session-1']);
    transaction.exec.mockResolvedValue([
      [commandError, null],
      [null, 1],
    ]);

    await expect(repository.removeAllForUser('user-1')).rejects.toBe(commandError);
  });
});
