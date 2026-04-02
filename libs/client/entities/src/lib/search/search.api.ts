import { API_ROUTES } from '@org/common';
import type { UserSearchResult } from '@org/common';
import { useQuery } from '@tanstack/react-query';

import { authedFetch } from '../api/authed-fetch';

export const searchApi = {
  users: (q: string, limit = 20, offset = 0) =>
    authedFetch<UserSearchResult[]>(
      `${API_ROUTES.search.users}?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    ),
};

export function useSearchUsersQuery(q: string, options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['search', 'users', q, options],
    queryFn: () => searchApi.users(q, options?.limit, options?.offset),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
}
