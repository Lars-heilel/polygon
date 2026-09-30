import { type ReactNode } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { Heading, Logo, Text, heroBackgroundUrl } from '@org/shared';
import { Link } from 'react-router';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <img
          data-testid="auth-background"
          src={heroBackgroundUrl}
          alt=""
          loading="eager"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-b via-surface/60 to-surface" />
      </div>

      <header className="relative px-4 py-4 md:px-6">
        <Link
          to={CLIENT_ROUTES.root}
          aria-label="Polygon home"
          className="inline-flex rounded-lg"
        >
          <Logo />
        </Link>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-10">
        <div className="bg-surface-elevated border border-purple-60 rounded-xl p-7">
          <div className="mb-6">
            <Heading level={4}>{title}</Heading>
            {description && (
              <Text
                size="sm"
                color="muted"
                className="mt-1"
              >
                {description}
              </Text>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
