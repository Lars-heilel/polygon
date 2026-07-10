import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useAdminUsersQuery } from '@org/entities-admin';
import { Heading, Input, Spinner, Text } from '@org/shared';

const SEARCH_DEBOUNCE_MS = 300;

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query') ?? '';
  const [draftQuery, setDraftQuery] = useState(query);
  const usersQuery = useAdminUsersQuery(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    const trimmed = draftQuery.trim();

    if (trimmed === query) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSearchParams(trimmed ? { query: trimmed } : {});
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [draftQuery, query, setSearchParams]);

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftQuery(event.target.value);
  };

  return (
    <main className="min-h-screen bg-surface p-6 text-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link className="text-sm text-primary" to="/">
            Back to admin overview
          </Link>
          <Heading level={2} as="h1">
            Users
          </Heading>
        </header>

        <Input
          aria-label="Search users"
          label="Search users"
          onChange={onSearchChange}
          placeholder="Name, display name, or email"
          value={draftQuery}
        />

        {!query && <Text className="text-text-muted">Enter a query to search users.</Text>}
        {query && usersQuery.isLoading && <Spinner label="Loading users" />}
        {query && usersQuery.isError && <Text className="text-danger">Could not load users</Text>}
        {query && !usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.length === 0 && (
          <Text className="text-text-muted">No users found</Text>
        )}

        {query && usersQuery.data && usersQuery.data.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface-elevated">
            {usersQuery.data.map((user) => (
              <li key={user.id}>
                <Link className="flex items-center justify-between gap-4 p-4" to={`/users/${user.id}`}>
                  <span className="flex flex-col">
                    <span className="font-medium">{user.displayName ?? user.name}</span>
                    <span className="text-sm text-text-muted">{user.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    {user.ban.isBanned && <span className="text-danger">Banned</span>}
                    <span>{user.role}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
