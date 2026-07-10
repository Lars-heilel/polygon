import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { useNavigate } from 'react-router';

import { Button, Heading, Input, Text } from '@org/shared';

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    navigate(`/users?query=${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="min-h-screen bg-surface p-6 text-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Heading level={2} as="h1">
            Admin console
          </Heading>
          <Text className="text-text-muted">Focused tools for support and user administration.</Text>
        </header>

        <section className="rounded-lg border border-border bg-surface-elevated p-5">
          <Heading level={5} as="h2">
            Users
          </Heading>
          <Text className="mt-2 text-text-muted">Search users, inspect account state, and manage sessions.</Text>
          <form className="mt-4 flex gap-3" onSubmit={onSearchSubmit}>
            <Input
              aria-label="Search users"
              label="Search users"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, display name, or email"
              value={query}
            />
            <Button type="submit">Search</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" to="/users">
              Manage users
            </Link>
            <a className="rounded-md border border-border px-4 py-2 text-sm font-medium" href="/">
              Back to messenger
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
