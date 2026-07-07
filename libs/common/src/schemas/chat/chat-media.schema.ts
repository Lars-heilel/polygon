import * as z from 'zod';

export const chatMediaFilterSchema = z.enum(['ALL', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'LINK']);

export const chatMediaQuerySchema = z.object({
  filter: chatMediaFilterSchema.default('ALL'),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export type ChatMediaFilter = z.infer<typeof chatMediaFilterSchema>;
export type ChatMediaQuery = z.infer<typeof chatMediaQuerySchema>;
