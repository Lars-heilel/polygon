import { loginSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class LoginDto extends createZodDto(loginSchema) {}
