import type { UserSearchResult } from '@org/common';
import { HttpResponse, http } from 'msw';

const BASE = '/api';

export const searchHandlers = [
  http.get(`${BASE}/search/users`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';

    const results: UserSearchResult[] = [
      { id: crypto.randomUUID(), name: 'alice', displayName: 'Alice', avatarUrl: null },
      { id: crypto.randomUUID(), name: 'bob', displayName: 'Bob', avatarUrl: null },
    ].filter((u) => u.name.includes(q.toLowerCase()));

    return HttpResponse.json(results);
  }),
];
