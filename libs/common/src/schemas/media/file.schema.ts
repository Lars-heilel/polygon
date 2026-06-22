import { z } from 'zod';

export const fileSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string(),
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  url: z.string(),
  uploaderId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type File = z.infer<typeof fileSchema>;
