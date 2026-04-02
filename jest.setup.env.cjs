/**
 * Minimal environment variables required for NestJS ConfigModule schema validation.
 * Used in unit test suites (setupFiles) so that @org/core barrel can be imported
 * without ConfigModule.forRoot() throwing on missing required vars.
 * All actual services are mocked in unit tests — these values are never used at runtime.
 */
'use strict';

process.env['AUTH_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_auth';
process.env['USER_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_user';
process.env['CHAT_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_chat';
process.env['NOTIFICATION_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_notification';
process.env['MEDIA_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_media';

process.env['JWT_ACCESS_SECRET'] = 'unit_test_access_secret_min_32_chars_xxxx';
process.env['JWT_REFRESH_SECRET'] = 'unit_test_refresh_secret_min_32_chars_xxx';

process.env['RABBITMQ_PASSWORD'] = 'test_password';

process.env['MEILISEARCH_MASTER_KEY'] = 'test_meilisearch_key';
