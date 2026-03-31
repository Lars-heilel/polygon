import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateDirectChatSchema = z.object({
  targetUserId: z.string().uuid(),
});

export class CreateDirectChatDto extends createZodDto(CreateDirectChatSchema) {}
