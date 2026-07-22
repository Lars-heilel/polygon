import * as z from 'zod';

export const messageTypeSchema = z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM']);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const messageAttachmentSchema = z.object({
  id: z.uuid(),
  messageId: z.uuid(),
  mediaId: z.uuid(),
  fileNameSnapshot: z.string().nullable(),
  fileSizeSnapshot: z.number().int().positive().nullable(),
  mimeSnapshot: z.string().nullable(),
  category: z.string(),
  createdAt: z.date(),
});
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

export const messageForwardContextSchema = z.object({
  messageId: z.uuid(),
  originalMessageId: z.uuid().nullable(),
  originalChatId: z.uuid().nullable(),
  originalAuthorId: z.uuid(),
  originalAuthorNameSnapshot: z.string().min(1),
  originalAuthorDisplayNameSnapshot: z.string().nullable(),
  originalMessageCreatedAt: z.date(),
  originalMessageType: messageTypeSchema,
  originalTextPreview: z.string().nullable(),
  originalFileNamePreview: z.string().nullable(),
  snapshotVersion: z.number().int().positive(),
  createdAt: z.date(),
});
export type MessageForwardContext = z.infer<typeof messageForwardContextSchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  clientId: z.string().uuid().nullable(),
  chatId: z.uuid(),
  senderId: z.uuid(),
  type: messageTypeSchema,
  text: z.string().nullable(),
  attachments: z.array(messageAttachmentSchema).default([]),
  forwardContext: messageForwardContextSchema.nullable().default(null),
  editedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
  deletedById: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

export type MessagePage = {
  messages: Message[];
  nextCursor: string | null;
};
