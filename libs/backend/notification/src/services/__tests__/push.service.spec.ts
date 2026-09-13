import type { ConfigService } from '@nestjs/config';
import type { Env } from '@org/core';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import type {
  IPushSubscriptionRepository,
  PushSubscriptionRecord,
} from '../../interfaces/notification.interface';
import { PushService } from '../push.service';

const record = (overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord => ({
  id: 'sub-1',
  userId: 'user-1',
  endpoint: 'https://push.example.test/a',
  p256dh: 'k',
  auth: 'a',
  createdAt: new Date('2026-09-13T00:00:00.000Z'),
  updatedAt: new Date('2026-09-13T00:00:00.000Z'),
  ...overrides,
});

describe('PushService', () => {
  let repo: {
    findByUserId: jest.Mock;
    findByEndpoint: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteByEndpoint: jest.Mock;
    upsertByEndpoint: jest.Mock;
  };
  let service: PushService;
  let logger: { log: jest.Mock; warn: jest.Mock; debug: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findByEndpoint: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteByEndpoint: jest.fn(),
      upsertByEndpoint: jest.fn(),
    };
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'public';
        if (key === 'VAPID_PRIVATE_KEY') return 'private';
        if (key === 'VAPID_SUBJECT') return 'mailto:test@example.test';
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };
    service = new PushService(
      repo as unknown as IPushSubscriptionRepository,
      config as unknown as ConfigService<Env>,
    );
    logger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });
  });

  it('subscribes with a single upsert so redelivery is safe', async () => {
    repo.upsertByEndpoint.mockResolvedValue(record());
    await service.subscribe('user-1', {
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
    });
    expect(repo.upsertByEndpoint).toHaveBeenCalledWith({
      userId: 'user-1',
      endpoint: 'https://push.example.test/a',
      p256dh: 'k',
      auth: 'a',
    });
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('unsubscribes only its own endpoint', async () => {
    repo.findByEndpoint.mockResolvedValue(record({ userId: 'other' }));
    await service.unsubscribe('user-1', 'https://push.example.test/a');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('never writes raw identifiers to logs', async () => {
    repo.upsertByEndpoint.mockResolvedValue(record());
    await service.subscribe('user-secret-id', {
      endpoint: 'https://push.example.test/secret-endpoint',
      p256dh: 'p256dh-secret-key',
      auth: 'auth-secret-key',
    });
    const payload = JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.debug.mock.calls,
      logger.error.mock.calls,
    ]);
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('secret-endpoint');
    expect(payload).not.toContain('p256dh-secret-key');
    expect(payload).not.toContain('auth-secret-key');
  });
});
