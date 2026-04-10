import * as z from 'zod';

export const createDirectChatSchema = z.object({
  targetUserId: z.uuid(),
});

export type CreateDirectChatInput = z.infer<typeof createDirectChatSchema>;
