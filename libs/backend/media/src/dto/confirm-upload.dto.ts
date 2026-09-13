import { confirmUploadSchema } from '@org/common';
import { createZodDto } from 'nestjs-zod';

export class ConfirmUploadDto extends createZodDto(confirmUploadSchema) {}
