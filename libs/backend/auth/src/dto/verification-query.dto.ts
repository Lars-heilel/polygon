import { verifyEmailQuerySchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class VerifyEmailQueryDto extends createZodDto(verifyEmailQuerySchema) {}
