import * as z from 'zod';

import { messageSchema } from './message.schema';

export const messagesDeltaQuerySchema = z.object({
  since: z.coerce.date(),
  sinceId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesDeltaQuery = z.infer<typeof messagesDeltaQuerySchema>;

export const messagesDeltaResponseSchema = z.object({
  messages: z.array(messageSchema),
  deletedIds: z.array(z.string()),
});
export type MessagesDelta = z.infer<typeof messagesDeltaResponseSchema>;
