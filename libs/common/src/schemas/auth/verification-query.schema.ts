import * as z from 'zod';

export const verifyEmailQuerySchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailQueryInput = z.infer<typeof verifyEmailQuerySchema>;
