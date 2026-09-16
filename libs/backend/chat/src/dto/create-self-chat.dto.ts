import { createSelfChatSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class CreateSelfChatDto extends createZodDto(createSelfChatSchema) {}
