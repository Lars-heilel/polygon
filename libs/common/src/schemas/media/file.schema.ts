import { z } from 'zod';

export const fileStatusSchema = z.enum(['PENDING', 'READY', 'DELETING']);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const fileCategorySchema = z.enum([
  'AVATAR',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'FILE',
  'VOICE',
  'CIRCLE',
]);
export type FileCategory = z.infer<typeof fileCategorySchema>;

export const fileSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string().min(1).max(63),
  key: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  size: z.number().int().positive(),
  url: z.string().max(2048).nullable(),
  uploaderId: z.string().uuid().nullable(),
  status: fileStatusSchema,
  chatId: z.string().uuid().nullable(),
  category: fileCategorySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type File = z.infer<typeof fileSchema>;
