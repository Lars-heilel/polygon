import { deleteMessageSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class DeleteMessageDto extends createZodDto(deleteMessageSchema) {}
