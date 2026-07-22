import * as z from 'zod';

export const deleteMessageSchema = z.object({
  mode: z.enum(['ME', 'EVERYONE']),
});

export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
