import * as z from 'zod';

export const oauthLoginSchema = z.object({
  provider: z.string(),
  providerId: z.string(),
  email: z.email(),
  name: z.string(),
});

export type OAuthLoginDto = z.infer<typeof oauthLoginSchema>;
