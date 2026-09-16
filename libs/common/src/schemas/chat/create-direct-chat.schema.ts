import * as z from 'zod';

export const createDirectChatSchema = z.object({
  targetUserId: z.uuid(),
  e2eeEnabled: z.boolean().optional(),
});

export type CreateDirectChatInput = z.infer<typeof createDirectChatSchema>;
