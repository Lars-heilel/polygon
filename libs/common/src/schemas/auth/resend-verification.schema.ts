import * as z from 'zod';

export const resendVerificationSchema = z.object({
  email: z.email().max(254),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
