import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { fileCategorySchema } from '@org/common';

export const fileResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  bucket: z.string(),
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  category: fileCategorySchema,
  createdAt: z.date(),
});

export class FileResponseDto extends createZodDto(fileResponseSchema) {}
