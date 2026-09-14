import * as z from 'zod';

export const markChatReadSchema = z.object({
  messageId: z.string().nullable().optional(),
});

export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;
