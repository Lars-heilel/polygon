import { resendVerificationSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
