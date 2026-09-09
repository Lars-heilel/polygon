import type { JSX } from 'react';
import { Heading, Text } from '@org/shared';
import { Link } from 'react-router';

export function LandingHero(): JSX.Element {
  return (
    <section
      id="hero"
      aria-labelledby="landing-hero-title"
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 md:py-16"
    >
      <Text
        as="p"
        size="sm"
        color="muted"
        className="uppercase tracking-wide"
      >
        Real-time messenger
      </Text>
      <Heading
        level={1}
        id="landing-hero-title"
      >
        Fast, private messenger for teams
      </Heading>
      <Text
        size="lg"
        color="muted"
        className="max-w-xl"
      >
        Chats, media sharing and real-time updates in one clean app.
      </Text>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/chats"
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-base font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Open messenger
        </Link>
        <Link
          to="/auth/login"
          className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-5 py-2.5 text-base font-medium text-text transition-colors hover:bg-surface-elevated"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
