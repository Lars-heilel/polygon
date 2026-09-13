import * as z from 'zod';

export const oauthLoginSchema = z.object({
  provider: z.string().min(1).max(32),
  providerId: z.string().min(1).max(128),
  email: z.email().max(254),
  name: z.string().min(2).max(32),
});

export type OAuthLoginDto = z.infer<typeof oauthLoginSchema>;
