import type { PushPayload, PushSubscriptionData } from '../../interfaces/notification.interface';
import type { PushService } from '../../services/push.service';

jest.mock('@org/core', () => ({
  NOTIFICATION_EVENTS: {
    SEND_VERIFICATION_EMAIL: 'notification.send-verification-email',
    SEND_PASSWORD_RESET: 'notification.send-password-reset',
    SEND_PUSH: 'notification.send-push',
    PUSH_SUBSCRIBE: 'notification.push-subscribe',
    PUSH_UNSUBSCRIBE: 'notification.push-unsubscribe',
  },
}));

import { PushController } from '../push.controller';

describe('PushController', () => {
  let pushService: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
    send: jest.Mock;
  };
  let controller: PushController;
  let logger: { log: jest.Mock; warn: jest.Mock; debug: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    pushService = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      send: jest.fn().mockResolvedValue([]),
    };
    controller = new PushController(pushService as unknown as PushService);
    logger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
    Object.defineProperty(controller, 'logger', { value: logger });
  });

  function loggedPayload(): string {
    return JSON.stringify([
      logger.log.mock.calls,
      logger.warn.mock.calls,
      logger.debug.mock.calls,
      logger.error.mock.calls,
    ]);
  }

  it('does not write raw identifiers on subscribe', async () => {
    const subscription: PushSubscriptionData = {
      endpoint: 'https://push.example.test/subscription-secret-endpoint',
      p256dh: 'p256dh-secret-key',
      auth: 'auth-secret-key',
    };
    await controller.subscribe({ userId: 'user-secret-id', subscription });

    expect(pushService.subscribe).toHaveBeenCalledWith('user-secret-id', subscription);
    const payload = loggedPayload();
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('subscription-secret-endpoint');
    expect(payload).not.toContain('p256dh-secret-key');
    expect(payload).not.toContain('auth-secret-key');
  });

  it('does not write raw identifiers on unsubscribe', async () => {
    await controller.unsubscribe({
      userId: 'user-secret-id',
      endpoint: 'https://push.example.test/unsubscribe-secret-endpoint',
    });

    expect(pushService.unsubscribe).toHaveBeenCalledWith(
      'user-secret-id',
      'https://push.example.test/unsubscribe-secret-endpoint',
    );
    const payload = loggedPayload();
    expect(payload).not.toContain('user-secret-id');
    expect(payload).not.toContain('unsubscribe-secret-endpoint');
  });

  it('does not dump the push payload on send', async () => {
    const payload: PushPayload = {
      userId: 'user-secret-id',
      title: 'secret-title',
      body: 'secret-body',
      data: { chatId: 'chat-secret-id' },
    };
    await controller.sendPush(payload);

    expect(pushService.send).toHaveBeenCalledWith('user-secret-id', payload);
    const logged = loggedPayload();
    expect(logged).not.toContain('user-secret-id');
    expect(logged).not.toContain('secret-title');
    expect(logged).not.toContain('secret-body');
    expect(logged).not.toContain('chat-secret-id');
  });
});
