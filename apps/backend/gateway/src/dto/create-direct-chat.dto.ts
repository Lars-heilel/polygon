import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateDirectChatSchema = z.object({
  targetUserId: z.string().uuid(),
});

export class CreateDirectChatDto extends createZodDto(CreateDirectChatSchema) {}
