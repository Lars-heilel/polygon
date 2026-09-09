import type { JSX } from 'react';
import { Text } from '@org/shared';
import { Link } from 'react-router';

export function LandingFooter(): JSX.Element {
  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <Text
          as="p"
          size="sm"
          color="muted"
        >
          © 2026 Polygon. Private preview.
        </Text>
        <nav aria-label="Footer">
          <Link
            to="/auth/login"
            className="text-sm text-text-muted hover:text-text"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
