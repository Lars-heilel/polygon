import { z } from 'zod';

import { fileCategorySchema } from './file.schema';

export const initUploadSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  size: z.number().int().positive(),
  category: fileCategorySchema,
  chatId: z.string().uuid().optional(),
});
export type InitUploadInput = z.infer<typeof initUploadSchema>;

export const confirmUploadSchema = z.object({
  fileId: z.string().uuid(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
