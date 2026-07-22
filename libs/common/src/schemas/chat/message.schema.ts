import * as z from 'zod';

export const messageTypeSchema = z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM']);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  clientId: z.string().uuid().nullable(),
  chatId: z.uuid(),
  senderId: z.uuid(),
  type: messageTypeSchema,
  text: z.string().nullable(),
  fileId: z.string().uuid().nullable(),
  fileBucket: z.string().nullable(),
  fileKey: z.string().nullable(),
  fileName: z.string().nullable(),
  fileSize: z.number().int().positive().nullable(),
  fileMime: z.string().nullable(),
  fileCategory: z.string().nullable(),
  forwardedFromId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
};
