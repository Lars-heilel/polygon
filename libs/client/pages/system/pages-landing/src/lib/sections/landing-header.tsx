import type { JSX } from 'react';
import { Text } from '@org/shared';
import { Link } from 'react-router';

export function LandingHeader(): JSX.Element {
  return (
    <header className="w-full border-b border-border bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-md focus:bg-surface-elevated focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <nav
        aria-label="Landing"
        className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <Link
          to="/landing"
          className="flex items-center gap-2"
          aria-label="Polygon landing home"
        >
          <span
            aria-hidden="true"
            className="inline-block h-6 w-6 rounded-md bg-primary"
          />
          <Text
            as="span"
            weight="semibold"
          >
            Polygon
          </Text>
        </Link>
        <div className="flex items-center gap-4">
          <a
            href="#stack"
            className="text-sm text-text-muted hover:text-text"
          >
            Stack
          </a>
          <Link
            to="/auth/login"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-elevated"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
