import { createDirectChatSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class CreateDirectChatDto extends createZodDto(createDirectChatSchema) {}
