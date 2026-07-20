import * as z from 'zod';

export const markChatReadSchema = z.object({
  messageId: z.string().uuid().nullable().optional(),
});

export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;
