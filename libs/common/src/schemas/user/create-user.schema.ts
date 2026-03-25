import * as z from 'zod';

export const createUserSchema = z.object({
  email: z.email(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.url().optional(),
});
