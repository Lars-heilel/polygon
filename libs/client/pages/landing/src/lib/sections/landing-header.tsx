import type { JSX } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { Text } from '@org/shared';
import { Link } from 'react-router';

export function LandingHeader(): JSX.Element {
  return (
    <header className="sticky top-0 z-10 w-full border-b border-border bg-surface/80 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-md focus:bg-surface-elevated focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <nav
        aria-label="Landing"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3"
      >
        <Link
          to="/landing"
          className="flex items-center gap-2.5"
          aria-label="Polygon landing home"
        >
          <svg
            width="28"
            height="32"
            viewBox="0 0 60 100"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="h-7 w-auto"
          >
            <defs>
              <linearGradient
                id="landing-logo-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  style={{ stopColor: 'var(--color-purple-60, #703bf7)', stopOpacity: 1 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: 'var(--color-purple-75, #a685fa)', stopOpacity: 1 }}
                />
              </linearGradient>
            </defs>
            <path
              d="M30 10 L60 50 L30 90 L0 50 Z"
              fill="url(#landing-logo-grad)"
            />
            <path
              d="M30 10 L45 50 L30 70 L15 50 Z"
              fill="#f4f0fe"
              opacity="0.8"
            />
          </svg>
          <Text
            as="span"
            weight="semibold"
          >
            Polygon
          </Text>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to={CLIENT_ROUTES.auth.login}
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-elevated"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
