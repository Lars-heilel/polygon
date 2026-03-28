import * as z from 'zod';

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  bio: z.string().nullable(),
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
