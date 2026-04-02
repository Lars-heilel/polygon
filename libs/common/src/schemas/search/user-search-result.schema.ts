import * as z from 'zod';

export const userSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const searchUsersResponseSchema = z.array(userSearchResultSchema);

export type UserSearchResult = z.infer<typeof userSearchResultSchema>;
