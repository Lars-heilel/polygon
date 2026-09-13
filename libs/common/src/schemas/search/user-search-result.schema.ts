import * as z from 'zod';

export const userSearchResultSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(32),
  displayName: z.string().max(64).nullable(),
  avatarUrl: z.url().max(2048).nullable(),
});

export const searchUsersResponseSchema = z.array(userSearchResultSchema);

export type UserSearchResult = z.infer<typeof userSearchResultSchema>;
