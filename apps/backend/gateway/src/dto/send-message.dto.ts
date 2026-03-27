import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SendMessageSchema = z.object({
  text: z.string().min(1).max(4000),
});

export class SendMessageDto extends createZodDto(SendMessageSchema) {}
