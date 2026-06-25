import * as z from 'zod';

export const forwardMessageSchema = z.object({
  sourceChatId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1).max(50),
});

export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;
