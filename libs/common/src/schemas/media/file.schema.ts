import { z } from 'zod';

export const fileStatusSchema = z.enum(['PENDING', 'READY']);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const fileSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string(),
  key: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  url: z.string().nullable(),
  uploaderId: z.string().uuid().nullable(),
  status: fileStatusSchema,
  chatId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type File = z.infer<typeof fileSchema>;
