import { sendMessageSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
