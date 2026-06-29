import * as z from 'zod';

export const sessionSchema = z.object({
  id: z.string().uuid(),
  device: z.string().nullable(),
  os: z.string().nullable(),
  browser: z.string().nullable(),
  ip: z.string().nullable(),
  country: z.string().nullable(),
  isCurrent: z.boolean(),
  lastActiveAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type SessionInfo = z.infer<typeof sessionSchema>;
