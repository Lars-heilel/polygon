import { editMessageSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class EditMessageDto extends createZodDto(editMessageSchema) {}
