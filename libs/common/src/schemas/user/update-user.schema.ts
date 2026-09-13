import * as z from 'zod';

export const updateUserSchema = z.object({
  displayName: z.string().min(2).max(64).optional(),
  avatarUrl: z.url().max(2048).optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
