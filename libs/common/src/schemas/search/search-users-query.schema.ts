import * as z from 'zod';

export const searchUsersQuerySchema = z.object({
  q: z.string().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
