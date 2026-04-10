import * as z from 'zod';

export const resendVerificationSchema = z.object({
  email: z.email(),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
