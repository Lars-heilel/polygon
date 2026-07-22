import * as z from 'zod';
import { messageTypeSchema } from './message.schema';

const sendMessageAttachmentSchema = z.object({
  mediaId: z.string().uuid(),
  fileNameSnapshot: z.string().nullable().optional(),
  fileSizeSnapshot: z.number().int().positive().nullable().optional(),
  mimeSnapshot: z.string().nullable().optional(),
  category: z.string(),
});

export const sendMessageSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  type: messageTypeSchema.default('TEXT'),
  text: z.string().max(4000).nullable().optional(),
  attachments: z.array(sendMessageAttachmentSchema).max(10).optional(),
  fileId: z.string().uuid().nullable().optional(),
  fileBucket: z.string().nullable().optional(),
  fileKey: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  fileSize: z.number().int().positive().nullable().optional(),
  fileMime: z.string().nullable().optional(),
  fileCategory: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.type === 'SYSTEM') return true;
    if (data.type === 'TEXT') return !!data.text;
    return !!data.fileId || !!data.attachments?.length;
  },
  { message: 'File messages require fileId, text messages require text' },
);

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
