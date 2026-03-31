import { PASSWORD_REGEX } from '@org/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, digits, and special characters (min 8 characters)',
    ),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
