import { sessionIdParamSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class SessionIdParamDto extends createZodDto(sessionIdParamSchema) {}
