import * as z from 'zod';

import { PASSWORD_REGEX } from '../../constants';

export const forgotPasswordSchema = z.object({
  email: z.email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)',
    )
    .max(128),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
