import * as z from 'zod';

export const refreshTokenSchema = z.object({
  id: z.uuid(),
  tokenHash: z.string(),
  credentialsId: z.string().uuid(),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type RefreshToken = z.infer<typeof refreshTokenSchema>;
