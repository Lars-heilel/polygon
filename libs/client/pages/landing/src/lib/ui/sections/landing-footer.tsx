import type { JSX } from 'react';

import { BrandIcon, Text } from '@org/shared';

import githubUrl from '../icons/github.svg';

const GITHUB_URL = 'https://github.com/Lars-heilel/polygon';

export function LandingFooter(): JSX.Element {
  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <Text
          as="p"
          size="sm"
          color="muted"
        >
          © 2026 Polygon.
        </Text>
        <nav
          aria-label="Footer"
          className="flex items-center gap-4"
        >
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Polygon GitHub repository"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-base font-medium text-text transition-colors hover:border-primary/40 hover:text-primary"
          >
            <BrandIcon
              src={githubUrl}
              size="md"
            />
            GitHub
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
