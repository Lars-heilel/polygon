import { updateUserSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
