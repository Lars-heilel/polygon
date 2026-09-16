import * as z from 'zod';

export const createSelfChatSchema = z.object({
  e2eeEnabled: z.boolean().optional(),
});

export type CreateSelfChatInput = z.infer<typeof createSelfChatSchema>;
