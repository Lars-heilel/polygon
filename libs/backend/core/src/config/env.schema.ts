import * as z from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  AUTH_DATABASE_URL: z.string(),
  USER_DATABASE_URL: z.string(),
  CHAT_DATABASE_URL: z.string(),
  NOTIFICATION_DATABASE_URL: z.string(),
  MEDIA_DATABASE_URL: z.string(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_EXPIRES: z.coerce.number().default(900),
  JWT_REFRESH_TOKEN_EXPIRES: z.coerce.number().default(604800),

  // RabbitMQ
  RABBITMQ_HOST: z.string().default('localhost'),
  RABBITMQ_PORT: z.coerce.number().default(5672),
  RABBITMQ_USER: z.string().default('polygon'),
  RABBITMQ_PASSWORD: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Ports
  GATEWAY_PORT: z.coerce.number().default(3000),
  AUTH_PORT: z.coerce.number().default(3002),
  USER_PORT: z.coerce.number().default(3001),
  NOTIFICATION_PORT: z.coerce.number().default(3005),

  // SMTP
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Polygon <noreply@polygon.app>'),

  // App
  APP_URL: z.string().default('http://localhost:3000'),
  CLIENT_URL: z.string().default('http://localhost:4200'),

  // OAuth — GitHub
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // OAuth — Yandex
  YANDEX_CLIENT_ID: z.string().optional(),
  YANDEX_CLIENT_SECRET: z.string().optional(),

  // OAuth — Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
