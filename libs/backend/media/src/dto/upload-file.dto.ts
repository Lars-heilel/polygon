import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const uploadFileSchema = z.object({
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
});

export class UploadFileDto extends createZodDto(uploadFileSchema) {}
