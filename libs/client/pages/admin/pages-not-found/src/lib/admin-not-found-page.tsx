import { Link } from 'react-router';

import { Heading, Text } from '@org/shared';

export function AdminNotFoundPage() {
  return (
    <main className="min-h-screen bg-surface p-6 text-text">
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-surface-elevated p-6">
        <Heading level={2} as="h1">
          Admin page not found
        </Heading>
        <Text className="mt-2 text-text-muted">The requested admin page does not exist.</Text>
        <Link className="mt-4 inline-flex text-primary" to="/">
          Back to admin overview
        </Link>
      </div>
    </main>
  );
}
