import * as z from 'zod';

export const editMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
