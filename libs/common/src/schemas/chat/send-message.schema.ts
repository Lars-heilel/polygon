import * as z from 'zod';

export const sendMessageSchema = z.object({
  text: z.string().min(1).max(4000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
