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
  directKey: z.string().max(128).nullable().optional(),
  // E2EE marker: only chats with e2eeEnabled send ciphertext. Optional so
  // legacy rows/fixtures without the column keep parsing; group sends in
  // enabled chats never silently fall back to plaintext (E2EE_NO_RECIPIENT_KEYS).
  e2eeEnabled: z.boolean().optional(),
  lastMessageId: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Chat = z.infer<typeof chatSchema>;
