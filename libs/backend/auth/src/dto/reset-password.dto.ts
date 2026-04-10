import { forgotPasswordSchema, resetPasswordSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
