import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

export class ResendVerificationDto extends createZodDto(ResendVerificationSchema) {}
