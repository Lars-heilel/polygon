
import * as z from 'zod';

export const BaseSessionSchema = z.object({
  id: z.uuid(),
  device: z.string().nullable(),
  os: z.string().nullable(),
  browser: z.string().nullable(),
  ip: z.string().nullable(),
  country: z.string().nullable(),
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
  userAgent: z.string().nullable(),
});

