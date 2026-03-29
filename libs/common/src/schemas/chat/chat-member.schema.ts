import * as z from 'zod';
import { chatRoleSchema } from './chat.schema';

export const chatMemberSchema = z.object({
  chatId: z.uuid(),
  userId: z.uuid(),
  role: chatRoleSchema,
  joinedAt: z.date(),
});

export type ChatMember = z.infer<typeof chatMemberSchema>;
