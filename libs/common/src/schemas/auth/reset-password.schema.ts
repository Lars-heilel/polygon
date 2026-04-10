import * as z from 'zod';

import { PASSWORD_REGEX } from '../../constants';

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)',
    ),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
