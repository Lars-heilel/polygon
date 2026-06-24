import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const fileResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.date(),
});

export class FileResponseDto extends createZodDto(fileResponseSchema) {}
