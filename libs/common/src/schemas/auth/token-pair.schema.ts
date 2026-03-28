import * as z from 'zod';

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type TokenPair = z.infer<typeof tokenPairSchema>;
