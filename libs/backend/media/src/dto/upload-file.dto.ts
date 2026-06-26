import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { fileCategorySchema } from '@org/common';

export const MIME_TYPE_MAP: Record<string, RegExp> = {
  AVATAR: /^image\//,
  IMAGE: /^image\//,
  AUDIO: /^audio\//,
  VIDEO: /^video\//,
  FILE: /^(text\/|application\/)/,
  VOICE: /^audio\/(webm|ogg|mp4)/,
  CIRCLE: /^video\/(mp4|webm|quicktime)/,
};

export const FILE_SIZE_LIMITS: Record<string, number> = {
  AVATAR: 5 * 1024 * 1024,
  IMAGE: 20 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  FILE: 100 * 1024 * 1024,
  VOICE: 10 * 1024 * 1024,
  CIRCLE: 30 * 1024 * 1024,
};

export const uploadFileSchema = z.object({
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  category: fileCategorySchema,
}).refine(
  (data) => {
    const pattern = MIME_TYPE_MAP[data.category];
    return pattern ? pattern.test(data.mimeType) : true;
  },
  { message: 'MIME type does not match the specified category' },
).refine(
  (data) => {
    const limit = FILE_SIZE_LIMITS[data.category];
    return limit ? data.size <= limit : true;
  },
  { message: 'File size exceeds the limit for the specified category' },
);

export class UploadFileDto extends createZodDto(uploadFileSchema) {}
