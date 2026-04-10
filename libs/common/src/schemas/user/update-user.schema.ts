import * as z from 'zod';

export const updateUserSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  avatarUrl: z.url().optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
});
