import type { JSX } from 'react';

import { CLIENT_ROUTES } from '@org/common';
import { Heading, Text, heroBackgroundUrl } from '@org/shared';
import { Link } from 'react-router';

export function LandingHero(): JSX.Element {
  return (
    <section
      id="hero"
      aria-labelledby="landing-hero-title"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <img
          src={heroBackgroundUrl}
          alt=""
          loading="eager"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-b via-surface/60 to-surface" />
      </div>
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-12 md:py-16">
        <Heading
          level={1}
          id="landing-hero-title"
          className="max-w-2xl text-balance text-4xl leading-tight tracking-tight text-text md:text-5xl"
        >
          Realtime chat and file sharing for experiments
        </Heading>
        <Text
          size="lg"
          color="muted"
          className="max-w-xl"
        >
          Polygon is a pet project by developer Igor Shevchenko for experimenting with architectures
          and development approaches. Register to try the latest version — chat in real time and
          exchange files.
        </Text>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to={CLIENT_ROUTES.chats.root}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Start using
          </Link>
        </div>
      </div>
    </section>
  );
}
