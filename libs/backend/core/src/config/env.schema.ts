import * as z from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  AUTH_DATABASE_URL: z.url(),
  USER_DATABASE_URL: z.url(),
  CHAT_DATABASE_URL: z.url(),
  NOTIFICATION_DATABASE_URL: z.url(),
  MEDIA_DATABASE_URL: z.url(),

  // MinIO
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_USE_SSL: z.preprocess((v) => v === 'true' || v === true || v === '1' || v === 1, z.boolean()).default(false),
  MINIO_PUBLIC_BUCKET: z.string().default('polygon-avatars'),
  MINIO_PUBLIC_ENDPOINT: z.string().default('http://localhost:9000'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_EXPIRES: z.coerce.number(),
  JWT_REFRESH_TOKEN_EXPIRES: z.coerce.number(),

  // RabbitMQ
  RABBITMQ_URL: z.url(),

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string(),

  // SMTP
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_FROM: z.string().min(1),

  // Search
  MEILISEARCH_URL: z.url(),
  MEILISEARCH_MASTER_KEY: z.string().min(1),
  SEARCH_PORT: z.coerce.number(),

  // Ports (per service)
  GATEWAY_PORT: z.coerce.number(),
  AUTH_PORT: z.coerce.number(),
  USER_PORT: z.coerce.number(),
  CHAT_PORT: z.coerce.number(),
  MEDIA_PORT: z.coerce.number(),
  NOTIFICATION_PORT: z.coerce.number(),

  // App
  APP_URL: z.url(),
  CLIENT_URL: z.url(),

  // OAuth
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  YANDEX_CLIENT_ID: z.string(),
  YANDEX_CLIENT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
});

export type Env = z.infer<typeof envSchema>;
