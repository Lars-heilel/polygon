import type { JSX } from 'react';
import { Text } from '@org/shared';
import { ArrowUpRight } from 'lucide-react';
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
            className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
          >
            GitHub
            <ArrowUpRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </a>
        
        </nav>
      </div>
    </footer>
  );
}
