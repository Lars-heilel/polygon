import * as z from 'zod';

export const BaseSessionSchema = z.object({
  id: z.uuid(),
  device: z.string().max(64).nullable(),
  os: z.string().max(64).nullable(),
  browser: z.string().max(64).nullable(),
  ip: z.string().max(45).nullable(),
  country: z.string().max(2).nullable(),
  lastActiveAt: z.date().nullable(),
  createdAt: z.date(),
});

export const SessionResponseSchema = BaseSessionSchema.extend({
  isCurrent: z.boolean(),
});

export const DatabaseSessionSchema = BaseSessionSchema.extend({
  tokenHash: z.string(),
  credentialsId: z.string(),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  userAgent: z.string().max(512).nullable(),
});

export type DatabaseSession = z.infer<typeof DatabaseSessionSchema>;
