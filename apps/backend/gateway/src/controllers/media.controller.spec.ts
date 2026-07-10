import type { ClientProxy } from '@nestjs/microservices';
import type { IStorageProvider } from '@org/core';

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
      YANDEX_CLIENT_ID: 'yandex-client',
      YANDEX_CLIENT_SECRET: 'yandex-secret',
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
