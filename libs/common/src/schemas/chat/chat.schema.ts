import * as z from 'zod';

export const chatTypeSchema = z.enum(['DIRECT', 'GROUP', 'CHANNEL']);
export const chatRoleSchema = z.enum(['ADMIN', 'MODERATOR', 'MEMBER']);

export type ChatType = z.infer<typeof chatTypeSchema>;
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatSchema = z.object({
  id: z.uuid(),
  type: chatTypeSchema,
  name: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  selfOwnerId: z.uuid().nullable(),
  lastMessageId: z.uuid().nullable(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Chat = z.infer<typeof chatSchema>;
