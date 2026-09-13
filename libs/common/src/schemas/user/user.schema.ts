import * as z from 'zod';

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email().max(254),
  name: z.string().min(1).max(32),
  displayName: z.string().max(64).nullable(),
  avatarUrl: z.url().max(2048).nullable(),
  bio: z.string().max(500).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const userPublicSchema = userSchema.pick({
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
});

export type User = z.infer<typeof userSchema>;
export type UserPublic = z.infer<typeof userPublicSchema>;
