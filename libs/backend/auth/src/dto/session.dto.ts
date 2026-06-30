import { DatabaseSessionSchema, SessionResponseSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class DatabaseSession extends createZodDto(DatabaseSessionSchema) {}
export class SessionResponse extends createZodDto(SessionResponseSchema) {}
