import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

export class ResendVerificationDto extends createZodDto(ResendVerificationSchema) {}
