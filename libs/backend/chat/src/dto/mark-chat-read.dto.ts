import { markChatReadSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class MarkChatReadDto extends createZodDto(markChatReadSchema) {}
