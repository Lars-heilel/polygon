import type { ClientProxy } from '@nestjs/microservices';
import { CHAT_PATTERNS, MEDIA_PATTERNS, type IStorageProvider } from '@org/core';
import { of, throwError } from 'rxjs';

type MediaGatewayControllerConstructor = typeof import('./media.controller').MediaGatewayController;

describe('MediaGatewayController link previews', () => {
  let MediaGatewayController: MediaGatewayControllerConstructor;

  beforeAll(() => {
    Object.assign(process.env, {
      AUTH_DATABASE_URL: 'postgres://user:pass@localhost:5432/auth',
      USER_DATABASE_URL: 'postgres://user:pass@localhost:5432/user',
      CHAT_DATABASE_URL: 'postgres://user:pass@localhost:5432/chat',
      NOTIFICATION_DATABASE_URL: 'postgres://user:pass@localhost:5432/notification',
      MEDIA_DATABASE_URL: 'postgres://user:pass@localhost:5432/media',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ACCESS_KEY: 'minio',
      MINIO_SECRET_KEY: 'minio-secret',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret-refresh-secret-refresh-secret',
      JWT_ACCESS_TOKEN_EXPIRES: '900',
      JWT_REFRESH_TOKEN_EXPIRES: '604800',
      RABBITMQ_URL: 'amqp://localhost',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: '',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
      VAPID_SUBJECT: 'mailto:test@example.com',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_USER: 'smtp',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'test@example.com',
      MEILISEARCH_URL: 'http://localhost:7700',
      MEILISEARCH_MASTER_KEY: 'master-key',
      SEARCH_PORT: '3006',
      GATEWAY_PORT: '3000',
      AUTH_PORT: '3002',
      USER_PORT: '3001',
      CHAT_PORT: '3003',
      MEDIA_PORT: '3004',
      NOTIFICATION_PORT: '3005',
      APP_URL: 'http://localhost:3000',
      CLIENT_URL: 'http://localhost:4200',
      GITHUB_CLIENT_ID: 'github-client',
      GITHUB_CLIENT_SECRET: 'github-secret',
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    ({ MediaGatewayController } = jest.requireActual('./media.controller') as {
      MediaGatewayController: MediaGatewayControllerConstructor;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the YouTube fallback without fetching the page', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch should not run'));
    const controller = new MediaGatewayController(
      {} as ClientProxy,
      {} as ClientProxy,
      {} as unknown as IStorageProvider,
      {} as ClientProxy,
    );

    const preview = await controller.getLinkPreview('https://www.youtube.com/watch?v=dKmPEhJ4wjY');

    expect(preview).toMatchObject({
      imageUrl: 'https://i.ytimg.com/vi/dKmPEhJ4wjY/hqdefault.jpg',
      siteName: 'YouTube',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('MediaGatewayController chat attachment content', () => {
  let MediaGatewayController: MediaGatewayControllerConstructor;

  beforeAll(() => {
    ({ MediaGatewayController } = jest.requireActual('./media.controller') as {
      MediaGatewayController: MediaGatewayControllerConstructor;
    });
  });

  function controller() {
    const mediaClient = { send: jest.fn() };
    const chatClient = { send: jest.fn() };
    const storage = {
      getFileStream: jest.fn().mockResolvedValue({
        stream: {
          pipe: jest.fn().mockReturnValue({ on: jest.fn() }),
        },
        size: 33000,
        contentType: 'audio/ogg',
      }),
    };

    return {
      controller: new MediaGatewayController(
        mediaClient as unknown as ClientProxy,
        chatClient as unknown as ClientProxy,
        storage as unknown as IStorageProvider,
        {} as ClientProxy,
      ),
      mediaClient,
      chatClient,
      storage,
    };
  }

  function reqMock() {
    return { headers: {} };
  }

  function resMock() {
    const res = {
      headersSent: false,
      status: jest.fn(),
      end: jest.fn(),
      setHeader: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  }

  it('serves chat attachment content only after chat-scoped access succeeds', async () => {
    const ctx = controller();
    const chatId = '22222222-2222-4222-8222-222222222222';
    const messageId = '11111111-1111-4111-8111-111111111111';
    const attachmentId = '44444444-4444-4444-8444-444444444444';
    const userId = '33333333-3333-4333-8333-333333333333';
    const mediaId = '55555555-5555-4555-8555-555555555555';
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(ctx.controller, 'logger', { value: logger });
    ctx.chatClient.send.mockReturnValueOnce(of({ mediaId }));
    ctx.mediaClient.send.mockReturnValueOnce(of({
      id: mediaId,
      bucket: 'chat-media',
      key: 'voice.ogg',
      mimeType: 'audio/ogg',
      size: 33000,
      chatId,
    }));

    await (
      ctx.controller as typeof ctx.controller & {
        getChatAttachmentContent: (
          chatId: string,
          messageId: string,
          attachmentId: string,
          user: { sub: string },
          req: ReturnType<typeof reqMock>,
          res: ReturnType<typeof resMock>,
        ) => Promise<void>;
      }
    ).getChatAttachmentContent(chatId, messageId, attachmentId, { sub: userId }, reqMock(), resMock());

    expect(ctx.chatClient.send).toHaveBeenCalledWith(
      CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS,
      { chatId, messageId, attachmentId, userId },
    );
    expect(ctx.mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.GET_BY_ID, { id: mediaId });
    expect(ctx.storage.getFileStream).toHaveBeenCalledWith('chat-media', 'voice.ogg', undefined);

    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain(chatId);
    expect(diagnosticPayload).not.toContain(messageId);
    expect(diagnosticPayload).not.toContain(attachmentId);
    expect(diagnosticPayload).not.toContain(userId);
    expect(diagnosticPayload).not.toContain(mediaId);
    expect(diagnosticPayload).not.toContain('voice.ogg');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message_attachment_content_requested',
        hasChatId: true,
        hasMessageId: true,
        hasAttachmentId: true,
        hasUserId: true,
      }),
    );
  });

  it('does not stream media when chat-scoped access is denied', async () => {
    const ctx = controller();
    const chatId = '22222222-2222-4222-8222-222222222222';
    const messageId = '11111111-1111-4111-8111-111111111111';
    const attachmentId = '44444444-4444-4444-8444-444444444444';
    const userId = '33333333-3333-4333-8333-333333333333';
    const logger = { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.defineProperty(ctx.controller, 'logger', { value: logger });
    ctx.chatClient.send.mockReturnValueOnce(throwError(() => ({ statusCode: 403, message: 'Forbidden' } as never)));

    await expect(
      (
        ctx.controller as typeof ctx.controller & {
          getChatAttachmentContent: (
            chatId: string,
            messageId: string,
            attachmentId: string,
            user: { sub: string },
            req: ReturnType<typeof reqMock>,
            res: ReturnType<typeof resMock>,
          ) => Promise<void>;
        }
      ).getChatAttachmentContent(chatId, messageId, attachmentId, { sub: userId }, reqMock(), resMock()),
    ).rejects.toMatchObject({ status: 403 });

    expect(ctx.chatClient.send).toHaveBeenCalledWith(
      CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS,
      { chatId, messageId, attachmentId, userId },
    );
    expect(ctx.mediaClient.send).not.toHaveBeenCalled();
    expect(ctx.storage.getFileStream).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'message_attachment_content_denied',
        hasChatId: true,
        hasMessageId: true,
        hasAttachmentId: true,
        hasUserId: true,
        status: 403,
        reason: 'chat_access_denied',
      }),
    );
    const diagnosticPayload = JSON.stringify([
      logger.debug.mock.calls,
      logger.error.mock.calls,
      logger.log.mock.calls,
      logger.warn.mock.calls,
    ]);
    expect(diagnosticPayload).not.toContain(chatId);
    expect(diagnosticPayload).not.toContain(messageId);
    expect(diagnosticPayload).not.toContain(attachmentId);
    expect(diagnosticPayload).not.toContain(userId);
  });

  it('still serves the raw file content route through the shared streaming helper', async () => {
    const ctx = controller();
    const fileId = '55555555-5555-4555-8555-555555555555';
    const userId = '33333333-3333-4333-8333-333333333333';
    ctx.mediaClient.send.mockReturnValueOnce(of({
      id: fileId,
      bucket: 'media-bucket',
      key: 'file.bin',
      mimeType: 'application/octet-stream',
      size: 10,
      chatId: null,
    }));

    await (
      ctx.controller as typeof ctx.controller & {
        getFileContent: (
          fileId: string,
          user: { sub: string },
          req: ReturnType<typeof reqMock>,
          res: ReturnType<typeof resMock>,
        ) => Promise<void>;
      }
    ).getFileContent(fileId, { sub: userId }, reqMock(), resMock());

    expect(ctx.mediaClient.send).toHaveBeenCalledWith(MEDIA_PATTERNS.GET_BY_ID, { id: fileId });
    expect(ctx.chatClient.send).not.toHaveBeenCalledWith(
      CHAT_PATTERNS.GET_MESSAGE_ATTACHMENT_FOR_ACCESS,
      expect.anything(),
    );
    expect(ctx.storage.getFileStream).toHaveBeenCalledWith('media-bucket', 'file.bin', undefined);
  });
});
