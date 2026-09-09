import type { JSX } from 'react';
import { Button, Heading, Text } from '@org/shared';
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
        <Link to="/chats">
          <Button size="lg">Open messenger</Button>
        </Link>
        <Link to="/auth/login">
          <Button
            variant="secondary"
            size="lg"
          >
            Sign in
          </Button>
        </Link>
      </div>
    </section>
  );
}
