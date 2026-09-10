import type { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';

import { NOTIFICATION_EVENTS, type Env, type JwtPayload } from '@org/core';

import { NotificationGatewayController } from '../notification.controller';

describe('NotificationGatewayController', () => {
  let notificationClient: { emit: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let controller: NotificationGatewayController;
  let logger: {
    log: jest.Mock;
  };

  const user: JwtPayload & { email: string } = {
    sub: 'user-secret-id',
    sessionId: 'session-secret-id',
    jti: 'jti-secret-id',
    email: 'user@example.com',
    role: 'USER',
    isVerified: true,
  };

  beforeEach(() => {
    notificationClient = {
      emit: jest.fn(() => of(undefined)),
    };
    config = {
      getOrThrow: jest.fn((key: keyof Env) => {
        if (key === 'VAPID_PUBLIC_KEY') return 'public-key';
        throw new Error(`Unexpected config key: ${String(key)}`);
      }),
    };
    logger = {
      log: jest.fn(),
    };
    controller = new NotificationGatewayController(
      notificationClient as unknown as ClientProxy,
      config as unknown as ConfigService<Env>,
    );
    Object.defineProperty(controller, 'logger', { value: logger });
  });

  it('does not write raw push subscription identifiers to diagnostic logs', async () => {
    await controller.subscribe(user, {
      endpoint: 'https://push.example.test/subscription-secret-endpoint',
      p256dh: 'p256dh-secret-key',
      auth: 'auth-secret-key',
    });

    expect(notificationClient.emit).toHaveBeenCalledWith(NOTIFICATION_EVENTS.PUSH_SUBSCRIBE, {
      userId: 'user-secret-id',
      subscription: {
        endpoint: 'https://push.example.test/subscription-secret-endpoint',
        p256dh: 'p256dh-secret-key',
        auth: 'auth-secret-key',
      },
    });

    const diagnosticPayload = JSON.stringify(logger.log.mock.calls);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('user@example.com');
    expect(diagnosticPayload).not.toContain('subscription-secret-endpoint');
    expect(diagnosticPayload).not.toContain('p256dh-secret-key');
    expect(diagnosticPayload).not.toContain('auth-secret-key');
  });

  it('does not write raw unsubscribe identifiers to diagnostic logs', async () => {
    await controller.unsubscribe(user, {
      endpoint: 'https://push.example.test/unsubscribe-secret-endpoint',
    });

    expect(notificationClient.emit).toHaveBeenCalledWith(NOTIFICATION_EVENTS.PUSH_UNSUBSCRIBE, {
      userId: 'user-secret-id',
      endpoint: 'https://push.example.test/unsubscribe-secret-endpoint',
    });

    const diagnosticPayload = JSON.stringify(logger.log.mock.calls);
    expect(diagnosticPayload).not.toContain('user-secret-id');
    expect(diagnosticPayload).not.toContain('unsubscribe-secret-endpoint');
  });
});
