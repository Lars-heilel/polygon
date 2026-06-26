import { z } from 'zod';

export const fileStatusSchema = z.enum(['PENDING', 'READY']);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const fileCategorySchema = z.enum(['AVATAR', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'VOICE', 'CIRCLE']);
export type FileCategory = z.infer<typeof fileCategorySchema>;

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
  category: fileCategorySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type File = z.infer<typeof fileSchema>;
