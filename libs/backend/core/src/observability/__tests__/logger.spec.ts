import { createLoggerOptions } from '../logger';

const ORIGINAL_ENV = process.env;

interface LoggerOptionsWithRedaction {
  redact?: {
    paths?: string[];
  };
  serializers?: {
    req?: (request: { method?: string; url?: string; headers?: Record<string, string> }) => unknown;
  };
}

describe('createLoggerOptions', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('configures pino-pretty transport when LOG_FORMAT is pretty', () => {
    process.env['LOG_FORMAT'] = 'pretty';

    const options = createLoggerOptions('gateway');

    expect(options.pinoHttp).toMatchObject({
      transport: {
        target: 'pino-pretty',
        options: { singleLine: true, colorize: true },
      },
    });
  });

  it('redacts common direct, nested, request body, and request header sensitive keys', () => {
    const options = createLoggerOptions('gateway');
    const pinoHttp = options.pinoHttp as LoggerOptionsWithRedaction;

    expect(pinoHttp.redact?.paths).toEqual(
      expect.arrayContaining([
        'token',
        'tokens',
        'accessToken',
        'refreshToken',
        'accessKey',
        'password',
        'adminPassword',
        'newPassword',
        'confirmPassword',
        'passwordHash',
        'tokenHash',
        'newTokenHash',
        'secret',
        'authorization',
        'cookie',
        '*.token',
        '*.tokens',
        '*.accessToken',
        '*.refreshToken',
        '*.accessKey',
        '*.password',
        '*.adminPassword',
        '*.newPassword',
        '*.confirmPassword',
        '*.passwordHash',
        '*.tokenHash',
        '*.newTokenHash',
        '*.secret',
        '*.authorization',
        '*.cookie',
        '*.*.token',
        '*.*.tokens',
        '*.*.accessToken',
        '*.*.refreshToken',
        '*.*.accessKey',
        '*.*.password',
        '*.*.adminPassword',
        '*.*.newPassword',
        '*.*.confirmPassword',
        '*.*.passwordHash',
        '*.*.tokenHash',
        '*.*.newTokenHash',
        '*.*.secret',
        '*.*.authorization',
        '*.*.cookie',
        'req.headers.cookie',
        'req.headers.authorization',
        'req.body.password',
        'req.body.adminPassword',
        'req.body.newPassword',
        'req.body.confirmPassword',
        'req.body.passwordHash',
        'req.body.accessToken',
        'req.body.refreshToken',
        'req.body.accessKey',
        'req.body.token',
        'req.body.tokens',
        'req.body.tokenHash',
        'req.body.newTokenHash',
        'req.body.secret',
        'REDIS_PASSWORD',
        'MEILISEARCH_MASTER_KEY',
        'GITHUB_CLIENT_SECRET',
        'GOOGLE_CLIENT_SECRET',
        'AUTH_DATABASE_URL',
        'USER_DATABASE_URL',
        'CHAT_DATABASE_URL',
        'NOTIFICATION_DATABASE_URL',
        'MEDIA_DATABASE_URL',
        'RABBITMQ_URL',
        'MINIO_ACCESS_KEY',
        'POSTGRES_PASSWORD',
        'RABBITMQ_PASSWORD',
        'GRAFANA_ADMIN_PASSWORD',
        'SMTP_PASSWORD',
        'MINIO_SECRET_KEY',
        'VAPID_PRIVATE_KEY',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
      ]),
    );
  });

  it('removes query strings from request URLs before access logging', () => {
    const options = createLoggerOptions('gateway');
    const pinoHttp = options.pinoHttp as LoggerOptionsWithRedaction;

    const serialized = pinoHttp.serializers?.req?.({
      method: 'GET',
      url: '/api/auth/verify-email?token=secret-token&code=oauth-code',
      headers: { host: 'localhost' },
    }) as { url?: string };

    expect(serialized.url).toBe('/api/auth/verify-email');
  });
});
